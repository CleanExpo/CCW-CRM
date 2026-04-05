"""Cin7 webhook subscription management CRUD.

Programmatic management of Cin7 webhook subscriptions:
create, list, get, update (toggle active), and soft-delete.
"""

from datetime import UTC, datetime
from typing import Annotated, Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.cin7_models import Cin7WebhookSubscription

logger = structlog.get_logger(__name__)

router = APIRouter(
    prefix="/api/cin7/webhook-subscriptions",
    tags=["Cin7 Webhook Subscriptions"],
)


# ---------------------------------------------------------------------------
# Pydantic request / response schemas
# ---------------------------------------------------------------------------


class WebhookSubscriptionCreate(BaseModel):
    """Request body for creating a webhook subscription."""

    event_type: str = Field(..., min_length=1, max_length=100)
    endpoint_url: str = Field(..., min_length=1)
    secret_key: str | None = None


class WebhookSubscriptionUpdate(BaseModel):
    """Request body for updating a webhook subscription."""

    is_active: bool | None = None
    endpoint_url: str | None = None
    secret_key: str | None = None


class WebhookSubscriptionResponse(BaseModel):
    """Response model for a webhook subscription."""

    id: str
    event_type: str
    endpoint_url: str
    is_active: bool
    secret_key: str | None = None
    last_triggered_at: str | None = None
    trigger_count: int
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


def _to_response(sub: Cin7WebhookSubscription) -> dict[str, Any]:
    """Convert a Cin7WebhookSubscription ORM instance to a response dict."""
    return {
        "id": str(sub.id),
        "event_type": sub.event_type,
        "endpoint_url": sub.endpoint_url,
        "is_active": sub.is_active,
        "secret_key": sub.secret_key,
        "last_triggered_at": sub.last_triggered_at.isoformat() if sub.last_triggered_at else None,
        "trigger_count": sub.trigger_count,
        "created_at": sub.created_at.isoformat() if sub.created_at else None,
        "updated_at": sub.updated_at.isoformat() if sub.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("")
async def create_webhook_subscription(
    body: WebhookSubscriptionCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict[str, Any]:
    """Create a new Cin7 webhook subscription."""
    logger.info(
        "cin7_webhook_subscription_create",
        event_type=body.event_type,
        endpoint_url=body.endpoint_url,
    )

    subscription = Cin7WebhookSubscription(
        event_type=body.event_type,
        endpoint_url=body.endpoint_url,
        secret_key=body.secret_key,
    )
    db.add(subscription)
    await db.commit()
    await db.refresh(subscription)

    return _to_response(subscription)


@router.get("")
async def list_webhook_subscriptions(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    is_active: bool | None = Query(None, description="Filter by active status"),
) -> list[dict[str, Any]]:
    """List all Cin7 webhook subscriptions, optionally filtered by is_active."""
    stmt = select(Cin7WebhookSubscription).order_by(
        Cin7WebhookSubscription.created_at.desc()
    )
    if is_active is not None:
        stmt = stmt.where(Cin7WebhookSubscription.is_active == is_active)

    result = await db.execute(stmt)
    subscriptions = result.scalars().all()

    return [_to_response(sub) for sub in subscriptions]


@router.get("/{subscription_id}")
async def get_webhook_subscription(
    subscription_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict[str, Any]:
    """Get a single Cin7 webhook subscription by ID."""
    sub = await db.get(Cin7WebhookSubscription, str(subscription_id))
    if sub is None:
        raise HTTPException(status_code=404, detail="Webhook subscription not found")
    return _to_response(sub)


@router.patch("/{subscription_id}")
async def update_webhook_subscription(
    subscription_id: UUID,
    body: WebhookSubscriptionUpdate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict[str, Any]:
    """Update a Cin7 webhook subscription (is_active, endpoint_url, secret_key)."""
    sub = await db.get(Cin7WebhookSubscription, str(subscription_id))
    if sub is None:
        raise HTTPException(status_code=404, detail="Webhook subscription not found")

    if body.is_active is not None:
        sub.is_active = body.is_active
    if body.endpoint_url is not None:
        sub.endpoint_url = body.endpoint_url
    if body.secret_key is not None:
        sub.secret_key = body.secret_key

    sub.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(sub)

    logger.info(
        "cin7_webhook_subscription_updated",
        subscription_id=str(subscription_id),
        is_active=sub.is_active,
    )

    return _to_response(sub)


@router.delete("/{subscription_id}")
async def delete_webhook_subscription(
    subscription_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict[str, Any]:
    """Soft-delete a Cin7 webhook subscription (sets is_active=False)."""
    sub = await db.get(Cin7WebhookSubscription, str(subscription_id))
    if sub is None:
        raise HTTPException(status_code=404, detail="Webhook subscription not found")

    sub.is_active = False
    sub.updated_at = datetime.now(UTC)
    await db.commit()

    logger.info(
        "cin7_webhook_subscription_deleted",
        subscription_id=str(subscription_id),
    )

    return {"status": "deleted", "id": str(subscription_id)}
