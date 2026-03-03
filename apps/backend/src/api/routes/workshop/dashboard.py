"""Workshop dashboard API routes."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.workshop_models import (
    BookingStatus,
    Equipment,
    EquipmentStatus,
    ReminderStatus,
    ServiceReminder,
    WorkshopBooking,
)

router = APIRouter(prefix="/api/workshop/dashboard", tags=["Workshop"])


@router.get("")
async def get_dashboard(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    location: str | None = Query(None),
) -> dict:
    """Workshop KPIs per location."""
    now = datetime.now(UTC)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    week_end = today_start + timedelta(days=7)

    # Today's bookings
    today_stmt = select(WorkshopBooking).where(
        WorkshopBooking.scheduled_date >= today_start,
        WorkshopBooking.scheduled_date < today_end,
        WorkshopBooking.status.notin_(["cancelled", "no_show"]),
    )
    if location:
        today_stmt = today_stmt.where(WorkshopBooking.location == location)
    today_result = await db.execute(today_stmt.order_by(WorkshopBooking.scheduled_date))
    today_bookings = today_result.scalars().all()

    # This week booking count
    week_stmt = select(func.count(WorkshopBooking.id)).where(
        WorkshopBooking.scheduled_date >= today_start,
        WorkshopBooking.scheduled_date < week_end,
        WorkshopBooking.status.notin_(["cancelled", "no_show"]),
    )
    if location:
        week_stmt = week_stmt.where(WorkshopBooking.location == location)
    week_count_result = await db.execute(week_stmt)
    week_count = week_count_result.scalar_one()

    # Overdue equipment count
    overdue_stmt = select(func.count(Equipment.id)).where(
        Equipment.status != EquipmentStatus.retired,
        Equipment.next_service_date <= now,
    )
    if location:
        overdue_stmt = overdue_stmt.where(Equipment.location == location)
    overdue_result = await db.execute(overdue_stmt)
    overdue_count = overdue_result.scalar_one()

    # Pending reminders count
    pending_reminders_stmt = select(func.count(ServiceReminder.id)).where(
        ServiceReminder.status == ReminderStatus.pending,
    )
    pending_reminders_result = await db.execute(pending_reminders_stmt)
    pending_reminders = pending_reminders_result.scalar_one()

    # Upcoming 30 days -- count by day
    thirty_end = today_start + timedelta(days=30)
    upcoming_stmt = select(WorkshopBooking.scheduled_date).where(
        WorkshopBooking.scheduled_date >= today_start,
        WorkshopBooking.scheduled_date < thirty_end,
        WorkshopBooking.status.notin_(["cancelled", "no_show"]),
    )
    if location:
        upcoming_stmt = upcoming_stmt.where(WorkshopBooking.location == location)
    upcoming_result = await db.execute(upcoming_stmt)
    upcoming_dates = upcoming_result.scalars().all()

    # Group by date
    upcoming_by_day: dict[str, int] = {}
    for d in upcoming_dates:
        day_str = d.strftime("%Y-%m-%d")
        upcoming_by_day[day_str] = upcoming_by_day.get(day_str, 0) + 1

    return {
        "location": location or "all",
        "today": {
            "bookings": [
                {
                    "id": str(b.id),
                    "booking_number": b.booking_number,
                    "equipment_id": str(b.equipment_id),
                    "contractor_id": str(b.contractor_id) if b.contractor_id else None,
                    "scheduled_date": b.scheduled_date.isoformat(),
                    "status": b.status,
                    "location": b.location,
                }
                for b in today_bookings
            ],
            "count": len(today_bookings),
        },
        "this_week": {
            "booking_count": week_count,
        },
        "overdue_equipment_count": overdue_count,
        "pending_reminders_count": pending_reminders,
        "upcoming_30_days": upcoming_by_day,
    }
