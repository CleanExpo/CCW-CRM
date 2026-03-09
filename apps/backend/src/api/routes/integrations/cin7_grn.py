"""Cin7 Goods Receipt Note (GRN) API endpoints.

Provides routes for creating, managing, and confirming goods receipt notes
when purchase orders arrive at the warehouse. Syncs stock receipts back
to Cin7 in demo mode (auto-marks as synced).
"""

from datetime import UTC, date, datetime
from typing import Annotated, Any
from uuid import uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.cin7_models import Cin7GoodsReceipt, Cin7GoodsReceiptLine

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/cin7/goods-receipts", tags=["Cin7 GRN"])


# ---------------------------------------------------------------------------
# Pydantic request/response models
# ---------------------------------------------------------------------------


class CreateGoodsReceiptRequest(BaseModel):
    po_reference: str = Field(..., min_length=1, max_length=100)
    supplier_name: str | None = None
    received_by: str | None = None
    received_date: date | None = None
    location_id: str = "Main Warehouse"
    notes: str | None = None


class AddGoodsReceiptLineRequest(BaseModel):
    product_id: str | None = None
    sku: str = Field(..., min_length=1, max_length=100)
    product_name: str = Field(..., min_length=1, max_length=500)
    ordered_qty: int | None = None
    received_qty: int = Field(..., ge=0)
    put_away_location: str | None = None
    batch_number: str | None = None
    expiry_date: date | None = None
    condition: str = "good"
    notes: str | None = None


class GoodsReceiptLineResponse(BaseModel):
    id: str
    goods_receipt_id: str
    product_id: str | None
    sku: str
    product_name: str
    ordered_qty: int | None
    received_qty: int
    put_away_location: str | None
    batch_number: str | None
    expiry_date: date | None
    condition: str
    notes: str | None


class GoodsReceiptResponse(BaseModel):
    id: str
    cin7_po_mapping_id: str | None
    po_reference: str
    supplier_name: str | None
    received_by: str | None
    received_date: date
    location_id: str
    notes: str | None
    status: str
    cin7_receipt_id: str | None
    total_items_received: int
    created_at: str
    confirmed_at: str | None
    synced_at: str | None
    lines: list[GoodsReceiptLineResponse] = []


