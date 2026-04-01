"""Workshop bookings API routes."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.workshop_models import (
    BookingStatus,
    Equipment,
    EquipmentServiceHistory,
    EquipmentStatus,
    ServiceTemplate,
    WorkshopBooking,
)
from src.services.workshop_scheduler import compute_next_service, generate_reminders

router = APIRouter(prefix="/api/workshop/bookings", tags=["Workshop"])

_booking_counter: dict[str, int] = {}


def _generate_booking_number() -> str:
    year = datetime.now(UTC).year
    key = str(year)
    _booking_counter[key] = _booking_counter.get(key, 0) + 1
    return f"WB-{year}-{_booking_counter[key]:04d}"


class BookingCreate(BaseModel):
    equipment_id: UUID
    service_template_id: UUID | None = None
    contractor_id: UUID | None = None
    location: str = Field(min_length=1, max_length=50)
    scheduled_date: datetime
    customer_notes: str | None = None


class BookingUpdate(BaseModel):
    contractor_id: UUID | None = None
    location: str | None = None
    scheduled_date: datetime | None = None
    status: BookingStatus | None = None
    customer_notes: str | None = None
    technician_notes: str | None = None


class CompleteBookingRequest(BaseModel):
    actual_hours: float | None = None
    hours_on_completion: float | None = None
    technician_notes: str | None = None
    parts_used: dict | None = None


class BookingResponse(BaseModel):
    id: UUID
    booking_number: str
    equipment_id: UUID
    service_request_id: UUID | None
    service_template_id: UUID | None
    contractor_id: UUID | None
    location: str
    scheduled_date: datetime
    estimated_end_datetime: datetime | None
    status: str
    purchase_order_id: UUID | None
    parts_ordered_at: datetime | None
    actual_hours: float | None
    hours_on_completion: float | None
    technician_notes: str | None
    customer_notes: str | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class PaginatedBookingsResponse(BaseModel):
    items: list[BookingResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("")
async def list_bookings(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    location: str | None = None,
    status: str | None = None,
    contractor_id: UUID | None = None,
    equipment_id: UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> PaginatedBookingsResponse:
    """List workshop bookings."""
    stmt = select(WorkshopBooking)
    if location:
        stmt = stmt.where(WorkshopBooking.location == location)
    if status:
        stmt = stmt.where(WorkshopBooking.status == status)
    if contractor_id:
        stmt = stmt.where(WorkshopBooking.contractor_id == contractor_id)
    if equipment_id:
        stmt = stmt.where(WorkshopBooking.equipment_id == equipment_id)
    if date_from:
        stmt = stmt.where(WorkshopBooking.scheduled_date >= date_from)
    if date_to:
        stmt = stmt.where(WorkshopBooking.scheduled_date <= date_to)

    total_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = total_result.scalar_one()

    stmt = stmt.order_by(WorkshopBooking.scheduled_date.asc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    bookings = result.scalars().all()

    return PaginatedBookingsResponse(
        items=[BookingResponse.model_validate(b) for b in bookings],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{booking_id}")
async def get_booking(
    booking_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Get booking detail with equipment + customer info."""
    booking = await db.get(WorkshopBooking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    equipment = await db.get(Equipment, booking.equipment_id)

    result: dict = {"booking": BookingResponse.model_validate(booking)}
    if equipment:
        result["equipment"] = {
            "id": str(equipment.id),
            "make": equipment.make,
            "model": equipment.model,
            "serial_number": equipment.serial_number,
            "location": equipment.location,
            "customer_id": str(equipment.customer_id),
        }

    return result


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_booking(
    payload: BookingCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> BookingResponse:
    """Create a workshop booking."""
    equipment = await db.get(Equipment, payload.equipment_id)
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")

    estimated_end = None
    if payload.service_template_id:
        template = await db.get(ServiceTemplate, payload.service_template_id)
        if template:
            estimated_end = payload.scheduled_date + timedelta(hours=template.estimated_hours)

    booking = WorkshopBooking(
        booking_number=_generate_booking_number(),
        equipment_id=payload.equipment_id,
        service_template_id=payload.service_template_id,
        contractor_id=payload.contractor_id,
        location=payload.location,
        scheduled_date=payload.scheduled_date,
        estimated_end_datetime=estimated_end,
        customer_notes=payload.customer_notes,
        status=BookingStatus.scheduled,
    )
    db.add(booking)
    try:
        await db.commit()
        await db.refresh(booking)
    except Exception:
        await db.rollback()
        raise
    return BookingResponse.model_validate(booking)


@router.put("/{booking_id}")
async def update_booking(
    booking_id: UUID,
    payload: BookingUpdate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> BookingResponse:
    """Update a booking."""
    booking = await db.get(WorkshopBooking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(booking, field, value)
    booking.updated_at = datetime.now(UTC)
    try:
        await db.commit()
        await db.refresh(booking)
    except Exception:
        await db.rollback()
        raise
    return BookingResponse.model_validate(booking)


@router.post("/{booking_id}/complete")
async def complete_booking(
    booking_id: UUID,
    payload: CompleteBookingRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Mark booking complete and update equipment service history."""
    booking = await db.get(WorkshopBooking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    booking.status = BookingStatus.completed
    booking.actual_hours = payload.actual_hours
    booking.hours_on_completion = payload.hours_on_completion
    booking.technician_notes = payload.technician_notes
    booking.updated_at = datetime.now(UTC)

    equipment = await db.get(Equipment, booking.equipment_id)
    if equipment:
        now = datetime.now(UTC)
        equipment.last_service_date = now
        if payload.hours_on_completion is not None:
            equipment.last_service_hours = payload.hours_on_completion
            equipment.current_hours = payload.hours_on_completion
        equipment.status = EquipmentStatus.active
        next_date, next_hours = compute_next_service(equipment)
        equipment.next_service_date = next_date
        equipment.next_service_hours = next_hours
        equipment.updated_at = now

        # Determine service type
        service_type = "maintenance"
        if booking.service_template_id:
            template = await db.get(ServiceTemplate, booking.service_template_id)
            if template:
                service_type = template.service_type

        history = EquipmentServiceHistory(
            equipment_id=equipment.id,
            booking_id=booking_id,
            service_date=now,
            service_type=service_type,
            hours_at_service=payload.hours_on_completion,
            next_service_date=next_date,
            next_service_hours=next_hours,
            parts_used=payload.parts_used,
            notes=payload.technician_notes,
        )
        db.add(history)
        await db.flush()

        reminders = await generate_reminders(db, equipment.id)
        try:
            await db.commit()
        except Exception:
            await db.rollback()
            raise

        return {
            "message": "Booking completed",
            "next_service_date": next_date.isoformat() if next_date else None,
            "next_service_hours": next_hours,
            "reminders_created": len(reminders),
        }

    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return {"message": "Booking completed"}


@router.post("/{booking_id}/order-parts")
async def order_parts(
    booking_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Manually trigger draft PO creation for booking parts."""
    booking = await db.get(WorkshopBooking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if not booking.service_template_id:
        raise HTTPException(status_code=400, detail="No service template attached to this booking")

    booking.parts_ordered_at = datetime.now(UTC)
    booking.updated_at = datetime.now(UTC)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return {"message": "Parts order triggered (draft PO would be created)", "booking_id": str(booking_id)}
