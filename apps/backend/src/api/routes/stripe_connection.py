"""Stripe API connection management endpoints (UNI-1859).

Provides status checking, connection testing, and webhook configuration
for the Stripe integration.
"""

import os
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, HttpUrl

from src.api.deps import get_current_user
from src.integrations.stripe.client import StripeClient, StripeError

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/integrations/stripe", tags=["Stripe Connection"])

# Events required for the CCW webhook subscription
_DEFAULT_WEBHOOK_EVENTS = [
    "invoice.paid",
    "invoice.payment_failed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "checkout.session.completed",
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
]


def _get_client() -> StripeClient:
    """Instantiate the StripeClient, raising 503 if the key is absent."""
    key = os.getenv("STRIPE_SECRET_KEY")
    if not key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="STRIPE_SECRET_KEY is not configured",
        )
    try:
        return StripeClient(api_key=key)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))


class ConfigureWebhookRequest(BaseModel):
    url: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/status")
async def stripe_status(
    _current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Check Stripe connection status and return account info."""
    key = os.getenv("STRIPE_SECRET_KEY", "")
    if not key:
        return {"connected": False, "mode": None, "account_id": None, "capabilities": [], "error": "STRIPE_SECRET_KEY not set"}

    try:
        client = StripeClient(api_key=key)
        account = await client.get_account()
        mode = "test" if key.startswith("sk_test_") else "live"
        capabilities = list((account.get("capabilities") or {}).keys())
        return {
            "connected": True,
            "mode": mode,
            "account_id": account.get("id"),
            "capabilities": capabilities,
        }
    except (StripeError, Exception) as exc:
        return {"connected": False, "mode": None, "account_id": None, "capabilities": [], "error": str(exc)}


@router.post("/test-connection")
async def test_stripe_connection(
    _current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Explicitly test the Stripe connection and return full account details."""
    client = _get_client()
    try:
        account = await client.get_account()
        key = os.getenv("STRIPE_SECRET_KEY", "")
        return {
            "connected": True,
            "mode": "test" if key.startswith("sk_test_") else "live",
            "account_id": account.get("id"),
            "business_name": account.get("business_profile", {}).get("name"),
            "email": account.get("email"),
            "country": account.get("country"),
            "default_currency": account.get("default_currency"),
            "capabilities": list((account.get("capabilities") or {}).keys()),
        }
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.get("/webhook-endpoints")
async def list_webhook_endpoints(
    _current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """List all Stripe webhook endpoints configured on this account."""
    client = _get_client()
    try:
        endpoints = await client.list_webhooks()
        return {"count": len(endpoints), "endpoints": endpoints}
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.post("/configure-webhook", status_code=status.HTTP_201_CREATED)
async def configure_webhook(
    body: ConfigureWebhookRequest,
    _current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """Register the app's webhook URL with Stripe using the standard event set."""
    client = _get_client()
    try:
        endpoint = await client.create_webhook(url=body.url, events=_DEFAULT_WEBHOOK_EVENTS)
        logger.info("Stripe webhook registered", url=body.url, endpoint_id=endpoint.get("id"))
        return {
            "created": True,
            "endpoint_id": endpoint.get("id"),
            "url": endpoint.get("url"),
            "status": endpoint.get("status"),
            "subscribed_events": endpoint.get("enabled_events", _DEFAULT_WEBHOOK_EVENTS),
        }
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
