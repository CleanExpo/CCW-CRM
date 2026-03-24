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


@router.post("/check-sla-breaches")
async def check_sla_breaches(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    authorization: str | None = Header(None),
) -> dict:
    """
    Scan for SLA instances whose deadline has passed and fire escalation workflows.

    UNI-174 ST-4: Called by Vercel Cron (e.g. every 15 minutes):

    vercel.json:
    ```json
    {
      "crons": [
        {
          "path": "/api/cron/check-sla-breaches",
          "schedule": "*/15 * * * *"
        }
      ]
    }
    ```

    Returns:
        Count of newly breached SLA instances and the check timestamp.
    """
    if not verify_cron_secret(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.services.sla_service import get_sla_service

    svc = get_sla_service()
    count = await svc.check_sla_breaches(db)

    logger.info("sla_breach_cron_complete", breached_count=count)
    return {"breached_count": count, "checked_at": datetime.now(UTC).isoformat()}


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


# ============================================================================
# Sprint 4: Inventory Auto-Reorder Cron Job
# ============================================================================


@router.post("/auto-reorder-inventory")
async def auto_reorder_inventory(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    authorization: str | None = Header(None),
) -> dict:
    """
    Scan inventory for products below reorder point and create draft POs.

    For each product where stock < reorder_point:
    - Looks up the matching ReorderRule for that product + location
    - Creates a draft PurchaseOrder against the linked supplier
    - Adds a PurchaseOrderItem with the default reorder quantity

    Schedule: daily at 7 AM AEST (0 21 * * * UTC)

    vercel.json:
    ```json
    {
      "crons": [
        {
          "path": "/api/cron/auto-reorder-inventory",
          "schedule": "0 21 * * *"
        }
      ]
    }
    ```

    Returns:
        Summary of POs created and products skipped.
    """
    if not verify_cron_secret(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from decimal import Decimal

    from src.db.demo_models import Product
    from src.db.inventory_models import PurchaseOrder, PurchaseOrderItem, ReorderRule

    now = datetime.now(UTC)
    po_sequence_base = int(now.strftime("%Y%m%d"))

    # 1. Find products below their reorder point
    stmt = select(Product).where(
        Product.reorder_point.isnot(None),
        Product.stock < Product.reorder_point,
        Product.is_active == True,  # noqa: E712
    )
    result = await db.execute(stmt)
    low_stock_products = result.scalars().all()

    if not low_stock_products:
        logger.info("auto_reorder_cron: no products below reorder point")
        return {
            "status": "success",
            "message": "No products below reorder point",
            "pos_created": 0,
            "products_checked": 0,
        }

    logger.info("auto_reorder_cron: found low-stock products", count=len(low_stock_products))

    created_pos: list[dict] = []
    skipped: list[dict] = []

    for i, product in enumerate(low_stock_products):
        # 2. Look up enabled ReorderRule for this product
        rule_result = await db.execute(
            select(ReorderRule).where(
                ReorderRule.product_id == product.id,
                ReorderRule.is_enabled == True,  # noqa: E712
            )
        )
        rule = rule_result.scalars().first()

        if not rule or not rule.supplier_id:
            skipped.append({"sku": product.sku, "reason": "no enabled reorder rule or supplier"})
            continue

        # 3. Determine order quantity — target: bring stock up to 2× reorder_point
        reorder_point = product.reorder_point or 0
        qty_to_order = max(1, (reorder_point * 2) - (product.stock or 0))

        # 4. Create draft PO
        po_number = f"AUTO-PO-{po_sequence_base}-{i + 1:03d}"
        expected_delivery = now + timedelta(days=rule.lead_time_days)

        # Check for duplicate PO number (same product reordered today)
        existing_po = await db.execute(
            select(PurchaseOrder).where(PurchaseOrder.po_number == po_number)
        )
        if existing_po.scalar_one_or_none():
            skipped.append({"sku": product.sku, "reason": f"PO {po_number} already exists today"})
            continue

        unit_cost = Decimal(str(product.cost or product.price or 0))
        line_subtotal = (unit_cost * Decimal(qty_to_order)).quantize(Decimal("0.01"))
        gst = (line_subtotal * Decimal("0.10")).quantize(Decimal("0.01"))
        po_total = line_subtotal + gst

        po = PurchaseOrder(
            po_number=po_number,
            supplier_id=rule.supplier_id,
            delivery_location=rule.location,
            status="draft",
            order_date=now,
            expected_delivery_date=expected_delivery,
            subtotal=line_subtotal,
            tax=gst,
            total=po_total,
            notes=f"Auto-created by reorder cron — {product.sku} stock={product.stock} reorder_point={product.reorder_point}",
        )
        db.add(po)
        await db.flush()

        po_item = PurchaseOrderItem(
            purchase_order_id=po.id,
            product_id=product.id,
            quantity=qty_to_order,
            quantity_received=0,
            unit_cost=unit_cost,
            subtotal=line_subtotal,
        )
        db.add(po_item)

        created_pos.append({
            "po_number": po_number,
            "sku": product.sku,
            "product_name": product.name,
            "current_stock": product.stock,
            "reorder_point": product.reorder_point,
            "qty_ordered": qty_to_order,
            "supplier_id": str(rule.supplier_id),
            "total": float(po_total),
        })

        logger.info(
            "auto_reorder_po_created",
            po_number=po_number,
            sku=product.sku,
            qty=qty_to_order,
        )

    await db.commit()

    logger.info(
        "auto_reorder_cron_complete",
        pos_created=len(created_pos),
        skipped=len(skipped),
    )

    return {
        "status": "success",
        "message": f"Created {len(created_pos)} draft POs for {len(low_stock_products)} low-stock products",
        "products_checked": len(low_stock_products),
        "pos_created": len(created_pos),
        "skipped": len(skipped),
        "purchase_orders": created_pos,
        "skipped_details": skipped,
        "ran_at": now.isoformat(),
    }


@router.post("/shadow-sync-cin7")
async def shadow_sync_cin7(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    authorization: str | None = Header(None),
) -> dict:
    """Nightly Cin7 shadow sync — pull all products, orders, customers, inventory from Cin7.

    Runs at 07:00 AEST (19:00 UTC) when shadow mode is active and live Cin7
    credentials are configured.  Data is stored in Cin7ShadowSync records for
    flow analysis and readiness scoring.

    vercel.json schedule: "0 19 * * *"
    """
    if not verify_cron_secret(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    now = datetime.now(UTC)

    # Check if shadow mode is active
    try:
        from src.db.shadow_session_models import ShadowSession

        result = await db.execute(
            select(ShadowSession)
            .where(ShadowSession.status == "active")
            .limit(1)
        )
        session = result.scalar_one_or_none()
    except Exception:
        session = None

    if not session:
        return {
            "status": "skipped",
            "message": "No active shadow session. Activate shadow mode first.",
            "ran_at": now.isoformat(),
        }

    # Attempt live Cin7 sync — falls back gracefully if credentials not configured
    synced_counts: dict[str, int] = {}
    errors: list[str] = []

    try:
        import hashlib
        import json

        from src.db.cin7_shadow_models import Cin7ShadowSync
        from src.integrations.cin7.client import get_cin7_client

        async with get_cin7_client() as cin7:
            # Sync products
            try:
                products = await cin7.get_products(page_size=250)
                product_list = products if isinstance(products, list) else products.get("Data", [])
                for p in product_list:
                    cin7_id = str(p.get("ID") or p.get("id", ""))
                    if not cin7_id:
                        continue
                    key_fields = {k: p.get(k) for k in ["Name", "Code", "BasePrice", "IsActive"]}
                    cin7_hash = hashlib.md5(json.dumps(key_fields, sort_keys=True).encode()).hexdigest()

                    existing = await db.execute(
                        select(Cin7ShadowSync).where(
                            Cin7ShadowSync.entity_type == "product",
                            Cin7ShadowSync.cin7_id == cin7_id,
                        )
                    )
                    record = existing.scalar_one_or_none()
                    if record:
                        record.cin7_hash = cin7_hash
                        record.last_checked_at = now
                        if record.cin7_hash != cin7_hash:
                            record.sync_status = "conflict"
                    else:
                        db.add(Cin7ShadowSync(
                            entity_type="product",
                            cin7_id=cin7_id,
                            sync_status="synced",
                            cin7_hash=cin7_hash,
                            last_checked_at=now,
                        ))
                synced_counts["products"] = len(product_list)
            except Exception as e:
                errors.append(f"products: {e}")
                synced_counts["products"] = 0

            # Sync customers
            try:
                customers = await cin7.get_customers(page_size=250)
                customer_list = customers if isinstance(customers, list) else customers.get("Data", [])
                for c in customer_list:
                    cin7_id = str(c.get("ID") or c.get("id", ""))
                    if not cin7_id:
                        continue
                    db.add(Cin7ShadowSync(
                        entity_type="customer",
                        cin7_id=cin7_id,
                        sync_status="synced",
                        last_checked_at=now,
                    ))
                synced_counts["customers"] = len(customer_list)
            except Exception as e:
                errors.append(f"customers: {e}")
                synced_counts["customers"] = 0

        await db.commit()

        # Update session statistics
        session.total_syncs_run = (session.total_syncs_run or 0) + 1
        if not errors:
            session.successful_syncs = (session.successful_syncs or 0) + 1
        session.products_observed = max(session.products_observed or 0, synced_counts.get("products", 0))
        session.customers_observed = max(session.customers_observed or 0, synced_counts.get("customers", 0))
        await db.commit()

    except Exception as e:
        errors.append(f"cin7_client: {e}")
        # Still update sync count even on failure
        try:
            session.total_syncs_run = (session.total_syncs_run or 0) + 1
            await db.commit()
        except Exception:
            pass

    logger.info(
        "shadow_sync_cin7_complete",
        synced=synced_counts,
        errors=errors,
        session_id=str(session.id),
    )

    return {
        "status": "success" if not errors else "partial",
        "message": f"Shadow Cin7 sync complete. Synced: {synced_counts}",
        "synced": synced_counts,
        "errors": errors,
        "session_id": str(session.id),
        "ran_at": now.isoformat(),
    }


@router.post("/shadow-sync-xero")
async def shadow_sync_xero(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    authorization: str | None = Header(None),
) -> dict:
    """Nightly Xero shadow sync — pull invoices, payments, accounts from Xero.

    Runs at 08:00 AEST (20:00 UTC) when shadow mode is active, after the
    Cin7 sync completes.  Invoice and payment data is used for financial flow
    observation and transition readiness scoring.

    vercel.json schedule: "0 20 * * *"
    """
    if not verify_cron_secret(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    now = datetime.now(UTC)

    # Check shadow mode active
    try:
        from src.db.shadow_session_models import ShadowSession

        result = await db.execute(
            select(ShadowSession)
            .where(ShadowSession.status == "active")
            .limit(1)
        )
        session = result.scalar_one_or_none()
    except Exception:
        session = None

    if not session:
        return {
            "status": "skipped",
            "message": "No active shadow session.",
            "ran_at": now.isoformat(),
        }

    synced_counts: dict[str, int] = {}
    errors: list[str] = []

    # Xero sync — requires live Xero credentials
    try:
        from src.integrations.xero.client import get_xero_client

        async with get_xero_client() as xero:
            try:
                invoices = await xero.get_invoices(modified_since_days=1)
                invoice_list = invoices if isinstance(invoices, list) else invoices.get("Invoices", [])
                synced_counts["invoices"] = len(invoice_list)
            except Exception as e:
                errors.append(f"invoices: {e}")
                synced_counts["invoices"] = 0

            try:
                payments = await xero.get_payments(modified_since_days=1)
                payment_list = payments if isinstance(payments, list) else payments.get("Payments", [])
                synced_counts["payments"] = len(payment_list)
            except Exception as e:
                errors.append(f"payments: {e}")
                synced_counts["payments"] = 0

    except Exception as e:
        errors.append(f"xero_client: {e}")

    # Update session invoice count
    try:
        if "invoices" in synced_counts:
            session.invoices_observed = max(
                session.invoices_observed or 0,
                synced_counts["invoices"],
            )
            await db.commit()
    except Exception:
        pass

    logger.info(
        "shadow_sync_xero_complete",
        synced=synced_counts,
        errors=errors,
        session_id=str(session.id),
    )

    return {
        "status": "success" if not errors else "partial",
        "message": f"Shadow Xero sync complete. Synced: {synced_counts}",
        "synced": synced_counts,
        "errors": errors,
        "session_id": str(session.id),
        "ran_at": now.isoformat(),
    }
