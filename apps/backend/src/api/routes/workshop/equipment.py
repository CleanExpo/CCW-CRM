"""Workshop equipment registry API routes."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.workshop_models import (
    Equipment,
    EquipmentServiceHistory,
    EquipmentStatus,
    ServiceReminder,
    WorkshopBooking,
)
from src.services.workshop_scheduler import compute_next_service, generate_reminders

router = APIRouter(prefix="/api/workshop/equipment", tags=["Workshop"])


_ACL_WARRANTY_DAYS = 365  # ACL s.54 — 12-month (365-day) minimum


def _check_acl_warranty(purchase_date: datetime | None, warranty_expiry: datetime | None) -> None:
    """Raise ValueError if warranty_expiry is less than 12 months after purchase_date.

    ACL s.54 requires goods to carry a minimum 12-month statutory guarantee.
    When both dates are provided, the warranty window must be >= 365 days.
    When only warranty_expiry is provided (no purchase_date), we check that
    the expiry is at least 12 months from today — preventing staff from
    registering a warranty that is already sub-statutory on creation.
    """
    if warranty_expiry is None:
        return
    reference = purchase_date if purchase_date else datetime.now(UTC)
    # Normalise both to UTC-naive for delta comparison
    exp = warranty_expiry.replace(tzinfo=None) if warranty_expiry.tzinfo else warranty_expiry
    ref = reference.replace(tzinfo=None) if reference.tzinfo else reference
    if (exp - ref).days < _ACL_WARRANTY_DAYS:
        raise ValueError(
            "warranty_expiry must be at least 12 months after the purchase date "
            "(ACL s.54 — minimum statutory guarantee period)."
        )


class EquipmentCreate(BaseModel):
    customer_id: UUID
    product_id: UUID | None = None
    serial_number: str = Field(min_length=1, max_length=100)
    make: str = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=200)
    year: int | None = None
    location: str = Field(min_length=1, max_length=50)
    purchase_date: datetime | None = None
    warranty_expiry: datetime | None = None
    interval_months: int | None = None
    interval_hours: float | None = None
    current_hours: float = 0.0
    last_service_date: datetime | None = None
    last_service_hours: float | None = None
    reminder_lead_days: int = 90
    notes: str | None = None

    @model_validator(mode="after")
    def acl_minimum_warranty_expiry(self) -> "EquipmentCreate":
        _check_acl_warranty(self.purchase_date, self.warranty_expiry)
        return self


class EquipmentUpdate(BaseModel):
    serial_number: str | None = None
    make: str | None = None
    model: str | None = None
    year: int | None = None
    location: str | None = None
    purchase_date: datetime | None = None
    warranty_expiry: datetime | None = None
    status: EquipmentStatus | None = None
    interval_months: int | None = None
    interval_hours: float | None = None
    last_service_date: datetime | None = None
    last_service_hours: float | None = None
    reminder_lead_days: int | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def acl_minimum_warranty_expiry(self) -> "EquipmentUpdate":
        _check_acl_warranty(self.purchase_date, self.warranty_expiry)
        return self


class EquipmentResponse(BaseModel):
    id: UUID
    customer_id: UUID
    product_id: UUID | None
    serial_number: str
    make: str
    model: str
    year: int | None
    location: str
    purchase_date: datetime | None
    warranty_expiry: datetime | None
    status: str
    interval_months: int | None
    interval_hours: float | None
    current_hours: float
    last_service_date: datetime | None
    last_service_hours: float | None
    next_service_date: datetime | None
    next_service_hours: float | None
    reminder_lead_days: int
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedEquipmentResponse(BaseModel):
    items: list[EquipmentResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class UpdateHoursRequest(BaseModel):
    current_hours: float = Field(ge=0)


class RecordServiceRequest(BaseModel):
    service_date: datetime
    service_type: str
    technician: str | None = None
    hours_at_service: float | None = None
    notes: str | None = None
    parts_used: dict | None = None


@router.get("")
async def list_equipment(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    customer_id: UUID | None = None,
    location: str | None = None,
    status: str | None = None,
    overdue_only: bool = False,
    search: str | None = None,
) -> PaginatedEquipmentResponse:
    """List equipment with filters."""
    stmt = select(Equipment)

    if customer_id:
        stmt = stmt.where(Equipment.customer_id == customer_id)
    if location:
        stmt = stmt.where(Equipment.location == location)
    if status:
        stmt = stmt.where(Equipment.status == status)
    if overdue_only:
        now = datetime.now(UTC)
        stmt = stmt.where(Equipment.next_service_date <= now, Equipment.status != EquipmentStatus.retired)
    if search:
        term = f"%{search}%"
        stmt = stmt.where(
            or_(
                Equipment.serial_number.ilike(term),
                Equipment.make.ilike(term),
                Equipment.model.ilike(term),
            )
        )

    total_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = total_result.scalar_one()

    stmt = stmt.order_by(Equipment.next_service_date.asc().nullslast()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    items = result.scalars().all()

    return PaginatedEquipmentResponse(
        items=[EquipmentResponse.model_validate(e) for e in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{equipment_id}")
async def get_equipment(
    equipment_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Get equipment detail with history and reminders."""
    equipment = await db.get(Equipment, equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    history_result = await db.execute(
        select(EquipmentServiceHistory)
        .where(EquipmentServiceHistory.equipment_id == equipment_id)
        .order_by(EquipmentServiceHistory.service_date.desc())
        .limit(20)
    )
    history = history_result.scalars().all()

    reminders_result = await db.execute(
        select(ServiceReminder)
        .where(ServiceReminder.equipment_id == equipment_id)
        .order_by(ServiceReminder.scheduled_send_at.asc())
        .limit(10)
    )
    reminders = reminders_result.scalars().all()

    bookings_result = await db.execute(
        select(WorkshopBooking)
        .where(WorkshopBooking.equipment_id == equipment_id)
        .order_by(WorkshopBooking.scheduled_date.desc())
        .limit(10)
    )
    bookings = bookings_result.scalars().all()

    return {
        "equipment": EquipmentResponse.model_validate(equipment),
        "service_history": [
            {
                "id": str(h.id),
                "service_date": h.service_date.isoformat(),
                "service_type": h.service_type,
                "technician": h.technician,
                "hours_at_service": h.hours_at_service,
                "next_service_date": h.next_service_date.isoformat() if h.next_service_date else None,
                "notes": h.notes,
            }
            for h in history
        ],
        "reminders": [
            {
                "id": str(r.id),
                "reminder_type": r.reminder_type,
                "scheduled_send_at": r.scheduled_send_at.isoformat(),
                "status": r.status,
                "sent_at": r.sent_at.isoformat() if r.sent_at else None,
            }
            for r in reminders
        ],
        "bookings": [
            {
                "id": str(b.id),
                "booking_number": b.booking_number,
                "scheduled_date": b.scheduled_date.isoformat(),
                "status": b.status,
                "location": b.location,
            }
            for b in bookings
        ],
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_equipment(
    payload: EquipmentCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> EquipmentResponse:
    """Create new equipment."""
    equipment = Equipment(**payload.model_dump())
    # Compute initial next service
    next_date, next_hours = compute_next_service(equipment)
    equipment.next_service_date = next_date
    equipment.next_service_hours = next_hours
    db.add(equipment)
    try:
        await db.commit()
        await db.refresh(equipment)
    except Exception:
        await db.rollback()
        raise
    return EquipmentResponse.model_validate(equipment)


@router.put("/{equipment_id}")
async def update_equipment(
    equipment_id: UUID,
    payload: EquipmentUpdate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> EquipmentResponse:
    """Update equipment."""
    equipment = await db.get(Equipment, equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(equipment, field, value)

    next_date, next_hours = compute_next_service(equipment)
    equipment.next_service_date = next_date
    equipment.next_service_hours = next_hours
    equipment.updated_at = datetime.now(UTC)

    try:
        await db.commit()
        await db.refresh(equipment)
    except Exception:
        await db.rollback()
        raise
    return EquipmentResponse.model_validate(equipment)


@router.delete("/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def retire_equipment(
    equipment_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """Retire equipment (soft delete)."""
    equipment = await db.get(Equipment, equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    equipment.status = EquipmentStatus.retired
    equipment.updated_at = datetime.now(UTC)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise


@router.post("/{equipment_id}/update-hours")
async def update_hours(
    equipment_id: UUID,
    payload: UpdateHoursRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> EquipmentResponse:
    """Update current hours and recompute next service hours."""
    equipment = await db.get(Equipment, equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    equipment.current_hours = payload.current_hours
    _, next_hours = compute_next_service(equipment)
    equipment.next_service_hours = next_hours
    equipment.updated_at = datetime.now(UTC)
    try:
        await db.commit()
        await db.refresh(equipment)
    except Exception:
        await db.rollback()
        raise
    return EquipmentResponse.model_validate(equipment)


@router.post("/{equipment_id}/record-service")
async def record_service(
    equipment_id: UUID,
    payload: RecordServiceRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Complete a service -- update history + recompute intervals + generate reminders."""
    equipment = await db.get(Equipment, equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    # Update service dates
    equipment.last_service_date = payload.service_date
    if payload.hours_at_service is not None:
        equipment.last_service_hours = payload.hours_at_service
        equipment.current_hours = payload.hours_at_service

    # Recompute next service
    next_date, next_hours = compute_next_service(equipment)
    equipment.next_service_date = next_date
    equipment.next_service_hours = next_hours
    equipment.updated_at = datetime.now(UTC)

    # Create history record
    history = EquipmentServiceHistory(
        equipment_id=equipment_id,
        service_date=payload.service_date,
        service_type=payload.service_type,
        technician=payload.technician,
        hours_at_service=payload.hours_at_service,
        next_service_date=next_date,
        next_service_hours=next_hours,
        parts_used=payload.parts_used,
        notes=payload.notes,
    )
    db.add(history)
    await db.flush()

    # Generate new reminders for next service
    reminders = await generate_reminders(db, equipment_id)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return {
        "message": "Service recorded successfully",
        "next_service_date": next_date.isoformat() if next_date else None,
        "next_service_hours": next_hours,
        "reminders_created": len(reminders),
    }
