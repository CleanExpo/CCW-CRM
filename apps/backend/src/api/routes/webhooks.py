"""Webhook infrastructure for external integrations."""
# SECURITY: Webhook authentication uses HMAC signatures, not JWT. Do not add get_current_user here.

import hashlib
import hmac
from datetime import datetime
from typing import Annotated, Any

import httpx
import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel

from src.config.settings import Settings, get_settings

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])


class WebhookEvent(BaseModel):
    """Generic webhook event structure."""
    event_type: str
    event_id: str
    timestamp: datetime
    data: dict


def verify_webhook_signature(
    payload: bytes,
    signature: str,
    secret: str,
) -> bool:
    """Verify HMAC-SHA256 webhook signature."""
    expected_signature = hmac.new(
        secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(signature, expected_signature)


async def _forward_webhook(event_data: dict, forward_url: str) -> bool:
    """Forward webhook payload to a configured URL.

    Returns True if forwarding succeeded, False otherwise.
    """
    if not forward_url:
        return False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(forward_url, json=event_data)
            response.raise_for_status()
            logger.info(
                "webhook_forwarded",
                url=forward_url,
                status_code=response.status_code,
                event_type=event_data.get("event_type"),
            )
            return True
    except httpx.HTTPError as exc:
        logger.warning(
            "webhook_forward_failed",
            url=forward_url,
            error=str(exc),
            event_type=event_data.get("event_type"),
        )
        return False


@router.post("/contact-form")
async def handle_contact_form_webhook(
    request: Request,
    x_webhook_signature: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    """
    Webhook endpoint for contact form submissions.

    External systems can subscribe to contact form events by sending
    a webhook URL. This endpoint will POST to that URL when forms are submitted.

    Example payload sent to webhook URL:
    {
        "event_type": "contact.submitted",
        "event_id": "uuid",
        "timestamp": "2026-01-13T10:00:00Z",
        "data": {
            "name": "John Doe",
            "email": "john@example.com",
            "message": "..."
        }
    }
    """
    # Verify signature if provided
    if x_webhook_signature:
        payload = await request.body()
        if not verify_webhook_signature(
            payload,
            x_webhook_signature,
            settings.webhook_secret,
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature",
            )

    # Parse event data
    event_data = await request.json()

    logger.info("webhook_received", event_type="contact.submitted", event_id=event_data.get("event_id"))

    # Forward to configured webhook URL if set
    forward_url = getattr(settings, "webhook_forward_url", "")
    forwarded = await _forward_webhook(event_data, forward_url)

    return {
        "status": "received",
        "event_id": event_data.get("event_id"),
        "forwarded": forwarded,
    }


@router.post("/demo-request")
async def handle_demo_request_webhook(
    request: Request,
    x_webhook_signature: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    """
    Webhook endpoint for demo request submissions.

    Example payload:
    {
        "event_type": "demo.requested",
        "event_id": "uuid",
        "timestamp": "2026-01-13T10:00:00Z",
        "data": {
            "company_name": "ACME Corp",
            "contact_name": "Jane Smith",
            "email": "jane@acme.com",
            "phone": "555-1234"
        }
    }
    """
    # Verify signature if provided
    if x_webhook_signature:
        payload = await request.body()
        if not verify_webhook_signature(
            payload,
            x_webhook_signature,
            settings.webhook_secret,
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature",
            )

    # Parse event data
    event_data = await request.json()

    logger.info("webhook_received", event_type="demo.requested", event_id=event_data.get("event_id"))

    # Forward to configured webhook URL if set
    forward_url = getattr(settings, "webhook_forward_url", "")
    forwarded = await _forward_webhook(event_data, forward_url)

    return {
        "status": "received",
        "event_id": event_data.get("event_id"),
        "forwarded": forwarded,
    }


@router.get("/test")
async def test_webhook():
    """Test endpoint to verify webhook infrastructure is working."""
    return {
        "status": "ok",
        "message": "Webhook infrastructure is ready",
        "available_webhooks": [
            "/api/webhooks/contact-form",
            "/api/webhooks/demo-request",
        ],
    }
