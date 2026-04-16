"""Webhook infrastructure for external integrations."""

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

    logger.info(
        "contact_form_webhook_received",
        event_type=event_data.get("event_type"),
        event_id=event_data.get("event_id"),
    )

    # Forward to configured webhook URL if set
    if settings.webhook_contact_form_url:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(settings.webhook_contact_form_url, json=event_data)
                logger.info(
                    "contact_form_webhook_forwarded",
                    forward_url=settings.webhook_contact_form_url,
                    status_code=resp.status_code,
                )
        except Exception as exc:
            logger.error("contact_form_webhook_forward_failed", error=str(exc))

    return {"status": "received", "event_id": event_data.get("event_id")}


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

    logger.info(
        "demo_request_webhook_received",
        event_type=event_data.get("event_type"),
        event_id=event_data.get("event_id"),
        company=event_data.get("data", {}).get("company_name"),
    )

    # Forward to configured webhook URL if set
    if settings.webhook_demo_request_url:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(settings.webhook_demo_request_url, json=event_data)
                logger.info(
                    "demo_request_webhook_forwarded",
                    forward_url=settings.webhook_demo_request_url,
                    status_code=resp.status_code,
                )
        except Exception as exc:
            logger.error("demo_request_webhook_forward_failed", error=str(exc))

    return {"status": "received", "event_id": event_data.get("event_id")}


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