class GoodsReceiptListResponse(BaseModel):
    items: list[GoodsReceiptResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _receipt_to_response(
    grn: Cin7GoodsReceipt,
    lines: list[Cin7GoodsReceiptLine] | None = None,
) -> GoodsReceiptResponse:
    """Convert a GRN ORM object to a response model."""
    line_responses = []
    if lines:
        for line in lines:
            line_responses.append(
                GoodsReceiptLineResponse(
                    id=str(line.id),
                    goods_receipt_id=str(line.goods_receipt_id),
                    product_id=line.product_id,
                    sku=line.sku,
                    product_name=line.product_name,
                    ordered_qty=line.ordered_qty,
                    received_qty=line.received_qty,
                    put_away_location=line.put_away_location,
                    batch_number=line.batch_number,
                    expiry_date=line.expiry_date,
                    condition=line.condition,
                    notes=line.notes,
                )
            )

    return GoodsReceiptResponse(
        id=str(grn.id),
        cin7_po_mapping_id=str(grn.cin7_po_mapping_id) if grn.cin7_po_mapping_id else None,
        po_reference=grn.po_reference,
        supplier_name=grn.supplier_name,
        received_by=grn.received_by,
        received_date=grn.received_date,
        location_id=grn.location_id,
        notes=grn.notes,
        status=grn.status,
        cin7_receipt_id=grn.cin7_receipt_id,
        total_items_received=grn.total_items_received,
        created_at=grn.created_at.isoformat() if grn.created_at else "",
        confirmed_at=grn.confirmed_at.isoformat() if grn.confirmed_at else None,
        synced_at=grn.synced_at.isoformat() if grn.synced_at else None,
        lines=line_responses,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=GoodsReceiptResponse)
async def create_goods_receipt(
    body: CreateGoodsReceiptRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> Any:
    """Create a new draft Goods Receipt Note."""
    logger.info("grn_create", po_reference=body.po_reference)

    grn = Cin7GoodsReceipt(
        id=str(uuid4()),
        po_reference=body.po_reference,
        supplier_name=body.supplier_name,
        received_by=body.received_by,
        received_date=body.received_date or datetime.now(UTC).date(),
        location_id=body.location_id,
        notes=body.notes,
        status="draft",
    )
    db.add(grn)
    await db.commit()
    await db.refresh(grn)

    return _receipt_to_response(grn)


@router.get("", response_model=GoodsReceiptListResponse)
async def list_goods_receipts(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    status: str | None = Query(None, description="Filter by status: draft, confirmed, synced, failed"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> Any:
    """List Goods Receipt Notes with optional status filter."""
    query = select(Cin7GoodsReceipt)

    if status:
        query = query.where(Cin7GoodsReceipt.status == status)

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    # Paginate
    query = query.order_by(Cin7GoodsReceipt.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    grns = result.scalars().all()

    # Fetch lines for each GRN
    items = []
    for grn in grns:
        lines_result = await db.execute(
            select(Cin7GoodsReceiptLine).where(
                Cin7GoodsReceiptLine.goods_receipt_id == grn.id
            )
        )
        lines = lines_result.scalars().all()
        items.append(_receipt_to_response(grn, list(lines)))

    total_pages = max(1, (total + page_size - 1) // page_size)

    return GoodsReceiptListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{grn_id}", response_model=GoodsReceiptResponse)
async def get_goods_receipt(
    grn_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> Any:
    """Get a single GRN with all its lines."""
    result = await db.execute(
        select(Cin7GoodsReceipt).where(Cin7GoodsReceipt.id == grn_id)
    )
    grn = result.scalar_one_or_none()
    if grn is None:
        raise HTTPException(status_code=404, detail="Goods receipt not found")

    lines_result = await db.execute(
        select(Cin7GoodsReceiptLine).where(
            Cin7GoodsReceiptLine.goods_receipt_id == grn_id
        )
    )
    lines = lines_result.scalars().all()

    return _receipt_to_response(grn, list(lines))


@router.post("/{grn_id}/lines", response_model=GoodsReceiptLineResponse)
async def add_goods_receipt_line(
    grn_id: str,
    body: AddGoodsReceiptLineRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> Any:
    """Add a line item to a draft GRN."""
    result = await db.execute(
        select(Cin7GoodsReceipt).where(Cin7GoodsReceipt.id == grn_id)
    )
    grn = result.scalar_one_or_none()
    if grn is None:
        raise HTTPException(status_code=404, detail="Goods receipt not found")

    if grn.status != "draft":
        raise HTTPException(
            status_code=400,
            detail="Cannot add lines to a non-draft goods receipt",
        )

    if body.condition not in ("good", "damaged", "short"):
        raise HTTPException(
            status_code=400,
            detail="Condition must be 'good', 'damaged', or 'short'",
        )

    line = Cin7GoodsReceiptLine(
        id=str(uuid4()),
        goods_receipt_id=grn_id,
        product_id=body.product_id,
        sku=body.sku,
        product_name=body.product_name,
        ordered_qty=body.ordered_qty,
        received_qty=body.received_qty,
        put_away_location=body.put_away_location,
        batch_number=body.batch_number,
        expiry_date=body.expiry_date,
        condition=body.condition,
        notes=body.notes,
    )
    db.add(line)

    # Update total items received on the GRN
    grn.total_items_received = (grn.total_items_received or 0) + body.received_qty

    await db.commit()
    await db.refresh(line)

    return GoodsReceiptLineResponse(
        id=str(line.id),
        goods_receipt_id=str(line.goods_receipt_id),
        product_id=line.product_id,
        sku=line.sku,
        product_name=line.product_name,
        ordered_qty=line.ordered_qty,
        received_qty=line.received_qty,
        put_away_location=line.put_away_location,
        batch_number=line.batch_number,
        expiry_date=line.expiry_date,
        condition=line.condition,
        notes=line.notes,
    )


@router.delete("/{grn_id}/lines/{line_id}")
async def remove_goods_receipt_line(
    grn_id: str,
    line_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict[str, str]:
    """Remove a line item from a draft GRN."""
    result = await db.execute(
        select(Cin7GoodsReceipt).where(Cin7GoodsReceipt.id == grn_id)
    )
    grn = result.scalar_one_or_none()
    if grn is None:
        raise HTTPException(status_code=404, detail="Goods receipt not found")

    if grn.status != "draft":
        raise HTTPException(
            status_code=400,
            detail="Cannot remove lines from a non-draft goods receipt",
        )

    line_result = await db.execute(
        select(Cin7GoodsReceiptLine).where(
            Cin7GoodsReceiptLine.id == line_id,
            Cin7GoodsReceiptLine.goods_receipt_id == grn_id,
        )
    )
    line = line_result.scalar_one_or_none()
    if line is None:
        raise HTTPException(status_code=404, detail="Line item not found")

    # Decrement total
    grn.total_items_received = max(0, (grn.total_items_received or 0) - line.received_qty)

    await db.delete(line)
    await db.commit()

    return {"status": "deleted", "line_id": line_id}


@router.post("/{grn_id}/confirm", response_model=GoodsReceiptResponse)
async def confirm_goods_receipt(
    grn_id: str,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> Any:
    """Confirm a goods receipt: validate lines and sync to Cin7 (demo mode: auto-synced)."""
    result = await db.execute(
        select(Cin7GoodsReceipt).where(Cin7GoodsReceipt.id == grn_id)
    )
    grn = result.scalar_one_or_none()
    if grn is None:
        raise HTTPException(status_code=404, detail="Goods receipt not found")

    if grn.status != "draft":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot confirm a goods receipt with status '{grn.status}'",
        )

    # Fetch lines and validate
    lines_result = await db.execute(
        select(Cin7GoodsReceiptLine).where(
            Cin7GoodsReceiptLine.goods_receipt_id == grn_id
        )
    )
    lines = list(lines_result.scalars().all())

    if not lines:
        raise HTTPException(
            status_code=400,
            detail="Cannot confirm a goods receipt with no line items",
        )

    # Validate all lines have received_qty
    for line in lines:
        if line.received_qty <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"Line for SKU '{line.sku}' has no received quantity",
            )

    # Recalculate total
    total_received = sum(line.received_qty for line in lines)
    grn.total_items_received = total_received

    # In demo mode, mark as confirmed then synced immediately
    now = datetime.now(UTC)
    grn.status = "confirmed"
    grn.confirmed_at = now

    # Demo mode: auto-sync (no live Cin7 client call)
    grn.status = "synced"
    grn.synced_at = now
    grn.cin7_receipt_id = f"DEMO-GRN-{grn.po_reference}-{now.strftime('%H%M%S')}"

    logger.info(
        "grn_confirmed_and_synced",
        grn_id=grn_id,
        po_reference=grn.po_reference,
        total_items=total_received,
        line_count=len(lines),
    )

    await db.commit()
    await db.refresh(grn)

    return _receipt_to_response(grn, lines)
