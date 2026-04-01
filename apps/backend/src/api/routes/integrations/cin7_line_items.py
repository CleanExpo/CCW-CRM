"""Cin7 line-item API endpoints.

Exposes line items stored during Cin7 order and purchase order syncs.
Read-only endpoints — line items are populated by the sync process.
"""

from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.cin7_models import (
    Cin7OrderLineItem,
    Cin7OrderMapping,
    Cin7PurchaseOrderLineItem,
    Cin7PurchaseOrderMapping,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/cin7", tags=["Cin7 Line Items"])


# ------------------------------------------------------------------
# Response models
# ------------------------------------------------------------------


class Cin7LineItemResponse(BaseModel):
    """Pydantic response model for a Cin7 line item."""

    id: str
    cin7_line_id: str | None = None
    product_sku: str | None = None
    product_name: str | None = None
    quantity: int
    unit_price: float
    total_price: float
    tax_rate: float | None = None
    notes: str | None = None
    created_at: str


# ------------------------------------------------------------------
# Order line item endpoints
# ------------------------------------------------------------------


@router.get("/orders/{mapping_id}/line-items")
async def get_order_line_items(
    mapping_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict[str, Any]:
    """Get all line items for a Cin7 order mapping."""
    # Verify the mapping exists
    mapping_result = await db.execute(
        select(Cin7OrderMapping).where(Cin7OrderMapping.id == mapping_id)
    )
    mapping = mapping_result.scalar_one_or_none()
    if mapping is None:
        raise HTTPException(status_code=404, detail="Order mapping not found")

    result = await db.execute(
        select(Cin7OrderLineItem)
        .where(Cin7OrderLineItem.cin7_order_mapping_id == mapping_id)
        .order_by(Cin7OrderLineItem.created_at)
    )
    items = result.scalars().all()

    return {
        "mapping_id": mapping_id,
        "cin7_order_number": mapping.cin7_order_number,
        "line_items": [
            Cin7LineItemResponse(
                id=str(item.id),
                cin7_line_id=item.cin7_line_id,
                product_sku=item.product_sku,
                product_name=item.product_name,
                quantity=item.quantity,
                unit_price=float(item.unit_price),
                total_price=float(item.total_price),
                tax_rate=float(item.tax_rate) if item.tax_rate is not None else None,
                notes=item.notes,
                created_at=item.created_at.isoformat(),
            ).model_dump()
            for item in items
        ],
        "total_items": len(items),
    }


# ------------------------------------------------------------------
# Purchase order line item endpoints
# ------------------------------------------------------------------


@router.get("/purchase-orders/{mapping_id}/line-items")
async def get_purchase_order_line_items(
    mapping_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict[str, Any]:
    """Get all line items for a Cin7 purchase order mapping."""
    # Verify the mapping exists
    mapping_result = await db.execute(
        select(Cin7PurchaseOrderMapping).where(
            Cin7PurchaseOrderMapping.id == mapping_id
        )
    )
    mapping = mapping_result.scalar_one_or_none()
    if mapping is None:
        raise HTTPException(
            status_code=404, detail="Purchase order mapping not found"
        )

    result = await db.execute(
        select(Cin7PurchaseOrderLineItem)
        .where(
            Cin7PurchaseOrderLineItem.cin7_purchase_order_mapping_id == mapping_id
        )
        .order_by(Cin7PurchaseOrderLineItem.created_at)
    )
    items = result.scalars().all()

    return {
        "mapping_id": mapping_id,
        "cin7_po_number": mapping.cin7_po_number,
        "line_items": [
            Cin7LineItemResponse(
                id=str(item.id),
                cin7_line_id=item.cin7_line_id,
                product_sku=item.product_sku,
                product_name=item.product_name,
                quantity=item.quantity,
                unit_price=float(item.unit_price),
                total_price=float(item.total_price),
                tax_rate=float(item.tax_rate) if item.tax_rate is not None else None,
                notes=item.notes,
                created_at=item.created_at.isoformat(),
            ).model_dump()
            for item in items
        ],
        "total_items": len(items),
    }
