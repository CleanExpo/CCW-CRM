"""
In-app notification API endpoints.

Provides per-user notification listing, unread count, and mark-as-read operations.
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.workflow_models import InAppNotification

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------


class NotificationResponse(BaseModel):
    """Response schema for an in-app notification."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    title: str
    message: str
    notification_type: str
    entity_type: str | None
    entity_id: str | None
    is_read: bool
    created_at: str

    @field_validator("id", "user_id", mode="before")
    @classmethod
    def coerce_required_uuid(cls, v: object) -> str:
        return str(v)

    @field_validator("entity_id", mode="before")
    @classmethod
    def coerce_optional_uuid(cls, v: object) -> str | None:
        if v is None:
            return None
        return str(v)

    @field_validator("created_at", mode="before")
    @classmethod
    def coerce_datetime(cls, v: object) -> str:
        if isinstance(v, datetime):
            return v.isoformat()
        return str(v)


class UnreadCountResponse(BaseModel):
    """Response for unread notification count."""

    count: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    user_id: UUID = Query(..., description="User ID to fetch notifications for"),
) -> list[NotificationResponse]:
    """
    List in-app notifications for a user.

    Returns up to 50 notifications ordered by creation date (newest first).
    """
    result = await db.execute(
        select(InAppNotification)
        .where(InAppNotification.user_id == user_id)
        .order_by(InAppNotification.created_at.desc())
        .limit(50)
    )
    notifications = result.scalars().all()

    logger.info("notifications_listed", user_id=str(user_id), count=len(notifications))
    return [NotificationResponse.model_validate(n) for n in notifications]


@router.get("/unread-count", response_model=UnreadCountResponse)
async def get_unread_count(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    user_id: UUID = Query(..., description="User ID to count unread notifications for"),
) -> UnreadCountResponse:
    """Return the count of unread notifications for a user."""
    result = await db.execute(
        select(InAppNotification).where(
            InAppNotification.user_id == user_id,
            InAppNotification.is_read == False,  # noqa: E712
        )
    )
    notifications = result.scalars().all()
    count = len(notifications)

    logger.info("notifications_unread_count", user_id=str(user_id), count=count)
    return UnreadCountResponse(count=count)


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> NotificationResponse:
    """Mark a single notification as read."""
    result = await db.execute(
        select(InAppNotification).where(InAppNotification.id == notification_id)
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification {notification_id} not found",
        )

    notification.is_read = True
    await db.commit()
    await db.refresh(notification)

    logger.info("notification_marked_read", notification_id=str(notification_id))
    return NotificationResponse.model_validate(notification)


@router.post("/read-all", response_model=dict)
async def mark_all_notifications_read(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    user_id: UUID = Query(..., description="User ID whose notifications to mark all as read"),
) -> dict:
    """Mark all unread notifications for a user as read."""
    await db.execute(
        update(InAppNotification)
        .where(
            InAppNotification.user_id == user_id,
            InAppNotification.is_read == False,  # noqa: E712
        )
        .values(is_read=True)
    )
    await db.commit()

    logger.info("notifications_all_marked_read", user_id=str(user_id))
    return {"status": "ok", "user_id": str(user_id)}
