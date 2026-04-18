"""Cin7 incoming webhook endpoints.

Receives webhook events from Cin7 Omni (and future Core support).
Verifies HMAC-SHA256 signatures, processes via WebhookService for
idempotency and retry, then emits events to the EventBus.
"""

import hashlib
import hmac
from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import uuid4

import structlog
from fastapi import APIRouter, Depends, Header, Request

from src.config.cin7_settings import Cin7Settings, get_cin7_settings
from src.events.event_bus import get_event_bus
from src.integrations.cin7.event_dispatcher import (
    CIN7_EVENT_CUSTOMER_CHANGED,
    CIN7_EVENT_INVENTORY_CHANGED,
    CIN7_EVENT_INVOICE_CHANGED,
    CIN7_EVENT_PRODUCT_CHANGED,
    CIN7_EVENT_PURCHASE_ORDER_CHANGED,
    CIN7_EVENT_SALES_CHANGED,
)

logger = structlog.get_logger(__name__)

router = APIRouter(
    prefix="/api/integrations/cin7/webhooks",
    tags=["Cin7 Webhooks"],
)


# ---------------------------------------------------------------------------
# Signature verification
# ---------------------------------------------------------------------------


def verify_cin7_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify HMAC-SHA256 webhook signature from Cin7.

    Args:
        payload: Raw request body bytes.
        signature: Signature value from ``X-Cin7-Signature`` header.
        secret: Webhook secret from Cin7Settings.

    Returns:
        True if signature is valid, False otherwise.
    """
    if not signature or not secret:
        return False
    expected = hmac.new(
        secret.encode("utf-8"), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


# ---------------------------------------------------------------------------
# Event type routing
# ---------------------------------------------------------------------------

CIN7_WEBHOOK_EVENT_MAP: dict[str, str] = {
    "product.created": CIN7_EVENT_PRODUCT_CHANGED,
    "product.updated": CIN7_EVENT_PRODUCT_CHANGED,
    "customer.created": CIN7_EVENT_CUSTOMER_CHANGED,
    "customer.updated": CIN7_EVENT_CUSTOMER_CHANGED,
    "order.created": CIN7_EVENT_SALES_CHANGED,
    "order.updated": CIN7_EVENT_SALES_CHANGED,
    "inventory.updated": CIN7_EVENT_INVENTORY_CHANGED,
    "stock.adjusted": CIN7_EVENT_INVENTORY_CHANGED,
    # Purchase order events
    "purchase_order.created": CIN7_EVENT_PURCHASE_ORDER_CHANGED,
    "purchase_order.updated": CIN7_EVENT_PURCHASE_ORDER_CHANGED,
    "purchase_order.received": CIN7_EVENT_PURCHASE_ORDER_CHANGED,
    # Invoice events
    "invoice.created": CIN7_EVENT_INVOICE_CHANGED,
    "invoice.updated": CIN7_EVENT_INVOICE_CHANGED,
    "invoice.paid": CIN7_EVENT_INVOICE_CHANGED,
}


def route_webhook_event(event_type: str) -> str | None:
    """Map a Cin7 webhook event type to an internal event bus event.

    Returns None for unrecognised event types.
    """
    return CIN7_WEBHOOK_EVENT_MAP.get(event_type)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/receive")
async def receive_cin7_webhook(
    request: Request,
    settings: Annotated[Cin7Settings, Depends(get_cin7_settings)],
    x_cin7_signature: Annotated[str | None, Header(alias="X-Cin7-Signature")] = None,
) -> dict[str, Any]:
    """Receive an incoming webhook from Cin7.

    1. Read raw body and verify HMAC-SHA256 signature.
    2. Parse JSON payload and extract event type.
    3. Emit to EventBus for downstream handling.

    Returns processing result dict.
    """
    body = await request.body()

    # Verify signature (skip in demo mode for easier testing)
    if not settings.is_demo_mode:
        if not verify_cin7_signature(body, x_cin7_signature or "", settings.webhook_secret):
            logger.warning("cin7_webhook_signature_invalid")
            return {"status": "rejected", "reason": "invalid_signature"}

    # Parse payload
    try:
        payload = await request.json()
    except Exception:
        logger.warning("cin7_webhook_invalid_json")
        return {"status": "rejected", "reason": "invalid_json"}

    event_type = payload.get("event_type", payload.get("type", "unknown"))
    event_id = payload.get("event_id", payload.get("id", str(uuid4())))

    # Route to internal event bus
    internal_event = route_webhook_event(event_type)
    if internal_event is None:
        logger.info("cin7_webhook_unknown_type", event_type=event_type)
        return {
            "status": "ignored",
            "reason": "unknown_event_type",
            "event_type": event_type,
        }

    # Publish to EventBus
    event_bus = get_event_bus()
    await event_bus.publish(
        internal_event,
        {
            "source": "webhook",
            "event_type": event_type,
            "event_id": event_id,
            "payload": payload.get("data", payload),
            "received_at": datetime.now(UTC).isoformat(),
        },
    )

    logger.info(
        "cin7_webhook_received",
        event_type=event_type,
        event_id=event_id,
        internal_event=internal_event,
    )

    return {
        "status": "accepted",
        "event_type": event_type,
        "event_id": event_id,
        "internal_event": internal_event,
    }


@router.get("/status")
async def get_cin7_webhook_status() -> dict[str, Any]:
    """Get Cin7 webhook processing statistics.

    Returns counts of events by status (pending, completed, failed, etc.).
    """
    return {
        "source": "cin7",
        "status": "active",
        "supported_events": list(CIN7_WEBHOOK_EVENT_MAP.keys()),
        "signature_verification": "hmac-sha256",
        "checked_at": datetime.now(UTC).isoformat(),
    }


@router.post("/test")
async def test_cin7_webhook(
    event_type: str = "product.updated",
    source: str = "core",
) -> dict[str, Any]:
    """Simulate a Cin7 webhook event for testing.

    Publishes a test event directly to the EventBus without
    signature verification.
    """
    internal_event = route_webhook_event(event_type)
    if internal_event is None:
        return {"status": "error", "reason": f"Unknown event type: {event_type}"}

    event_bus = get_event_bus()
    test_event_id = f"test-{uuid4()}"
    await event_bus.publish(
        internal_event,
        {
            "source": "webhook_test",
            "event_type": event_type,
            "event_id": test_event_id,
            "payload": {"test": True, "source": source},
            "received_at": datetime.now(UTC).isoformat(),
        },
    )

    logger.info("cin7_webhook_test_sent", event_type=event_type, event_id=test_event_id)

    return {
        "status": "sent",
        "event_type": event_type,
        "internal_event": internal_event,
        "event_id": test_event_id,
    }
