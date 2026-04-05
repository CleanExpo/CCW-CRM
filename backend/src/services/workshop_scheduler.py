"""Workshop scheduler service -- dual-interval service computation and automation."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from dateutil.relativedelta import relativedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.workshop_models import (
    Equipment,
    EquipmentStatus,
    ReminderStatus,
    ServiceReminder,
    WorkshopBooking,
)
from src.utils import get_logger

logger = get_logger(__name__)

REMINDER_LEAD_DAYS = [90, 30, 7]
REMINDER_TYPE_MAP = {90: "90_day", 30: "30_day", 7: "7_day"}


def compute_next_service(equipment: Equipment) -> tuple[datetime | None, float | None]:
    """Dual-interval logic: calendar AND hours -- whichever triggers first."""
    date_target: datetime | None = None
    hours_target: float | None = None

    if equipment.interval_months and equipment.last_service_date:
        date_target = equipment.last_service_date + relativedelta(months=equipment.interval_months)

    if equipment.interval_hours is not None and equipment.last_service_hours is not None:
        hours_target = equipment.last_service_hours + equipment.interval_hours

    return date_target, hours_target


async def get_due_equipment(
    db: AsyncSession,
    location: str | None = None,
    days_ahead: int = 90,
) -> list[Equipment]:
    """Equipment with next_service_date <= today + days_ahead."""
    cutoff = datetime.now(UTC) + timedelta(days=days_ahead)
    stmt = select(Equipment).where(
        Equipment.status != EquipmentStatus.retired,
        Equipment.next_service_date <= cutoff,
    )
    if location:
        stmt = stmt.where(Equipment.location == location)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_overdue_equipment(
    db: AsyncSession,
    location: str | None = None,
) -> list[Equipment]:
    """Equipment past next_service_date with no active booking."""
    now = datetime.now(UTC)
    active_statuses = ["scheduled", "confirmed", "in_progress"]
    # Subquery: equipment_ids with active bookings
    active_bookings_stmt = (
        select(WorkshopBooking.equipment_id)
        .where(WorkshopBooking.status.in_(active_statuses))
    )
    stmt = select(Equipment).where(
        Equipment.status != EquipmentStatus.retired,
        Equipment.next_service_date <= now,
        Equipment.id.notin_(active_bookings_stmt),
    )
    if location:
        stmt = stmt.where(Equipment.location == location)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def generate_reminders(
    db: AsyncSession,
    equipment_id: UUID,
) -> list[ServiceReminder]:
    """Creates ServiceReminder records at 90/30/7 days before next_service_date. Idempotent."""
    equip_result = await db.get(Equipment, equipment_id)
    if not equip_result or not equip_result.next_service_date:
        return []

    equipment = equip_result
    created = []

    for days in REMINDER_LEAD_DAYS:
        reminder_type = REMINDER_TYPE_MAP[days]
        send_at = equipment.next_service_date - timedelta(days=days)

        # Idempotency: skip if pending/sent reminder of same type already exists
        existing = await db.execute(
            select(ServiceReminder).where(
                ServiceReminder.equipment_id == equipment_id,
                ServiceReminder.reminder_type == reminder_type,
                ServiceReminder.status.in_(["pending", "sent"]),
            )
        )
        if existing.scalars().first():
            continue

        subject = (
            f"Your {equipment.make} {equipment.model} service is due in {days} days"
        )
        reminder = ServiceReminder(
            equipment_id=equipment_id,
            customer_id=equipment.customer_id,
            reminder_type=reminder_type,
            scheduled_send_at=send_at,
            status=ReminderStatus.pending,
            email_subject=subject,
        )
        db.add(reminder)
        created.append(reminder)

    await db.flush()
    return created


async def generate_overdue_reminder(
    db: AsyncSession,
    equipment_id: UUID,
) -> ServiceReminder | None:
    """Create an overdue reminder if none exists."""
    equip_result = await db.get(Equipment, equipment_id)
    if not equip_result:
        return None

    equipment = equip_result
    existing = await db.execute(
        select(ServiceReminder).where(
            ServiceReminder.equipment_id == equipment_id,
            ServiceReminder.reminder_type == "overdue",
            ServiceReminder.status.in_(["pending", "sent"]),
        )
    )
    if existing.scalars().first():
        return None

    reminder = ServiceReminder(
        equipment_id=equipment_id,
        customer_id=equipment.customer_id,
        reminder_type="overdue",
        scheduled_send_at=datetime.now(UTC),
        status=ReminderStatus.pending,
        email_subject=f"OVERDUE: Your {equipment.make} {equipment.model} service is overdue",
    )
    db.add(reminder)
    await db.flush()
    return reminder


def build_reminder_email(
    reminder: ServiceReminder,
    equipment: Equipment,
    customer_email: str,
    customer_name: str,
    template_description: str = "",
    template_hours: float = 0.0,
    location: str = "",
) -> dict:
    """Build subject + HTML body for reminder email."""
    days_map = {"90_day": 90, "30_day": 30, "7_day": 7, "overdue": 0}
    days = days_map.get(reminder.reminder_type, 0)

    location_addresses = {
        "brisbane": "CCW Brisbane Workshop, Brisbane QLD",
        "sydney": "CCW Sydney Workshop, Sydney NSW",
        "melbourne": "CCW Melbourne Workshop, Melbourne VIC",
    }
    address = location_addresses.get(location.lower(), "your nearest CCW workshop")

    if reminder.reminder_type == "overdue":
        subject = f"ACTION REQUIRED: Your {equipment.make} {equipment.model} service is overdue"
        urgency = "Your machine is now <strong>overdue for service</strong>."
    else:
        subject = f"Your {equipment.make} {equipment.model} service is due in {days} days -- {location.title()} Workshop"
        urgency = f"Your machine is due for service in <strong>{days} days</strong>."

    html_body = f"""
<html><body>
<h2>Service Reminder -- {equipment.make} {equipment.model}</h2>
<p>Dear {customer_name},</p>
<p>{urgency}</p>
<table>
  <tr><td><strong>Machine:</strong></td><td>{equipment.make} {equipment.model}</td></tr>
  <tr><td><strong>Serial Number:</strong></td><td>{equipment.serial_number}</td></tr>
  {"<tr><td><strong>Service Includes:</strong></td><td>" + template_description + "</td></tr>" if template_description else ""}
  {"<tr><td><strong>Estimated Workshop Time:</strong></td><td>" + str(template_hours) + " hours</td></tr>" if template_hours else ""}
  <tr><td><strong>Workshop Location:</strong></td><td>{address}</td></tr>
</table>
<p><em>We are pre-ordering parts in advance to minimise your machine downtime.</em></p>
<p><strong>Call us to book your service appointment.</strong></p>
<br><p>CCW Equipment Services</p>
</body></html>
"""
    return {"to": customer_email, "subject": subject, "html_body": html_body}
