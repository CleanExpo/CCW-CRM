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
 