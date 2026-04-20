"""Multi-store inventory API endpoints.

Provides RESTful endpoints for managing stock across multiple locations.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.demo_models import Product
from src.db.inventory_models import (
    InventoryLot,
    InventoryLotRead,
    InventorySerial,
    InventorySerialRead,
    ProductAttribute,
    ProductBarcode,
    ProductStockByLocation,
    ProductVariant,
    ReorderRule,
    StockAdjustment,
    StockReservation,
    StockTake,
    StockTakeItem,
    StockTransfer,
    StoreLocation,
    Supplier,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/inventory", tags=["Multi-Store Inventory"], dependencies=[Depends(get_current_user)])


# ============================================
# Request/Response Models
# ============================================


class InventoryListResponse(BaseModel):
    """List of inventory items with pagination."""

    items: list[dict]
    total: int
    page: int
    page_size: int


# GAP-015: Auto-reorder models
class AutoReorderRequest(BaseModel):
    """Request for auto-reorder trigger."""

    organization_id: UUID


# ============================================
# Serial number and lot/batch read endpoints
# UNI-1823 Phase 1 — schema + read API only
# ============================================


@router.get(
    "/products/{product_id}/serials",
    response_model=list[InventorySerialRead],
    summary="List serial numbers for a product",
)
async def list_product_serials(
    product_id: UUID,
    status: str | None = Query(default=None, description="Filter by status"),
    location: str | None = Query(default=None, description="Filter by location"),
    db: AsyncSession = Depends(get_async_db),
) -> list[InventorySerial]:
    """Return all serial records for *product_id*, optionally filtered."""
    stmt = select(InventorySerial).where(InventorySerial.product_id == product_id)
    if status is not None:
        stmt = stmt.where(InventorySerial.status == status)
    if location is not None:
        stmt = stmt.where(InventorySerial.location == location)
    stmt = stmt.order_by(InventorySerial.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get(
    "/products/{product_id}/lots",
    response_model=list[InventoryLotRead],
    summary="List lot/batch records for a product",
)
async def list_product_lots(
    product_id: UUID,
    location: str | None = Query(default=None, description="Filter by location"),
    db: AsyncSession = Depends(get_async_db),
) -> list[InventoryLot]:
    """Return all lot/batch records for *product_id*, optionally filtered."""
    stmt = select(InventoryLot).where(InventoryLot.product_id == product_id)
    if location is not None:
        stmt = stmt.where(InventoryLot.location == location)
    stmt = stmt.order_by(InventoryLot.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())
