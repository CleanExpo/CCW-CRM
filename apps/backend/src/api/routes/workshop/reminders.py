"""Workshop reminders API routes."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.workshop_models import ReminderStatus, ServiceReminder
from src.services.workshop_scheduler import generate_reminders, get_due_equipment

router = APIRouter(prefix="/api/workshop/reminders", tags=["Workshop"])


class ReminderResponse(BaseModel):
    id: UUID
    equipment_id: UUID
    customer_id: UUID
    reminder_type: str
    scheduled_send_at: datetime
    status: str
    sent_at: datetime | None
    booking_id: UUID | None
    email_subject: str | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class PaginatedRemindersResponse(BaseModel):
    items: list[ReminderResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("")
async def list_reminders(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    status: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> PaginatedRemindersResponse:
    """List service reminders."""
    stmt = select(ServiceReminder)
    if status:
        stmt = stmt.where(ServiceReminder.status == status)
    if date_from:
        stmt = stmt.where(ServiceReminder.scheduled_send_at >= date_from)
    if date_to:
        stmt = stmt.where(ServiceReminder.scheduled_send_at <= date_to)

    total_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = total_result.scalar_one()

    stmt = stmt.order_by(ServiceReminder.scheduled_send_at.asc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    reminders = result.scalars().all()

    return PaginatedRemindersResponse(
        items=[ReminderResponse.model_validate(r) for r in reminders],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("/generate")
async def generate_all_reminders(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    days_ahead: int = Query(90, ge=1, le=365),
) -> dict:
    """Generate reminders for all equipment due within days_ahead."""
    due_equipment = await get_due_equipment(db, days_ahead=days_ahead)
    total_created = 0
    for equipment in due_equipment:
        created = await generate_reminders(db, equipment.id)
        total_created += len(created)
    await db.commit()
    return {"message": f"Generated {total_created} reminders for {len(due_equipment)} equipment", "reminders_created": total_created}


@router.post("/{reminder_id}/send")
async def send_reminder(
    reminder_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Send a single reminder now (marks as sent)."""
    reminder = await db.get(ServiceReminder, reminder_id)
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    # In production this would call EmailNotificationService
    reminder.status = ReminderStatus.sent
    reminder.sent_at = datetime.now(UTC)
    reminder.updated_at = datetime.now(UTC)
    await db.commit()

    return {"message": "Reminder sent", "reminder_id": str(reminder_id)}


@router.post("/send-pending")
async def send_pending_reminders(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Batch send all pending reminders scheduled for now or earlier."""
    now = datetime.now(UTC)
    result = await db.execute(
        select(ServiceReminder).where(
            ServiceReminder.status == ReminderStatus.pending,
            ServiceReminder.scheduled_send_at <= now,
        )
    )
    pending = result.scalars().all()

    sent_count = 0
    for reminder in pending:
        # In production: call EmailNotificationService
        reminder.status = ReminderStatus.sent
        reminder.sent_at = now
        reminder.updated_at = now
        sent_count += 1

    await db.commit()
    return {"message": f"Sent {sent_count} pending reminders", "sent_count": sent_count}


@router.put("/{reminder_id}/suppress")
async def suppress_reminder(
    reminder_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Suppress a reminder."""
    reminder = await db.get(ServiceReminder, reminder_id)
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    reminder.status = ReminderStatus.suppressed
    reminder.updated_at = datetime.now(UTC)
    await db.commit()
    return {"message": "Reminder suppressed"}
