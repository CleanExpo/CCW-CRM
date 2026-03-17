"""Three-way PO matching service (GAP-026).

Matches Purchase Order + Goods Receipt Note + Invoice to detect variances.
Uses Pure Function TDD pattern - core logic is testable without DB.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from enum import Enum
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.inventory_models import PurchaseOrder, PurchaseOrderItem
from src.db.models.invoicing import Invoice, InvoiceItem

logger = structlog.get_logger(__name__)


class MatchStatus(str, Enum):
    """Match status enum."""

    FULL_MATCH = "full_match"
    PARTIAL_MATCH = "partial_match"
    NO_MATCH = "no_match"


class VarianceType(str, Enum):
    """Variance type enum."""

    QUANTITY = "quantity_variance"
    PRICE = "price_variance"
    MISSING_ITEM = "missing_item"
    EXTRA_ITEM = "extra_item"


@dataclass
class POItem:
    """Purchase Order item for matching."""

    product_id: UUID
    quantity: int
    unit_cost: Decimal


@dataclass
class GRNItem:
    """Goods Receipt Note item for matching."""

    product_id: UUID
    quantity_received: int


@dataclass
class InvoiceItemData:
    """Invoice item for matching."""

    product_id: UUID
    quantity: int
    unit_price: Decimal


@dataclass
class Variance:
    """Detected variance."""

    variance_type: VarianceType
    product_id: UUID
    expected: Any
    actual: Any
    description: str


@dataclass
class MatchResult:
    """Result of three-way matching."""

    match_status: MatchStatus
    variances: list[Variance]
    confidence: float  # 0.0 to 1.0

    @property
    def has_variances(self) -> bool:
        """Check if any variances exist."""
        return len(self.variances) > 0

    @property
    def variance_count(self) -> int:
        """Get total variance count."""
        return len(self.variances)


# ---------------------------------------------------------------------------
# Pure Functions (No DB - easy to test)
# ---------------------------------------------------------------------------


def match_po_grn_invoice(
    po_items: list[POItem],
    grn_items: list[GRNItem],
    invoice_items: list[InvoiceItemData],
) -> MatchResult:
    """
    Perform three-way matching between PO, GRN, and Invoice.

    Pure function - no database access, easily testable.

    Args:
        po_items: Items from Purchase Order
        grn_items: Items from Goods Receipt Note
        invoice_items: Items from Invoice

    Returns:
        MatchResult with status, variances, and confidence score
    """
    variances: list[Variance] = []

    # Build lookup maps
    po_map = {item.product_id: item for item in po_items}
    grn_map = {item.product_id: item for item in grn_items}
    invoice_map = {item.product_id: item for item in invoice_items}

    all_product_ids = set(po_map.keys()) | set(grn_map.keys()) | set(invoice_map.keys())

    for product_id in all_product_ids:
        po_item = po_map.get(product_id)
        grn_item = grn_map.get(product_id)
        invoice_item = invoice_map.get(product_id)

        # Check for missing items
        if po_item and not grn_item:
            variances.append(
                Variance(
                    variance_type=VarianceType.MISSING_ITEM,
                    product_id=product_id,
                    expected=po_item.quantity,
                    actual=0,
                    description=f"Item in PO but not received (expected: {po_item.quantity})",
                )
            )

        if po_item and not invoice_item:
            variances.append(
                Variance(
                    variance_type=VarianceType.MISSING_ITEM,
                    product_id=product_id,
                    expected=po_item.quantity,
                    actual=0,
                    description=f"Item in PO but not invoiced (expected: {po_item.quantity})",
                )
            )

        # Check for extra items in invoice (not in PO)
        if invoice_item and not po_item:
            variances.append(
                Variance(
                    variance_type=VarianceType.EXTRA_ITEM,
                    product_id=product_id,
                    expected=0,
                    actual=invoice_item.quantity,
                    description=f"Item invoiced but not in PO (quantity: {invoice_item.quantity})",
                )
            )

        # Check quantity variance (GRN vs PO)
        if po_item and grn_item and grn_item.quantity_received != po_item.quantity:
            variances.append(
                Variance(
                    variance_type=VarianceType.QUANTITY,
                    product_id=product_id,
                    expected=po_item.quantity,
                    actual=grn_item.quantity_received,
                    description=f"Quantity mismatch: ordered {po_item.quantity}, received {grn_item.quantity_received}",  # noqa: E501
                )
            )

        # Check price variance (Invoice vs PO)
        if po_item and invoice_item and invoice_item.unit_price != po_item.unit_cost:
            variances.append(
                Variance(
                    variance_type=VarianceType.PRICE,
                    product_id=product_id,
                    expected=po_item.unit_cost,
                    actual=invoice_item.unit_price,
                    description=f"Price mismatch: PO cost ${po_item.unit_cost}, invoiced ${invoice_item.unit_price}",  # noqa: E501
                )
            )

    # Calculate confidence and match status
    total_items = len(all_product_ids)
    if total_items == 0:
        return MatchResult(
            match_status=MatchStatus.NO_MATCH,
            variances=[],
            confidence=0.0,
        )

    variance_count = len(variances)
    if variance_count == 0:
        match_status = MatchStatus.FULL_MATCH
        confidence = 1.0
    elif variance_count > total_items * 2:  # Multiple variances per item = total failure
        match_status = MatchStatus.NO_MATCH
        confidence = 0.0
    else:
        match_status = MatchStatus.PARTIAL_MATCH
        confidence = max(0.0, 1.0 - (variance_count / (total_items * 2)))

    return MatchResult(
        match_status=match_status,
        variances=variances,
        confidence=confidence,
    )


def get_variance_summary(result: MatchResult) -> dict[str, Any]:
    """
    Get summary statistics of variances.

    Pure function - no side effects.

    Args:
        result: Match result to summarize

    Returns:
        Dictionary with variance counts by type
    """
    summary = {
        "total_variances": len(result.variances),
        "quantity_variances": 0,
        "price_variances": 0,
        "missing_items": 0,
        "extra_items": 0,
    }

    for variance in result.variances:
        if variance.variance_type == VarianceType.QUANTITY:
            summary["quantity_variances"] += 1
        elif variance.variance_type == VarianceType.PRICE:
            summary["price_variances"] += 1
        elif variance.variance_type == VarianceType.MISSING_ITEM:
            summary["missing_items"] += 1
        elif variance.variance_type == VarianceType.EXTRA_ITEM:
            summary["extra_items"] += 1

    return summary


def is_variance_acceptable(
    variance: Variance,
    quantity_tolerance_pct: float = 5.0,
    price_tolerance_pct: float = 2.0,
) -> bool:
    """
    Check if variance is within acceptable tolerance.

    Pure function.

    Args:
        variance: Variance to check
        quantity_tolerance_pct: Acceptable quantity variance percentage (default 5%)
        price_tolerance_pct: Acceptable price variance percentage (default 2%)

    Returns:
        True if variance is within tolerance, False otherwise
    """
    if variance.variance_type == VarianceType.QUANTITY:
        expected = float(variance.expected)
        actual = float(variance.actual)
        if expected == 0:
            return actual == 0
        diff_pct = abs((actual - expected) / expected) * 100
        return diff_pct <= quantity_tolerance_pct

    elif variance.variance_type == VarianceType.PRICE:
        expected = float(variance.expected)
        actual = float(variance.actual)
        if expected == 0:
            return actual == 0
        diff_pct = abs((actual - expected) / expected) * 100
        return diff_pct <= price_tolerance_pct

    # Missing/extra items are never acceptable
    return False


# ---------------------------------------------------------------------------
# Async DB Wrapper Functions
# ---------------------------------------------------------------------------


async def match_po_against_invoice(
    db: AsyncSession,
    po_id: UUID,
    invoice_id: UUID,
) -> MatchResult:
    """
    Match Purchase Order against Invoice (async DB wrapper).

    Fetches data from DB, then calls pure function for matching.

    Args:
        db: Database session
        po_id: Purchase Order ID
        invoice_id: Invoice ID

    Returns:
        MatchResult with variances detected
    """
    # Fetch PO with items
    po_result = await db.execute(
        select(PurchaseOrder).where(PurchaseOrder.id == po_id)
    )
    po = po_result.scalar_one_or_none()

    if not po:
        logger.warning("purchase_order_not_found", po_id=str(po_id))
        return MatchResult(
            match_status=MatchStatus.NO_MATCH,
            variances=[],
            confidence=0.0,
        )

    po_items_result = await db.execute(
        select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == po_id)
    )
    po_items_db = po_items_result.scalars().all()

    # Fetch Invoice with items
    invoice_result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id)
    )
    invoice = invoice_result.scalar_one_or_none()

    if not invoice:
        logger.warning("invoice_not_found", invoice_id=str(invoice_id))
        return MatchResult(
            match_status=MatchStatus.NO_MATCH,
            variances=[],
            confidence=0.0,
        )

    invoice_items_result = await db.execute(
        select(InvoiceItem).where(InvoiceItem.invoice_id == invoice_id)
    )
    invoice_items_db = invoice_items_result.scalars().all()

    # Convert to pure data structures
    po_items = [
        POItem(
            product_id=item.product_id,
            quantity=item.quantity,
            unit_cost=item.unit_cost,
        )
        for item in po_items_db
    ]

    # Use quantity_received as GRN data (simplified - in real system would be separate table)
    grn_items = [
        GRNItem(
            product_id=item.product_id,
            quantity_received=item.quantity_received,
        )
        for item in po_items_db
    ]

    invoice_items = [
        InvoiceItemData(
            product_id=item.product_id if item.product_id else UUID(int=0),
            quantity=item.quantity,
            unit_price=item.unit_price,
        )
        for item in invoice_items_db
        if item.product_id  # Skip items without product_id
    ]

    # Call pure function
    result = match_po_grn_invoice(po_items, grn_items, invoice_items)

    logger.info(
        "po_invoice_match_complete",
        po_id=str(po_id),
        invoice_id=str(invoice_id),
        match_status=result.match_status.value,
        variance_count=result.variance_count,
        confidence=result.confidence,
    )

    return result
