"""
Tests for webhook transaction boundaries (ISS-036).

Tests verify:
- Transaction rollback on handler failure
- Idempotency (duplicate webhook detection)
- Retry mechanism with exponential backoff
- Dead letter queue after max retries
- Webhook metrics and statistics

Run with:
    pytest tests/webhooks/test_webhook_transactions.py -v
"""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.webhook_models import WebhookEvent, WebhookStatus
from src.services.webhook_service import (
    WebhookService,
    WebhookProcessingError,
    WebhookDuplicateError,
)


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def webhook_service(db_session: AsyncSession) -> WebhookService:
    """Create a webhook service instance."""
    return WebhookService(db_session)


@pytest.fixture
def sample_payload() -> dict[str, Any]:
    """Sample webhook payload."""
    return {
        "id": 12345,
        "name": "Test Webhook",
        "data": {"key": "value"},
    }


@pytest.fixture
def sample_headers() -> dict[str, str]:
    """Sample webhook headers."""
    return {
        "X-Webhook-Id": "webhook_123",
        "Content-Type": "application/json",
    }


async def success_handler(payload: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    """Handler that succeeds."""
    return {"handled": True, "message": "Success"}


async def failure_handler(payload: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    """Handler that fails with retriable error."""
    raise WebhookProcessingError(
        "Processing failed",
        retriable=True,
        details={"reason": "test_failure"},
    )


async def non_retriable_handler(payload: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    """Handler that fails with non-retriable error."""
    raise WebhookProcessingError(
        "Permanent failure",
        retriable=False,
        details={"reason": "invalid_data"},
    )


async def crash_handler(payload: dict[str, Any], db: AsyncSession) -> dict[str, Any]:
    """Handler that crashes unexpectedly."""
    raise RuntimeError("Unexpected crash!")


# ============================================================================
# Transaction Boundary Tests
# ============================================================================


class TestTransactionBoundaries:
    """Test that transactions are properly managed."""

    @pytest.mark.asyncio
    async def test_successful_webhook_commits_transaction(
        self,
        webhook_service: WebhookService,
        sample_payload: dict,
        db_session: AsyncSession,
    ):
        """Test that successful processing commits the transaction."""
        event_id = f"test_success_{uuid.uuid4()}"

        result = await webhook_service.process_webhook(
            source="test",
            event_type="test.success",
            event_id=event_id,
            payload=sample_payload,
            handler=success_handler,
        )

        assert result["status"] == "success"

        # Verify webhook event was committed
        stmt = select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        db_result = await db_session.execute(stmt)
        webhook = db_result.scalar_one()

        assert webhook.status == WebhookStatus.COMPLETED.value
        assert webhook.completed_at is not None
        assert webhook.processing_result == {"handled": True, "message": "Success"}

    @pytest.mark.asyncio
    async def test_failed_webhook_rolls_back_transaction(
        self,
        webhook_service: WebhookService,
        sample_payload: dict,
        db_session: AsyncSession,
    ):
        """Test that failed processing rolls back the transaction."""
        event_id = f"test_failure_{uuid.uuid4()}"

        result = await webhook_service.process_webhook(
            source="test",
            event_type="test.failure",
            event_id=event_id,
            payload=sample_payload,
            handler=failure_handler,
        )

        assert result["status"] == "failed"
        assert result["will_retry"] is True

        # Verify webhook event was marked as failed
        stmt = select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        db_result = await db_session.execute(stmt)
        webhook = db_result.scalar_one()

        assert webhook.status == WebhookStatus.FAILED.value
        assert webhook.error_message == "Processing failed"
        assert webhook.retry_count == 1
        assert webhook.next_retry_at is not None

    @pytest.mark.asyncio
    async def test_crash_rolls_back_and_schedules_retry(
        self,
        webhook_service: WebhookService,
        sample_payload: dict,
        db_session: AsyncSession,
    ):
        """Test that unexpected crashes roll back and schedule retry."""
        event_id = f"test_crash_{uuid.uuid4()}"

        result = await webhook_service.process_webhook(
            source="test",
            event_type="test.crash",
            event_id=event_id,
            payload=sample_payload,
            handler=crash_handler,
        )

        assert result["status"] == "error"
        assert result["will_retry"] is True
        assert "Unexpected crash" in result["error"]

        # Verify webhook event was marked as failed
        stmt = select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        db_result = await db_session.execute(stmt)
        webhook = db_result.scalar_one()

        assert webhook.status == WebhookStatus.FAILED.value
        assert webhook.retry_count == 1


# ============================================================================
# Idempotency Tests
# ============================================================================


class TestIdempotency:
    """Test duplicate webhook detection."""

    @pytest.mark.asyncio
    async def test_duplicate_webhook_is_skipped(
        self,
        webhook_service: WebhookService,
        sample_payload: dict,
        db_session: AsyncSession,
    ):
        """Test that duplicate webhooks are detected and skipped."""
        event_id = f"test_dup_{uuid.uuid4()}"

        # First request - should succeed
        result1 = await webhook_service.process_webhook(
            source="test",
            event_type="test.duplicate",
            event_id=event_id,
            payload=sample_payload,
            handler=success_handler,
        )
        assert result1["status"] == "success"

        # Second request - should be skipped as duplicate
        result2 = await webhook_service.process_webhook(
            source="test",
            event_type="test.duplicate",
            event_id=event_id,
            payload=sample_payload,
            handler=success_handler,
        )
        assert result2["status"] == "duplicate"
        assert "already processed" in result2["message"].lower()

    @pytest.mark.asyncio
    async def test_same_event_id_different_source_is_allowed(
        self,
        webhook_service: WebhookService,
        sample_payload: dict,
    ):
        """Test that same event_id from different sources is allowed."""
        event_id = f"test_multi_source_{uuid.uuid4()}"

        # First source
        result1 = await webhook_service.process_webhook(
            source="shopify",
            event_type="orders/create",
            event_id=event_id,
            payload=sample_payload,
            handler=success_handler,
        )
        assert result1["status"] == "success"

        # Different source, same event_id - should succeed
        result2 = await webhook_service.process_webhook(
            source="xero",
            event_type="INVOICE.CREATE",
            event_id=event_id,
            payload=sample_payload,
            handler=success_handler,
        )
        assert result2["status"] == "success"


# ============================================================================
# Retry Mechanism Tests
# ============================================================================


class TestRetryMechanism:
    """Test exponential backoff retry mechanism."""

    @pytest.mark.asyncio
    async def test_exponential_backoff_timing(
        self,
        webhook_service: WebhookService,
        sample_payload: dict,
        db_session: AsyncSession,
    ):
        """Test that retry timing follows exponential backoff."""
        event_id = f"test_backoff_{uuid.uuid4()}"

        # First failure
        result = await webhook_service.process_webhook(
            source="test",
            event_type="test.backoff",
            event_id=event_id,
            payload=sample_payload,
            handler=failure_handler,
        )

        # Verify backoff timing
        stmt = select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        db_result = await db_session.execute(stmt)
        webhook = db_result.scalar_one()

        # First retry should be ~60 seconds (2^1 * 60 = 120, capped at 60 for first)
        expected_delay = timedelta(seconds=120)  # 60 * 2^1
        actual_delay = webhook.next_retry_at - webhook.received_at

        # Allow some tolerance for test execution time
        assert actual_delay >= timedelta(seconds=110)
        assert actual_delay <= timedelta(seconds=130)

    @pytest.mark.asyncio
    async def test_max_retries_moves_to_dead_letter(
        self,
        webhook_service: WebhookService,
        sample_payload: dict,
        db_session: AsyncSession,
    ):
        """Test that exceeding max retries moves webhook to dead letter queue."""
        event_id = f"test_dead_letter_{uuid.uuid4()}"

        # Process with max_retries=1
        result = await webhook_service.process_webhook(
            source="test",
            event_type="test.dead_letter",
            event_id=event_id,
            payload=sample_payload,
            handler=failure_handler,
            max_retries=1,
        )

        # First failure - should still allow retry
        stmt = select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        db_result = await db_session.execute(stmt)
        webhook = db_result.scalar_one()

        # Manually trigger second failure by updating retry count
        webhook.retry_count = 1  # Already at max
        webhook.mark_failed("Second failure", retry=True)
        await db_session.commit()

        # Verify it's in dead letter queue
        await db_session.refresh(webhook)
        assert webhook.status == WebhookStatus.DEAD_LETTER.value
        assert webhook.next_retry_at is None

    @pytest.mark.asyncio
    async def test_non_retriable_error_goes_to_dead_letter_immediately(
        self,
        webhook_service: WebhookService,
        sample_payload: dict,
        db_session: AsyncSession,
    ):
        """Test that non-retriable errors go straight to dead letter queue."""
        event_id = f"test_non_retriable_{uuid.uuid4()}"

        result = await webhook_service.process_webhook(
            source="test",
            event_type="test.non_retriable",
            event_id=event_id,
            payload=sample_payload,
            handler=non_retriable_handler,
        )

        assert result["status"] == "failed"
        assert result["will_retry"] is False

        # Verify it's in dead letter queue
        stmt = select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        db_result = await db_session.execute(stmt)
        webhook = db_result.scalar_one()

        assert webhook.status == WebhookStatus.DEAD_LETTER.value


# ============================================================================
# Statistics Tests
# ============================================================================


class TestWebhookStatistics:
    """Test webhook statistics and health metrics."""

    @pytest.mark.asyncio
    async def test_get_webhook_stats(
        self,
        webhook_service: WebhookService,
        sample_payload: dict,
    ):
        """Test webhook statistics calculation."""
        # Create some test webhooks
        for i in range(5):
            await webhook_service.process_webhook(
                source="test",
                event_type="test.stats",
                event_id=f"test_stats_{uuid.uuid4()}",
                payload=sample_payload,
                handler=success_handler,
            )

        for i in range(2):
            await webhook_service.process_webhook(
                source="test",
                event_type="test.stats_fail",
                event_id=f"test_stats_fail_{uuid.uuid4()}",
                payload=sample_payload,
                handler=failure_handler,
            )

        # Get stats
        stats = await webhook_service.get_webhook_stats(source="test", hours=1)

        assert stats["total_received"] >= 7
        assert stats["completed"] >= 5
        assert stats["failed"] >= 2
        assert "reliability_rate" in stats

    @pytest.mark.asyncio
    async def test_get_webhooks_for_retry(
        self,
        webhook_service: WebhookService,
        sample_payload: dict,
        db_session: AsyncSession,
    ):
        """Test fetching webhooks ready for retry."""
        # Create a failed webhook with past retry time
        event_id = f"test_retry_fetch_{uuid.uuid4()}"

        await webhook_service.process_webhook(
            source="test",
            event_type="test.retry_fetch",
            event_id=event_id,
            payload=sample_payload,
            handler=failure_handler,
        )

        # Update next_retry_at to be in the past
        stmt = select(WebhookEvent).where(WebhookEvent.event_id == event_id)
        db_result = await db_session.execute(stmt)
        webhook = db_result.scalar_one()
        webhook.next_retry_at = datetime.now(UTC) - timedelta(minutes=5)
        await db_session.commit()

        # Fetch webhooks for retry (high limit to handle accumulated test data)
        webhooks = await webhook_service.get_webhooks_for_retry(limit=1000)

        assert len(webhooks) >= 1
        assert any(w.event_id == event_id for w in webhooks)


# ============================================================================
# Webhook Event Model Tests
# ============================================================================


class TestWebhookEventModel:
    """Test WebhookEvent model methods."""

    @pytest.mark.asyncio
    async def test_mark_processing(self, db_session: AsyncSession):
        """Test mark_processing method."""
        webhook = WebhookEvent(
            source="test",
            event_type="test.model",
            event_id=f"test_model_{uuid.uuid4()}",
            payload={"test": "data"},
        )
        db_session.add(webhook)
        await db_session.flush()

        webhook.mark_processing()

        assert webhook.status == WebhookStatus.PROCESSING.value
        assert webhook.started_processing_at is not None

    @pytest.mark.asyncio
    async def test_mark_completed(self, db_session: AsyncSession):
        """Test mark_completed method."""
        webhook = WebhookEvent(
            source="test",
            event_type="test.model",
            event_id=f"test_model_{uuid.uuid4()}",
            payload={"test": "data"},
        )
        db_session.add(webhook)
        await db_session.flush()

        webhook.mark_processing()
        webhook.mark_completed({"result": "success"})

        assert webhook.status == WebhookStatus.COMPLETED.value
        assert webhook.completed_at is not None
        assert webhook.processing_result == {"result": "success"}

    @pytest.mark.asyncio
    async def test_mark_failed_with_retry(self, db_session: AsyncSession):
        """Test mark_failed with retry enabled."""
        webhook = WebhookEvent(
            source="test",
            event_type="test.model",
            event_id=f"test_model_{uuid.uuid4()}",
            payload={"test": "data"},
            max_retries=3,
        )
        db_session.add(webhook)
        await db_session.flush()

        webhook.mark_failed("Test error", retry=True)

        assert webhook.status == WebhookStatus.FAILED.value
        assert webhook.retry_count == 1
        assert webhook.next_retry_at is not None
        assert webhook.error_message == "Test error"

    @pytest.mark.asyncio
    async def test_reset_for_retry(self, db_session: AsyncSession):
        """Test reset_for_retry method."""
        webhook = WebhookEvent(
            source="test",
            event_type="test.model",
            event_id=f"test_model_{uuid.uuid4()}",
            payload={"test": "data"},
            status=WebhookStatus.DEAD_LETTER.value,
            retry_count=3,
            error_message="Previous error",
        )
        db_session.add(webhook)
        await db_session.flush()

        webhook.reset_for_retry()

        assert webhook.status == WebhookStatus.PENDING.value
        assert webhook.retry_count == 0
        assert webhook.error_message is None

    @pytest.mark.asyncio
    async def test_is_retriable_property(self, db_session: AsyncSession):
        """Test is_retriable property."""
        webhook = WebhookEvent(
            source="test",
            event_type="test.model",
            event_id=f"test_model_{uuid.uuid4()}",
            payload={"test": "data"},
            status=WebhookStatus.FAILED.value,
            retry_count=1,
            max_retries=3,
            next_retry_at=datetime.now(UTC) - timedelta(minutes=1),
        )
        db_session.add(webhook)
        await db_session.flush()

        assert webhook.is_retriable is True

        # Not retriable if max retries exceeded
        webhook.retry_count = 5
        assert webhook.is_retriable is False

    @pytest.mark.asyncio
    async def test_processing_duration_ms(self, db_session: AsyncSession):
        """Test processing_duration_ms property."""
        webhook = WebhookEvent(
            source="test",
            event_type="test.model",
            event_id=f"test_model_{uuid.uuid4()}",
            payload={"test": "data"},
        )
        db_session.add(webhook)
        await db_session.flush()

        # No duration before processing
        assert webhook.processing_duration_ms is None

        # Set processing times
        webhook.started_processing_at = datetime.now(UTC)
        webhook.completed_at = webhook.started_processing_at + timedelta(milliseconds=500)

        assert webhook.processing_duration_ms is not None
        assert 450 <= webhook.processing_duration_ms <= 550


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
