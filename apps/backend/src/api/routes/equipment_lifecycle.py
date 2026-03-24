"""Equipment serial number and warranty tracking API endpoints."""
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.config.database import get_async_db
from src.db.equipment_lifecycle_models import EquipmentUnit, WarrantyAlert

router = APIRouter(prefix="/api/equipment", tags=["Equipment Lifecycle"])


# ─── Pydantic schemas ───────────────────────────────────────────────────────


class EquipmentUnitCreate(BaseModel):
    serial_number: str
    product_id: UUID | None = None
    customer_id: UUID | None = None
    order_id: UUID | None = None
    purchase_date: datetime | None = None
    warranty_expiry: datetime | None = None
    warranty_months: int | None = None
    notes: str | None = None


class EquipmentUnitResponse(BaseModel):
    id: UUID
    serial_number: str
    product_id: UUID | None
    customer_id: UUID | None
    order_id: UUID | None
    purchase_date: datetime | None
    warranty_expiry: datetime | None
    warranty_months: int | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WarrantyAlertResponse(BaseModel):
    id: UUID
    unit_id: UUID
    alert_type: str
    alert_date: datetime
    resolved: bool
    resolved_at: datetime | None
    serial_number: str
    product_id: UUID | None
    customer_id: UUID | None
    days_until_expiry: int | None = None

    model_config = {"from_attributes": True}


# ─── Endpoints ──────────────────────────────────────────────────────────────


@router.get("/units", response_model=list[EquipmentUnitResponse])
async def list_equipment_units(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    customer_id: UUID | None = None,
    active_only: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> list[EquipmentUnitResponse]:
    """List serialized equipment units with optional customer filter."""
    stmt = select(EquipmentUnit)
    if customer_id:
        stmt = stmt.where(EquipmentUnit.customer_id == customer_id)
    if active_only:
        stmt = stmt.where(EquipmentUnit.is_active)
    stmt = stmt.order_by(EquipmentUnit.created_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(stmt)
    units = result.scalars().all()
    return [EquipmentUnitResponse.model_validate(u) for u in units]


@router.post("/units", response_model=EquipmentUnitResponse, status_code=201)
async def register_equipment_unit(
    payload: EquipmentUnitCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> EquipmentUnitResponse:
    """Register a new equipment unit with serial number.

    Automatically computes warranty_expiry from purchase_date + warranty_months
    when warranty_expiry is not explicitly provided.
    """
    # Auto-calculate warranty expiry if months provided
    warranty_expiry = payload.warranty_expiry
    if warranty_expiry is None and payload.warranty_months:
        base_date = payload.purchase_date or datetime.now(UTC)
        warranty_expiry = base_date + timedelta(days=payload.warranty_months * 30)

    unit = EquipmentUnit(
        serial_number=payload.serial_number,
        product_id=payload.product_id,
        customer_id=payload.customer_id,
        order_id=payload.order_id,
        purchase_date=payload.purchase_date,
        warranty_expiry=warranty_expiry,
        warranty_months=payload.warranty_months,
        notes=payload.notes,
    )
    db.add(unit)
    try:
        await db.commit()
        await db.refresh(unit)
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=409, detail="Serial number already registered"
        )
    return EquipmentUnitResponse.model_validate(unit)


@router.get("/units/{serial}", response_model=EquipmentUnitResponse)
async def get_equipment_unit_by_serial(
    serial: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> EquipmentUnitResponse:
    """Look up an equipment unit by its serial number."""
    result = await db.execute(
        select(EquipmentUnit).where(EquipmentUnit.serial_number == serial)
    )
    unit = result.scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=404, detail="Serial number not found")
    return EquipmentUnitResponse.model_validate(unit)


@router.get("/warranty-alerts", response_model=list[WarrantyAlertResponse])
async def get_warranty_alerts(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    days: int = Query(90, ge=1, le=365, description="Alert window in days"),
    unresolved_only: bool = Query(True),
) -> list[WarrantyAlertResponse]:
    """Return equipment units with warranties expiring within the given window.

    Dynamically computes expiry status — no pre-generated alert rows required.
    """
    now = datetime.now(UTC)
    cutoff = now + timedelta(days=days)

    stmt = (
        select(EquipmentUnit)
        .where(EquipmentUnit.is_active)
        .where(EquipmentUnit.warranty_expiry.isnot(None))
        .where(EquipmentUnit.warranty_expiry <= cutoff)
        .order_by(EquipmentUnit.warranty_expiry)
    )
    result = await db.execute(stmt)
    units = result.scalars().all()

    alerts: list[WarrantyAlertResponse] = []
    for unit in units:
        expiry = unit.warranty_expiry
        if expiry is None:
            continue
        days_left = (expiry - now).days
        if days_left < 0:
            alert_type = "expired"
        elif days_left <= 30:
            alert_type = "expiring_30"
        elif days_left <= 60:
            alert_type = "expiring_60"
        else:
            alert_type = "expiring_90"

        alerts.append(
            WarrantyAlertResponse(
                id=unit.id,
                unit_id=unit.id,
                alert_type=alert_type,
                alert_date=expiry,
                resolved=False,
                resolved_at=None,
                serial_number=unit.serial_number,
                product_id=unit.product_id,
                customer_id=unit.customer_id,
                days_until_expiry=days_left,
            )
        )

    return alerts


@router.get("/stats")
async def get_equipment_stats(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Return aggregate equipment stats for the dashboard Urgent Today card."""
    now = datetime.now(UTC)

    total_result = await db.execute(select(func.count(EquipmentUnit.id)))
    total = total_result.scalar() or 0

    active_result = await db.execute(
        select(func.count(EquipmentUnit.id)).where(EquipmentUnit.is_active)
    )
    active = active_result.scalar() or 0

    expiring_soon_result = await db.execute(
        select(func.count(EquipmentUnit.id))
        .where(EquipmentUnit.is_active)
        .where(EquipmentUnit.warranty_expiry.isnot(None))
        .where(EquipmentUnit.warranty_expiry <= now + timedelta(days=30))
        .where(EquipmentUnit.warranty_expiry >= now)
    )
    expiring_soon = expiring_soon_result.scalar() or 0

    # Warranty alerts list: units with warranty expiring within 90 days
    alerts_result = await db.execute(
        select(EquipmentUnit)
        .where(EquipmentUnit.is_active)
        .where(EquipmentUnit.warranty_expiry.isnot(None))
        .where(EquipmentUnit.warranty_expiry <= now + timedelta(days=90))
        .order_by(EquipmentUnit.warranty_expiry)
        .limit(20)
    )
    alert_units = alerts_result.scalars().all()
    warranty_alerts = [
        {
            "serial_number": u.serial_number,
            "warranty_expiry": u.warranty_expiry.isoformat() if u.warranty_expiry else None,
            "days_until_expiry": (u.warranty_expiry - now).days if u.warranty_expiry else None,
        }
        for u in alert_units
    ]

    return {
        "total_units": total,
        "active_units": active,
        "expiring_soon": expiring_soon,
        "warranty_alerts": warranty_alerts,
    }
