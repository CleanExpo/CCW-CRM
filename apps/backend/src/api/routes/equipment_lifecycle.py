"""Equipment serial number and warranty tracking API endpoints."""
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.equipment_lifecycle_models import EquipmentUnit

router = APIRouter(prefix="/api/equipment", tags=["Equipment Lifecycle"])


# ─── Pydantic schemas ─────────────────────────────────────────────────────────────


class EquipmentUnitCreate(BaseModel):
    serial_number: str
    product_id: UUID | None = None
    customer_id: UUID | None = None
    order_id: UUID | None = None
    purchase_date: datetime | None = None
    warranty_expiry: datetime | None = None
    warranty_months: int | None = None
    notes: str | None = None

    @field_validator("warranty_months")
    @classmethod
    def acl_minimum_warranty_months(cls, v: int | None) -> int | None:
        """ACL s.54 — consumer goods must carry a minimum 12-month warranty.

        Reject any explicit warranty_months value shorter than 12 to prevent
        staff from inadvertently setting a sub-statutory period.
        """
        if v is not None and v < 12:
            raise ValueError(
                "warranty_months must be at least 12 — ACL s.54 requires a "
                "minimum 12-month statutory guarantee for consumer goods."
            )
        return v


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
    message: str | None
    is_resolved: bool

    model_config = {"from_attributes": True}
