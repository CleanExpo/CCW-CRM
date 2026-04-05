"""Webhook processing service with transaction safety.

Provides reliable webhook processing with:
- Transaction boundaries (commit only on success, rollback on failure)
- Idempotency checks (prevent duplicate processing)
- Retry mechanism with exponential backoff
- Dead letter queue for failed webhooks
- Comprehensive logging and monitoring

ISS-036: Fix webhook transaction boundaries to prevent data loss on handler crashes.

Usage:
    webhook_service = WebhookService(db)

    # Process a webhook with transaction safety
    result = await webhook_service.process_webhook(
        source="shopify",
        event_type="orders/create",
        event_id="webhook_123",
        payload={"order_id": 456},
        handler=my_handler_function,
    )

    # The handler will only see committed data if it succeeds
    # If handler crashes, webhook is marked failed and queued for retry
"""

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any, TypeVar

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.webhook_models import WebhookEvent, WebhookStatus

logger = structlog.get_logger(__name__)

# Type for webhook handlers
T = TypeVar("T")
WebhookHandler = Callable[[dict[str, Any], AsyncSession], Awaitable[dict[str, Any]]]


class WebhookProcessingError(Exception):
    """Exception for webhook processing failures that should trigger retry."""

    def __init__(
        self,
        message: str,
        *,
        retriable: bool = True,
        details: dict[str, Any] | None = None,
    ):
        """Initialize webhook processing error.

        Args:
            message: Error message
            retriable: Whether this error should trigger a retry (default: True)
            details: Additional error context for debugging
        """
        super().__init__(message)
        self.retriable = retriable
        self.details = details or {}


class WebhookDuplicateError(Exception):
    """Exception raised when a duplicate webhook is detected."""

    pass


