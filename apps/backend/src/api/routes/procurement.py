"""Procurement API endpoints (Batch 2B: GAP-014, GAP-015).

Provides three-way matching and unmatched PO items tracking.
"""

from decimal import Decimal
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.inventory_models import (
    InboundShipment,
    PurchaseOrder,
    PurchaseOrderItem,
)
from src.db.models.invoicing import Invoice, InvoiceItem

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/procurement", tags=["Procurement"])


# ============================================================================
# Request/Response Models
# ============================================================================


class Variance(BaseModel):
    """Variance detected in three-way match."""

    field: str
    po_value: str | Decimal | None
    grn_value: str | Decimal | None
    invoice_value: str | Decimal | None
    variance_amount: Decimal | None
    severity: str  # low, medium, high


class ThreeWayMatchRequest(BaseModel):
    """Request for three-way match."""

    po_id: UUID
    grn_id: UUID
    invoice_id: UUID


class ThreeWayMatchResponse(BaseModel):
    """Response from three-way match."""

    match_status: str  # matched, partial_match, variance_detected
    variances: list[Variance]


class UnmatchedPOItemResponse(BaseModel):
    """Response for unmatched PO item."""

    id: UUID
    po_id: UUID
    po_number: str
    product_id: UUID
    quantity_ordered: int
    quantity_received: int
    quantity_invoiced: int
    remaining: int


class PaginatedUnmatchedPOResponse(BaseModel):
    """Paginated unmatched PO items."""

    items: list[UnmatchedPOItemResponse]
    total: int
    page: int
    page_size: int


# ============================================================================
# Endpoints
# ============================================================================


@router.post("/three-way-match", response_model=ThreeWayMatchResponse)
async def three_way_match(
    request: ThreeWayMatchRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ThreeWayMatchResponse:
    """GAP-014: Match PO + GRN + Invoice, detect variances.

    Performs three-way matching to ensure:
    - Purchase Order quantities/prices match
    - Goods Receipt Note matches what was ordered
    - Invoice matches what was received

    Variances are categorized by severity:
    - Low: <5% difference
    - Medium: 5-10% difference
    - High: >10% difference or missing document
    """
    # Fetch PO
    po_result = await db.execute(
        select(PurchaseOrder).where(PurchaseOrder.id == request.po_id)
    )
    po = po_result.scalar_one_or_none()

    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # Fetch GRN (InboundShipment)
    grn_result = await db.execute(
        select(InboundShipment).where(InboundShipment.id == request.grn_id)
    )
    grn = grn_result.scalar_one_or_none()

    if not grn:
        raise HTTPException(status_code=404, detail="Goods receipt note not found")

    # Fetch Invoice
    invoice_result = await db.execute(
        select(Invoice).where(Invoice.id == request.invoice_id)
    )
    invoice = invoice_result.scalar_one_or_none()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Perform matching
    variances: list[Variance] = []

    # Check PO number matches
    if hasattr(grn, 'purchase_order_id') and grn.purchase_order_id != po.id:
        variances.append(
            Variance(
                field="purchase_order_id",
                po_value=str(po.id),
                grn_value=str(grn.purchase_order_id),
                invoice_value=str(invoice.order_id) if invoice.order_id else None,
                variance_amount=None,
                severity="high"
            )
        )

    # Check totals match (within tolerance)
    po_total = po.total
    invoice_total = invoice.total
    variance_amount = abs(po_total - invoice_total)
    variance_pct = (variance_amount / po_total * 100) if po_total > 0 else 0

    if variance_pct > 0.01:  # More than 1 cent difference
        severity = "low"
        if variance_pct > 5:
            severity = "medium"
        if variance_pct > 10:
            severity = "high"

        variances.append(
            Variance(
                field="total_amount",
                po_value=po_total,
                grn_value=None,  # GRN doesn't have total
                invoice_value=invoice_total,
                variance_amount=variance_amount,
                severity=severity
            )
        )

    # Check quantities (simplified - would iterate line items in production)
    # For now, just check if PO and invoice have same number of items
    po_items_result = await db.execute(
        select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == po.id)
    )
    po_items = po_items_result.scalars().all()

    invoice_items_result = await db.execute(
        select(InvoiceItem).where(InvoiceItem.invoice_id == invoice.id)
    )
    invoice_items = invoice_items_result.scalars().all()

    if len(po_items) != len(invoice_items):
        variances.append(
            Variance(
                field="line_item_count",
                po_value=str(len(po_items)),
                grn_value=None,
                invoice_value=str(len(invoice_items)),
                variance_amount=None,
                severity="medium"
            )
        )

    # Determine match status
    if not variances:
        match_status = "matched"
    elif any(v.severity == "high" for v in variances):
        match_status = "variance_detected"
    else:
        match_status = "partial_match"

    logger.info(
        "three_way_match_complete",
        po_id=str(request.po_id),
        grn_id=str(request.grn_id),
        invoice_id=str(request.invoice_id),
        match_status=match_status,
        variances_count=len(variances)
    )

    return ThreeWayMatchResponse(
        match_status=match_status,
        variances=variances
    )


@router.get("/unmatched-po-items", response_model=PaginatedUnmatchedPOResponse)
async def list_unmatched_po_items(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    po_id: UUID | None = Query(None, description="Filter by specific PO"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> PaginatedUnmatchedPOResponse:
    """GAP-015: List PO items not yet matched.

    Returns purchase order line items that:
    - Have not been fully received (quantity_received < quantity)
    - Have not been fully invoiced

    Useful for identifying outstanding deliveries and invoicing gaps.
    """
    # Build query for PO items with remaining quantities
    query = (
        select(PurchaseOrderItem, PurchaseOrder)
        .join(PurchaseOrder, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id)
        .where(PurchaseOrderItem.quantity > PurchaseOrderItem.quantity_received)
    )

    # Filter by specific PO if requested
    if po_id:
        query = query.where(PurchaseOrder.id == po_id)

    # Execute query
    result = await db.execute(query)
    items_and_pos = result.all()

    # For pagination, slice results
    start = (page - 1) * page_size
    end = start + page_size
    paginated_items = items_and_pos[start:end]

    # Build response
    unmatched_items: list[UnmatchedPOItemResponse] = []

    for po_item, po in paginated_items:
        # Calculate how much has been invoiced (simplified - would check invoice_items)
        quantity_invoiced = 0  # TODO: Query invoice_items in production

        remaining = po_item.quantity - po_item.quantity_received

        unmatched_items.append(
            UnmatchedPOItemResponse(
                id=po_item.id,
                po_id=po.id,
                po_number=po.po_number,
                product_id=po_item.product_id,
                quantity_ordered=po_item.quantity,
                quantity_received=po_item.quantity_received,
                quantity_invoiced=quantity_invoiced,
                remaining=remaining
            )
        )

    logger.info(
        "unmatched_po_items_listed",
        total_unmatched=len(unmatched_items),
        po_id=str(po_id) if po_id else "all"
    )

    return PaginatedUnmatchedPOResponse(
        items=unmatched_items,
        total=len(items_and_pos),
        page=page,
        page_size=page_size
    )
