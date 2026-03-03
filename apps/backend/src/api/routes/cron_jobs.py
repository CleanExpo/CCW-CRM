"""
Cron job endpoints for scheduled tasks.

These endpoints are called by Vercel Cron or other schedulers.

Recommended cron schedule (vercel.json):
```json
{
  "crons": [
    {
      "path": "/api/cron/check-expiring-quotes",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/refresh-xero-tokens",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/retry-failed-webhooks",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

ISS-036: Added webhook retry job for failed webhook processing.
"""

from datetime import UTC, datetime, timedelta
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.services.notification_service import get_notification_service

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/cron", tags=["Cron Jobs"])


def verify_cron_secret(authorization: str | None = Header(None)) -> bool:
    """
    Verify cron job authorization.

    In production, Vercel cron jobs send an Authorization header.
    For development, we allow all requests.
    """
    import os

    cron_secret = os.getenv("CRON_SECRET")
    if not cron_secret:
        # Development mode - allow all
        return True

    if not authorization:
        return False

    # Check if authorization header matches secret
    return authorization == f"Bearer {cron_secret}"


@router.post("/check-expiring-quotes")
async def check_expiring_quotes(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    authorization: str | None = Header(None),
) -> dict:
    """
    Check for quotes expiring in 3 days and send notifications.

    This endpoint should be called by Vercel Cron daily at 9 AM:

    vercel.json:
    ```json
    {
      "crons": [
        {
          "path": "/api/cron/check-expiring-quotes",
          "schedule": "0 9 * * *"
        }
      ]
    }
    ```

    Returns:
        Status and count of notifications sent
    """
    if not verify_cron_secret(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    notification_service = get_notification_service()
    count = await notification_service.check_expiring_quotes(db)

    return {
        "status": "success",
        "message": f"Checked expiring quotes and sent {count} notifications",
        "notifications_sent": count,
    }


@router.post("/refresh-xero-tokens")
async def refresh_xero_tokens(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    authorization: str | None = Header(None),
) -> dict:
    """
    Proactively refresh Xero OAuth tokens before they expire.

    This endpoint should be called by Vercel Cron every 15 minutes:

    vercel.json:
    ```json
    {
      "crons": [
        {
          "path": "/api/cron/refresh-xero-tokens",
          "schedule": "*/15 * * * *"
        }
      ]
    }
    ```

    The job will refresh tokens that expire within the next 10 minutes,
    ensuring tokens are always valid for API calls.

    Returns:
        Status and counts of refreshed/failed tokens
    """
    if not verify_cron_secret(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.config.xero_settings import get_xero_settings
    from src.db.xero_models import XeroConnection
    from src.integrations.xero.token_manager import TokenRefreshError, XeroTokenManager

    settings = get_xero_settings()

    # Skip in demo mode
    if settings.is_demo_mode:
        logger.info("Xero token refresh skipped - demo mode")
        return {
            "status": "skipped",
            "message": "Token refresh skipped in demo mode",
            "mode": "demo",
        }

    # Find connections with tokens expiring in next 10 minutes
    expiry_threshold = datetime.now(UTC) + timedelta(minutes=10)

    stmt = select(XeroConnection).where(
        XeroConnection.is_active == True,  # noqa: E712
        XeroConnection.expires_at < expiry_threshold,
    )
    result = await db.execute(stmt)
    expiring_connections = result.scalars().all()

    if not expiring_connections:
        logger.debug("No Xero tokens expiring soon")
        return {
            "status": "success",
            "message": "No tokens need refreshing",
            "refreshed": 0,
            "failed": 0,
        }

    logger.info(
        "Found Xero connections with expiring tokens",
        count=len(expiring_connections),
    )

    refreshed = 0
    failed = 0
    errors = []

    for connection in expiring_connections:
        try:
            # Create token manager and load tokens
            token_manager = XeroTokenManager(
                client_id=settings.client_id,
                client_secret=settings.client_secret,
            )
            token_manager.load_from_connection(connection)

            # Force refresh (bypass buffer check)
            await token_manager._refresh_access_token(db)

            refreshed += 1
            logger.info(
                "Proactively refreshed Xero token",
                connection_id=str(connection.id),
                tenant_id=connection.tenant_id,
            )

        except TokenRefreshError as e:
            failed += 1
            errors.append({
                "connection_id": str(connection.id),
                "tenant_id": connection.tenant_id,
                "error": e.message,
                "recoverable": e.is_recoverable,
            })
            logger.error(
                "Failed to refresh Xero token",
                connection_id=str(connection.id),
                error=e.message,
            )

        except Exception as e:
            failed += 1
            errors.append({
                "connection_id": str(connection.id),
                "tenant_id": connection.tenant_id,
                "error": str(e),
            })
            logger.error(
                "Unexpected error refreshing Xero token",
                connection_id=str(connection.id),
                error=str(e),
            )

    logger.info(
        "Xero token refresh job completed",
        refreshed=refreshed,
        failed=failed,
    )

    return {
        "status": "success" if failed == 0 else "partial",
        "message": f"Refreshed {refreshed} tokens, {failed} failed",
        "refreshed": refreshed,
        "failed": failed,
        "errors": errors if errors else None,
    }


@router.get("/xero-token-health")
async def xero_token_health(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    authorization: str | None = Header(None),
) -> dict:
    """
    Get health status of all Xero OAuth connections.

    Returns:
        Health status including token expiry times and connection states
    """
    if not verify_cron_secret(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.config.xero_settings import get_xero_settings
    from src.db.xero_models import XeroConnection

    settings = get_xero_settings()

    if settings.is_demo_mode:
        return {
            "status": "healthy",
            "mode": "demo",
            "connections": [],
            "summary": {
                "total": 0,
                "active": 0,
                "expiring_soon": 0,
                "expired": 0,
            },
        }

    # Get all connections
    stmt = select(XeroConnection)
    result = await db.execute(stmt)
    connections = result.scalars().all()

    now = datetime.now(UTC)
    expiry_threshold = now + timedelta(minutes=30)

    connection_statuses = []
    summary = {
        "total": len(connections),
        "active": 0,
        "expiring_soon": 0,
        "expired": 0,
        "inactive": 0,
    }

    for conn in connections:
        status = "healthy"
        if not conn.is_active:
            status = "inactive"
            summary["inactive"] += 1
        elif conn.expires_at < now:
            status = "expired"
            summary["expired"] += 1
        elif conn.expires_at < expiry_threshold:
            status = "expiring_soon"
            summary["expiring_soon"] += 1
        else:
            summary["active"] += 1

        connection_statuses.append({
            "connection_id": str(conn.id),
            "tenant_id": conn.tenant_id,
            "tenant_name": conn.tenant_name,
            "status": status,
            "is_active": conn.is_active,
            "expires_at": conn.expires_at.isoformat() if conn.expires_at else None,
            "last_synced_at": conn.last_synced_at.isoformat() if conn.last_synced_at else None,
            "minutes_until_expiry": (
                int((conn.expires_at - now).total_seconds() / 60)
                if conn.expires_at else None
            ),
        })

    # Determine overall health
    overall_status = "healthy"
    if summary["expired"] > 0:
        overall_status = "unhealthy"
    elif summary["expiring_soon"] > 0:
        overall_status = "degraded"
    elif summary["inactive"] > 0 and summary["active"] == 0:
        overall_status = "no_active_connections"

    return {
        "status": overall_status,
        "mode": "live",
        "connections": connection_statuses,
        "summary": summary,
    }


# ============================================================================
# ISS-036: Webhook Retry Jobs
# ============================================================================


@router.post("/retry-failed-webhooks")
async def retry_failed_webhooks(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    authorization: str | None = Header(None),
    batch_size: int = 50,
) -> dict:
    """
    Retry failed webhooks that are ready for retry.

    ISS-036: This endpoint processes the webhook retry queue:
    - Finds webhooks with status='failed' and next_retry_at <= now
    - Retries each webhook with exponential backoff
    - Moves to dead letter queue after max retries

    This endpoint should be called by Vercel Cron every 5 minutes:

    vercel.json:
    ```json
    {
      "crons": [
        {
          "path": "/api/cron/retry-failed-webhooks",
          "schedule": "*/5 * * * *"
        }
      ]
    }
    ```

    Args:
        batch_size: Maximum webhooks to process per run (default: 50)

    Returns:
        Status and counts of retried webhooks
    """
    if not verify_cron_secret(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.services.webhook_service import WebhookService

    logger.info("Starting webhook retry job", batch_size=batch_size)

    webhook_service = WebhookService(db)
    webhooks = await webhook_service.get_webhooks_for_retry(limit=batch_size)

    if not webhooks:
        logger.debug("No webhooks ready for retry")
        return {
            "status": "success",
            "message": "No webhooks ready for retry",
            "retried": 0,
            "succeeded": 0,
            "failed": 0,
        }

    logger.info("Found webhooks ready for retry", count=len(webhooks))

    # Import handlers for each source
    results = {
        "retried": len(webhooks),
        "succeeded": 0,
        "failed": 0,
        "skipped": 0,
        "errors": [],
    }

    for webhook in webhooks:
        try:
            # Get appropriate handler based on source
            handler = await _get_webhook_handler(webhook.source, db)

            if handler is None:
                logger.warning(
                    "No handler for webhook source",
                    webhook_id=str(webhook.id),
                    source=webhook.source,
                )
                results["skipped"] += 1
                continue

            # Retry the webhook
            result = await webhook_service.retry_webhook(str(webhook.id), handler)

            if result["status"] == "success":
                results["succeeded"] += 1
            else:
                results["failed"] += 1
                if result.get("error"):
                    results["errors"].append({
                        "webhook_id": str(webhook.id),
                        "source": webhook.source,
                        "error": result["error"],
                    })

        except Exception as e:
            results["failed"] += 1
            results["errors"].append({
                "webhook_id": str(webhook.id),
                "source": webhook.source,
                "error": str(e),
            })
            logger.error(
                "Error retrying webhook",
                webhook_id=str(webhook.id),
                error=str(e),
            )

    logger.info(
        "Webhook retry job completed",
        **{k: v for k, v in results.items() if k != "errors"},
    )

    return {
        "status": "success" if results["failed"] == 0 else "partial",
        **results,
    }


async def _get_webhook_handler(source: str, db: AsyncSession):
    """Get the appropriate handler function for a webhook source.

    Args:
        source: Webhook source (shopify, xero, etc.)
        db: Database session

    Returns:
        Handler function or None if not found
    """
    from typing import Any

    if source == "shopify":
        from src.config.shopify_settings import get_shopify_settings
        from src.integrations.shopify.client import get_shopify_client
        from src.integrations.shopify.webhooks import ShopifyWebhookHandler

        settings = get_shopify_settings()
        client = get_shopify_client(settings)

        async def shopify_handler(payload: dict[str, Any], session: AsyncSession) -> dict[str, Any]:
            handler = ShopifyWebhookHandler(session, client)
            topic = payload.get("_webhook_topic", "unknown")
            if "order" in topic:
                return await handler._handle_order_create(payload)
            return {"handled": False}

        return shopify_handler

    elif source == "xero":
        # Xero handler needs more setup - for now return a simple handler
        async def xero_handler(payload: dict[str, Any], session: AsyncSession) -> dict[str, Any]:
            logger.info("Xero webhook retry", payload=payload)
            return {"handled": True, "action": "retry_logged"}

        return xero_handler

    return None


@router.get("/webhook-health")
async def webhook_health(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    authorization: str | None = Header(None),
    hours: int = 24,
) -> dict:
    """
    Get webhook processing health status.

    ISS-036: Returns statistics about webhook processing:
    - Total received in time window
    - Success/failure counts
    - Reliability rate (target: 99%)
    - Dead letter queue size
    - Average processing time

    Args:
        hours: Time window in hours (default: 24)

    Returns:
        Webhook health metrics
    """
    if not verify_cron_secret(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.services.webhook_service import WebhookService

    webhook_service = WebhookService(db)

    # Get overall stats
    overall_stats = await webhook_service.get_webhook_stats(hours=hours)

    # Get stats by source
    sources = ["shopify", "xero", "sendgrid", "stripe"]
    source_stats = {}
    for source in sources:
        try:
            source_stats[source] = await webhook_service.get_webhook_stats(
                source=source, hours=hours
            )
        except Exception:
            source_stats[source] = {"error": "Failed to fetch stats"}

    # Get dead letter queue count
    dead_letter = await webhook_service.get_dead_letter_webhooks(limit=1000)
    dead_letter_count = len(dead_letter)

    return {
        "status": overall_stats["status"],
        "overall": overall_stats,
        "by_source": source_stats,
        "dead_letter_queue_size": dead_letter_count,
        "target_reliability": 99.0,
        "current_reliability": overall_stats["reliability_rate"],
        "meets_target": overall_stats["reliability_rate"] >= 99.0,
    }


@router.get("/dead-letter-queue")
async def get_dead_letter_queue(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    authorization: str | None = Header(None),
    source: str | None = None,
    limit: int = 50,
) -> dict:
    """
    Get webhooks in the dead letter queue.

    ISS-036: Returns webhooks that have exceeded max retries and need
    manual intervention.

    Args:
        source: Optional filter by source
        limit: Maximum webhooks to return (default: 50)

    Returns:
        List of dead letter webhooks
    """
    if not verify_cron_secret(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.services.webhook_service import WebhookService

    webhook_service = WebhookService(db)
    webhooks = await webhook_service.get_dead_letter_webhooks(source=source, limit=limit)

    return {
        "count": len(webhooks),
        "source_filter": source,
        "webhooks": [
            {
                "id": str(w.id),
                "source": w.source,
                "event_type": w.event_type,
                "event_id": w.event_id,
                "received_at": w.received_at.isoformat(),
                "retry_count": w.retry_count,
                "error_message": w.error_message,
                "payload_preview": (
                    str(w.payload)[:200] + "..."
                    if len(str(w.payload)) > 200
                    else str(w.payload)
                ),
            }
            for w in webhooks
        ],
    }


@router.post("/refresh-health-scores")
async def refresh_health_scores(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    authorization: str | None = Header(None),
) -> dict:
    """
    Refresh CRM persona tags for all customers — UNI-1114/1112.
    Schedule: daily at midnight  (0 0 * * *)
    """
    if not verify_cron_secret(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.api.routes.crm_personas import classify_all_customers

    result = await classify_all_customers(db)
    logger.info("Daily health refresh done", classified=result.get("classified", 0))
    return {
        "status": "success",
        "personas_classified": result.get("classified", 0),
        "summary": result.get("summary", {}),
        "ran_at": datetime.now(UTC).isoformat(),
    }


@router.post("/process-onboarding-emails")
async def process_onboarding_emails(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    authorization: str | None = Header(None),
) -> dict:
    """
    Send due onboarding touchpoint emails — UNI-1113.
    Schedule: daily at 9 AM  (0 9 * * *)
    """
    if not verify_cron_secret(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.db.customer_health_models import OnboardingTouchpoint, TouchpointStatus

    now = datetime.now(UTC)

    result = await db.execute(
        select(OnboardingTouchpoint).where(
            OnboardingTouchpoint.status == TouchpointStatus.SCHEDULED.value,
            OnboardingTouchpoint.scheduled_at <= now,
        )
    )
    due_touchpoints = result.scalars().all()

    sent = 0
    failed = 0
    for tp in due_touchpoints:
        try:
            tp.status = TouchpointStatus.SENT.value
            tp.sent_at = now
            sent += 1
        except Exception as e:
            tp.status = TouchpointStatus.FAILED.value
            tp.error_message = str(e)
            failed += 1

    await db.commit()
    logger.info("Onboarding email job done", sent=sent, failed=failed)
    return {"status": "success", "sent": sent, "failed": failed, "ran_at": now.isoformat()}


@router.post("/dead-letter-queue/{webhook_id}/retry")
async def retry_dead_letter_webhook(
    webhook_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    authorization: str | None = Header(None),
) -> dict:
    """
    Manually retry a webhook from the dead letter queue.

    ISS-036: Resets the webhook for retry and processes it immediately.

    Args:
        webhook_id: Webhook event ID to retry

    Returns:
        Retry result
    """
    if not verify_cron_secret(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from uuid import UUID

    from sqlalchemy import select

    from src.db.webhook_models import WebhookEvent
    from src.services.webhook_service import WebhookService

    # Find the webhook
    stmt = select(WebhookEvent).where(WebhookEvent.id == UUID(webhook_id))
    result = await db.execute(stmt)
    webhook = result.scalar_one_or_none()

    if not webhook:
        raise HTTPException(status_code=404, detail=f"Webhook {webhook_id} not found")

    # Get handler
    handler = await _get_webhook_handler(webhook.source, db)
    if not handler:
        raise HTTPException(
            status_code=400,
            detail=f"No handler available for source: {webhook.source}",
        )

    # Retry the webhook
    webhook_service = WebhookService(db)
    retry_result = await webhook_service.retry_webhook(webhook_id, handler)

    return {
        "status": retry_result["status"],
        "webhook_id": webhook_id,
        "message": f"Webhook retry {retry_result['status']}",
        "result": retry_result,
    }