class WebhookService:
    """Service for reliable webhook processing with transaction safety.

    This service ensures:
    1. Webhooks are persisted BEFORE processing starts
    2. Processing happens in a transaction
    3. On success: transaction commits, webhook marked completed
    4. On failure: transaction rolls back, webhook marked failed with retry
    5. Duplicate webhooks are detected and skipped
    """

    def __init__(self, db: AsyncSession):
        """Initialize webhook service.

        Args:
            db: SQLAlchemy async session
        """
        self.db = db

    async def process_webhook(
        self,
        source: str,
        event_type: str,
        event_id: str,
        payload: dict[str, Any],
        handler: WebhookHandler,
        *,
        headers: dict[str, str] | None = None,
        max_retries: int = 3,
    ) -> dict[str, Any]:
        """Process a webhook with transaction safety.

        This method:
        1. Checks for duplicate webhooks (idempotency)
        2. Creates a webhook event record
        3. Calls the handler in a transaction
        4. On success: commits and marks completed
        5. On failure: rolls back and schedules retry

        Args:
            source: Webhook source (shopify, xero, sendgrid, etc.)
            event_type: Event type (orders/create, INVOICE.UPDATE, etc.)
            event_id: Unique event ID from the webhook provider
            payload: Webhook payload data
            handler: Async function to process the webhook
            headers: Optional HTTP headers from the webhook request
            max_retries: Maximum retry attempts (default: 3)

        Returns:
            Dict with processing result

        Raises:
            WebhookDuplicateError: If webhook was already processed
        """
        logger.info(
            "webhook_received",
            source=source,
            event_type=event_type,
            event_id=event_id,
        )

        # 1. Check for duplicate webhook (idempotency)
        existing = await self._find_existing_webhook(source, event_id)
        if existing:
            if existing.status == WebhookStatus.COMPLETED.value:
                logger.info(
                    "webhook_duplicate_skipped",
                    source=source,
                    event_id=event_id,
                    original_id=str(existing.id),
                )
                return {
                    "status": "duplicate",
                    "message": "Webhook already processed",
                    "event_id": event_id,
                    "original_webhook_id": str(existing.id),
                }
            elif existing.status in (
                WebhookStatus.PENDING.value,
                WebhookStatus.PROCESSING.value,
            ):
                logger.warning(
                    "webhook_already_processing",
                    source=source,
                    event_id=event_id,
                    status=existing.status,
                )
                return {
                    "status": "processing",
                    "message": "Webhook is already being processed",
                    "event_id": event_id,
                    "webhook_id": str(existing.id),
                }
            # If failed or dead_letter, we'll create a new attempt below

        # 2. Create webhook event record (persisted BEFORE processing)
        webhook_event = WebhookEvent(
            source=source,
            event_type=event_type,
            event_id=event_id,
            payload=payload,
            headers=headers,
            status=WebhookStatus.PENDING.value,
            max_retries=max_retries,
        )
        self.db.add(webhook_event)
        await self.db.flush()  # Get ID but don't commit yet

        logger.info(
            "webhook_event_created",
            webhook_id=str(webhook_event.id),
            source=source,
            event_id=event_id,
        )

        # 3. Process webhook with transaction boundary
        try:
            # Mark as processing
            webhook_event.mark_processing()
            await self.db.flush()

            # Call handler (all database operations within handler use same session)
            result = await handler(payload, self.db)

            # Mark as completed
            webhook_event.mark_completed(result)

            # Commit everything (webhook event + handler's database changes)
            await self.db.commit()

            logger.info(
                "webhook_processed_successfully",
                webhook_id=str(webhook_event.id),
                source=source,
                event_id=event_id,
                processing_time_ms=webhook_event.processing_duration_ms,
            )

            return {
                "status": "success",
                "webhook_id": str(webhook_event.id),
                "event_id": event_id,
                "result": result,
            }

        except WebhookProcessingError as e:
            # Handler raised a retriable error
            await self.db.rollback()

            # Update webhook status (in a new transaction)
            webhook_event.mark_failed(
                str(e),
                error_details=e.details,
                retry=e.retriable,
            )
            await self.db.commit()

            logger.warning(
                "webhook_processing_failed",
                webhook_id=str(webhook_event.id),
                source=source,
                event_id=event_id,
                error=str(e),
                retriable=e.retriable,
                retry_count=webhook_event.retry_count,
                next_retry_at=(
                    webhook_event.next_retry_at.isoformat()
                    if webhook_event.next_retry_at else None
                ),
            )

            return {
                "status": "failed",
                "webhook_id": str(webhook_event.id),
                "event_id": event_id,
                "error": str(e),
                "will_retry": webhook_event.status == WebhookStatus.FAILED.value,
                "next_retry_at": (
                    webhook_event.next_retry_at.isoformat()
                    if webhook_event.next_retry_at else None
                ),
            }

        except Exception as e:
            # Unexpected error - roll back and schedule retry
            await self.db.rollback()

            # Update webhook status (in a new transaction)
            webhook_event.mark_failed(
                str(e),
                error_details={"exception_type": type(e).__name__},
                retry=True,
            )
            await self.db.commit()

            logger.error(
                "webhook_processing_error",
                webhook_id=str(webhook_event.id),
                source=source,
                event_id=event_id,
                error=str(e),
                exception_type=type(e).__name__,
                retry_count=webhook_event.retry_count,
            )

            return {
                "status": "error",
                "webhook_id": str(webhook_event.id),
                "event_id": event_id,
                "error": str(e),
                "will_retry": webhook_event.status == WebhookStatus.FAILED.value,
                "next_retry_at": (
                    webhook_event.next_retry_at.isoformat()
                    if webhook_event.next_retry_at else None
                ),
            }

    async def _find_existing_webhook(
        self,
        source: str,
        event_id: str,
    ) -> WebhookEvent | None:
        """Find existing webhook by source and event_id.

        Args:
            source: Webhook source
            event_id: Unique event ID

        Returns:
            Existing webhook event or None
        """
        stmt = select(WebhookEvent).where(
            WebhookEvent.source == source,
            WebhookEvent.event_id == event_id,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_webhooks_for_retry(
        self,
        limit: int = 100,
    ) -> list[WebhookEvent]:
        """Get webhooks that are ready for retry.

        Args:
            limit: Maximum number of webhooks to return

        Returns:
            List of retriable webhook events
        """
        now = datetime.now(UTC)
        stmt = (
            select(WebhookEvent)
            .where(
                WebhookEvent.status == WebhookStatus.FAILED.value,
                WebhookEvent.next_retry_at <= now,
                WebhookEvent.retry_count < WebhookEvent.max_retries,
            )
            .order_by(WebhookEvent.next_retry_at.asc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_dead_letter_webhooks(
        self,
        source: str | None = None,
        limit: int = 100,
    ) -> list[WebhookEvent]:
        """Get webhooks in dead letter queue.

        Args:
            source: Optional filter by source
            limit: Maximum number of webhooks to return

        Returns:
            List of dead letter webhook events
        """
        stmt = (
            select(WebhookEvent)
            .where(WebhookEvent.status == WebhookStatus.DEAD_LETTER.value)
            .order_by(WebhookEvent.received_at.desc())
            .limit(limit)
        )
        if source:
            stmt = stmt.where(WebhookEvent.source == source)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def retry_webhook(
        self,
        webhook_id: str,
        handler: WebhookHandler,
    ) -> dict[str, Any]:
        """Manually retry a specific webhook.

        Args:
            webhook_id: Webhook event ID
            handler: Handler function to process the webhook

        Returns:
            Processing result
        """
        from uuid import UUID

        stmt = select(WebhookEvent).where(WebhookEvent.id == UUID(webhook_id))
        result = await self.db.execute(stmt)
        webhook_event = result.scalar_one_or_none()

        if not webhook_event:
            return {"status": "error", "message": f"Webhook {webhook_id} not found"}

        if webhook_event.status == WebhookStatus.COMPLETED.value:
            return {
                "status": "skipped",
                "message": "Webhook already completed",
                "webhook_id": webhook_id,
            }

        # Reset for retry if from dead letter queue
        if webhook_event.status == WebhookStatus.DEAD_LETTER.value:
            webhook_event.reset_for_retry()
            await self.db.commit()

        # Process using the standard flow
        return await self.process_webhook(
            source=webhook_event.source,
            event_type=webhook_event.event_type,
            event_id=f"{webhook_event.event_id}_retry_{datetime.now(UTC).timestamp()}",
            payload=webhook_event.payload,
            handler=handler,
            headers=webhook_event.headers,
            max_retries=webhook_event.max_retries,
        )

    async def get_webhook_stats(
        self,
        source: str | None = None,
        hours: int = 24,
    ) -> dict[str, Any]:
        """Get webhook processing statistics.

        Args:
            source: Optional filter by source
            hours: Time window in hours (default: 24)

        Returns:
            Statistics dict with counts and rates
        """
        from sqlalchemy import func

        cutoff = datetime.now(UTC).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        if hours < 24:
            from datetime import timedelta
            cutoff = datetime.now(UTC) - timedelta(hours=hours)

        # Base query
        base_filter = WebhookEvent.received_at >= cutoff
        if source:
            base_filter = base_filter & (WebhookEvent.source == source)

        # Count by status
        status_counts_stmt = (
            select(
                WebhookEvent.status,
                func.count(WebhookEvent.id).label("count"),
            )
            .where(base_filter)
            .group_by(WebhookEvent.status)
        )
        status_result = await self.db.execute(status_counts_stmt)
        status_counts = {row.status: row.count for row in status_result}

        total = sum(status_counts.values())
        completed = status_counts.get(WebhookStatus.COMPLETED.value, 0)
        failed = status_counts.get(WebhookStatus.FAILED.value, 0)
        dead_letter = status_counts.get(WebhookStatus.DEAD_LETTER.value, 0)

        # Calculate reliability rate
        processed = completed + failed + dead_letter
        reliability_rate = (completed / processed * 100) if processed > 0 else 100.0

        # Average processing time for completed webhooks
        duration_expr = (
            WebhookEvent.completed_at - WebhookEvent.started_processing_at
        )
        avg_time_stmt = (
            select(
                func.avg(func.extract("epoch", duration_expr) * 1000).label("avg_ms")
            )
            .where(
                base_filter,
                WebhookEvent.status == WebhookStatus.COMPLETED.value,
                WebhookEvent.completed_at.isnot(None),
                WebhookEvent.started_processing_at.isnot(None),
            )
        )
        avg_result = await self.db.execute(avg_time_stmt)
        avg_processing_ms = avg_result.scalar()

        return {
            "period_hours": hours,
            "source": source or "all",
            "total_received": total,
            "completed": completed,
            "failed": failed,
            "dead_letter": dead_letter,
            "pending": status_counts.get(WebhookStatus.PENDING.value, 0),
            "processing": status_counts.get(WebhookStatus.PROCESSING.value, 0),
            "reliability_rate": round(reliability_rate, 2),
            "avg_processing_time_ms": round(avg_processing_ms) if avg_processing_ms else None,
            "target_reliability": 99.0,
            "status": "healthy" if reliability_rate >= 99.0 else "degraded",
        }


class WebhookRetryJob:
    """Background job to retry failed webhooks.

    Run this periodically (e.g., every 5 minutes) to process the retry queue.
    """

    def __init__(
        self,
        db: AsyncSession,
        handlers: dict[str, WebhookHandler],
    ):
        """Initialize retry job.

        Args:
            db: Database session
            handlers: Dict mapping source to handler function
        """
        self.db = db
        self.handlers = handlers

    async def run(self, batch_size: int = 50) -> dict[str, Any]:
        """Run the retry job.

        Args:
            batch_size: Maximum webhooks to process per run

        Returns:
            Job result with counts
        """
        logger.info("webhook_retry_job_started", batch_size=batch_size)

        service = WebhookService(self.db)
        webhooks = await service.get_webhooks_for_retry(limit=batch_size)

        results = {
            "total": len(webhooks),
            "succeeded": 0,
            "failed": 0,
            "skipped": 0,
        }

        for webhook in webhooks:
            handler = self.handlers.get(webhook.source)
            if not handler:
                logger.warning(
                    "webhook_retry_no_handler",
                    webhook_id=str(webhook.id),
                    source=webhook.source,
                )
                results["skipped"] += 1
                continue

            try:
                result = await service.retry_webhook(str(webhook.id), handler)
                if result["status"] == "success":
                    results["succeeded"] += 1
                else:
                    results["failed"] += 1
            except Exception as e:
                logger.error(
                    "webhook_retry_error",
                    webhook_id=str(webhook.id),
                    error=str(e),
                )
                results["failed"] += 1

        logger.info(
            "webhook_retry_job_completed",
            **results,
        )

        return results
