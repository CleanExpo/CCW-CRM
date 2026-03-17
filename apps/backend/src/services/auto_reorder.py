"""Auto-reorder service (GAP-030).

Automatically creates purchase orders when stock falls below reorder point.
Uses Pure Function TDD pattern - core logic is testable without DB.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Product
from src.db.inventory_models import (
    ProductStockByLocation,
    PurchaseOrder,
    PurchaseOrderItem,
    ReorderRule,
    Supplier,
)

logger = structlog.get_logger(__name__)


@dataclass
class ReorderCalculation:
    """Result of reorder quantity calculation."""

    should_reorder: bool
    reorder_quantity: int
    current_stock: int
    reorder_point: int
    lead_time_days: int
    avg_daily_usage: float
    safety_stock: int
    reason: str


@dataclass
class PurchaseOrderData:
    """Data for creating a purchase order."""

    po_number: str
    supplier_id: UUID
    delivery_location: str
    items: list[PurchaseOrderItemData]
    expected_delivery_date: date
    notes: str


@dataclass
class PurchaseOrderItemData:
    """Data for a PO line item."""

    product_id: UUID
    quantity: int
    unit_cost: Decimal


# ---------------------------------------------------------------------------
# Pure Functions (No DB - easy to test)
# ---------------------------------------------------------------------------


def calculate_reorder_quantity(
    current_stock: int,
    reorder_point: int,
    reorder_quantity: int,
    lead_time_days: int,
    avg_daily_usage: float,
) -> int:
    """
    Calculate optimal reorder quantity.

    Pure function - no database access, easily testable.

    Algorithm:
    1. Calculate demand during lead time: avg_daily_usage * lead_time_days
    2. Calculate safety stock: reorder_point - (avg_daily_usage * lead_time_days)
    3. Calculate target stock: reorder_point + reorder_quantity
    4. Calculate order quantity: target_stock - current_stock

    Args:
        current_stock: Current stock level
        reorder_point: Stock level that triggers reorder
        reorder_quantity: Standard reorder quantity
        lead_time_days: Supplier lead time in days
        avg_daily_usage: Average daily consumption

    Returns:
        Optimal reorder quantity
    """
    # Calculate demand during lead time
    lead_time_demand = avg_daily_usage * lead_time_days

    # Calculate safety stock (buffer above lead time demand)
    safety_stock = max(0, reorder_point - int(lead_time_demand))

    # Target stock = reorder point + reorder quantity
    target_stock = reorder_point + reorder_quantity

    # Calculate how much to order
    order_quantity = target_stock - current_stock

    # Ensure we order at least the standard reorder quantity
    # (unless current stock is very close to target)
    if order_quantity < reorder_quantity and current_stock < reorder_point:
        order_quantity = reorder_quantity

    # Never order negative quantity
    return max(0, order_quantity)


def should_reorder(
    product_id: UUID,
    current_stock: int,
    reorder_point: int,
    pending_po_quantity: int = 0,
) -> ReorderCalculation:
    """
    Check if product should be reordered.

    Pure function - only logic, no I/O.

    Args:
        product_id: Product to check
        current_stock: Current stock level
        reorder_point: Stock level that triggers reorder
        pending_po_quantity: Quantity already on pending POs

    Returns:
        ReorderCalculation with decision and reasoning
    """
    # Account for pending orders
    effective_stock = current_stock + pending_po_quantity

    if effective_stock > reorder_point:
        return ReorderCalculation(
            should_reorder=False,
            reorder_quantity=0,
            current_stock=current_stock,
            reorder_point=reorder_point,
            lead_time_days=0,
            avg_daily_usage=0.0,
            safety_stock=0,
            reason=f"Stock above reorder point (current: {effective_stock}, reorder: {reorder_point})",
        )

    # Default values for calculation (in real system would come from analytics)
    lead_time_days = 7
    avg_daily_usage = 5.0  # Simplified
    reorder_qty_default = 100

    reorder_qty = calculate_reorder_quantity(
        current_stock=current_stock,
        reorder_point=reorder_point,
        reorder_quantity=reorder_qty_default,
        lead_time_days=lead_time_days,
        avg_daily_usage=avg_daily_usage,
    )

    safety_stock = max(0, reorder_point - int(avg_daily_usage * lead_time_days))

    return ReorderCalculation(
        should_reorder=True,
        reorder_quantity=reorder_qty,
        current_stock=current_stock,
        reorder_point=reorder_point,
        lead_time_days=lead_time_days,
        avg_daily_usage=avg_daily_usage,
        safety_stock=safety_stock,
        reason=f"Stock below reorder point ({current_stock} < {reorder_point}), order {reorder_qty} units",
    )


def generate_po_number() -> str:
    """
    Generate unique PO number.

    Pure function (uses datetime but no I/O).

    Returns:
        PO number in format PO-YYYYMMDD-XXXX
    """
    today = date.today()
    timestamp = datetime.now(UTC).strftime("%H%M%S")
    return f"PO-{today.strftime('%Y%m%d')}-{timestamp[-4:]}"


def calculate_expected_delivery(lead_time_days: int) -> date:
    """
    Calculate expected delivery date.

    Pure function.

    Args:
        lead_time_days: Supplier lead time

    Returns:
        Expected delivery date
    """
    return date.today() + timedelta(days=lead_time_days)


def apply_quantity_breaks(
    quantity: int,
    unit_cost: Decimal,
) -> Decimal:
    """
    Apply quantity discount breaks.

    Pure function.

    Args:
        quantity: Order quantity
        unit_cost: Base unit cost

    Returns:
        Adjusted unit cost with discount applied
    """
    # Simple quantity break logic
    # In real system would come from supplier pricing table
    if quantity >= 500:
        discount = Decimal("0.15")  # 15% off
    elif quantity >= 200:
        discount = Decimal("0.10")  # 10% off
    elif quantity >= 100:
        discount = Decimal("0.05")  # 5% off
    else:
        discount = Decimal("0.00")  # No discount

    return (unit_cost * (Decimal("1") - discount)).quantize(Decimal("0.01"))


# ---------------------------------------------------------------------------
# Async DB Wrapper Functions
# ---------------------------------------------------------------------------


async def check_if_po_exists(
    db: AsyncSession,
    product_id: UUID,
    location: str,
) -> int:
    """
    Check if pending PO already exists for product at location.

    Args:
        db: Database session
        product_id: Product ID
        location: Delivery location

    Returns:
        Total quantity on pending POs for this product
    """
    result = await db.execute(
        select(PurchaseOrder)
        .where(
            PurchaseOrder.delivery_location == location,
            PurchaseOrder.status.in_(["draft", "pending_approval", "approved", "ordered"]),
        )
    )
    pending_pos = result.scalars().all()

    total_pending = 0
    for po in pending_pos:
        items_result = await db.execute(
            select(PurchaseOrderItem).where(
                PurchaseOrderItem.purchase_order_id == po.id,
                PurchaseOrderItem.product_id == product_id,
            )
        )
        items = items_result.scalars().all()
        total_pending += sum(item.quantity for item in items)

    return total_pending


async def create_reorder_po(
    db: AsyncSession,
    product_id: UUID,
    quantity: int,
    supplier_id: UUID,
    location: str,
    lead_time_days: int = 7,
) -> PurchaseOrder | None:
    """
    Generate purchase order for reorder (async DB wrapper).

    Creates PO in DB for the reorder.

    Args:
        db: Database session
        product_id: Product to order
        quantity: Quantity to order
        supplier_id: Supplier ID
        location: Delivery location
        lead_time_days: Lead time for delivery

    Returns:
        Created PurchaseOrder or None if failed
    """
    # Fetch product for cost
    product_result = await db.execute(
        select(Product).where(Product.id == product_id)
    )
    product = product_result.scalar_one_or_none()

    if not product:
        logger.warning("product_not_found", product_id=str(product_id))
        return None

    # Fetch supplier
    supplier_result = await db.execute(
        select(Supplier).where(Supplier.id == supplier_id)
    )
    supplier = supplier_result.scalar_one_or_none()

    if not supplier:
        logger.warning("supplier_not_found", supplier_id=str(supplier_id))
        return None

    # Generate PO number (pure function)
    po_number = generate_po_number()

    # Calculate expected delivery (pure function)
    expected_delivery = calculate_expected_delivery(lead_time_days)

    # Apply quantity breaks (pure function)
    unit_cost = apply_quantity_breaks(quantity, product.cost)

    subtotal = unit_cost * quantity
    tax = subtotal * Decimal("0.10")  # 10% GST
    total = subtotal + tax

    # Create PO
    po = PurchaseOrder(
        po_number=po_number,
        supplier_id=supplier_id,
        delivery_location=location,
        status="draft",
        expected_delivery_date=expected_delivery,
        subtotal=subtotal,
        tax=tax,
        total=total,
        notes=f"Auto-reorder for {product.name} - Stock below reorder point",
    )

    db.add(po)
    await db.flush()  # Get PO ID

    # Create PO item
    po_item = PurchaseOrderItem(
        purchase_order_id=po.id,
        product_id=product_id,
        quantity=quantity,
        unit_cost=unit_cost,
        subtotal=subtotal,
    )

    db.add(po_item)
    await db.commit()
    await db.refresh(po)

    logger.info(
        "auto_reorder_po_created",
        po_id=str(po.id),
        po_number=po_number,
        product_id=str(product_id),
        quantity=quantity,
        supplier_id=str(supplier_id),
        location=location,
    )

    return po


async def process_auto_reorder(
    db: AsyncSession,
    product_id: UUID,
    location: str,
) -> PurchaseOrder | None:
    """
    Process auto-reorder for a product at a location (main entry point).

    Checks stock level, reorder rule, and creates PO if needed.

    Args:
        db: Database session
        product_id: Product ID
        location: Stock location

    Returns:
        Created PurchaseOrder if reorder occurred, None otherwise
    """
    # Fetch stock level
    stock_result = await db.execute(
        select(ProductStockByLocation).where(
            ProductStockByLocation.product_id == product_id,
            ProductStockByLocation.location == location,
        )
    )
    stock = stock_result.scalar_one_or_none()

    if not stock:
        logger.warning(
            "stock_not_found",
            product_id=str(product_id),
            location=location,
        )
        return None

    # Fetch reorder rule
    rule_result = await db.execute(
        select(ReorderRule).where(
            ReorderRule.product_id == product_id,
            ReorderRule.location == location,
        )
    )
    rule = rule_result.scalar_one_or_none()

    if not rule or not rule.supplier_id:
        logger.debug(
            "no_reorder_rule",
            product_id=str(product_id),
            location=location,
        )
        return None

    # Check for existing pending POs
    pending_qty = await check_if_po_exists(db, product_id, location)

    # Check if should reorder (pure function)
    reorder_calc = should_reorder(
        product_id=product_id,
        current_stock=stock.stock,
        reorder_point=stock.reorder_point or 0,
        pending_po_quantity=pending_qty,
    )

    if not reorder_calc.should_reorder:
        logger.debug(
            "reorder_not_needed",
            product_id=str(product_id),
            location=location,
            reason=reorder_calc.reason,
        )
        return None

    # Create PO
    po = await create_reorder_po(
        db=db,
        product_id=product_id,
        quantity=reorder_calc.reorder_quantity,
        supplier_id=rule.supplier_id,
        location=location,
        lead_time_days=7,  # Default lead time
    )

    return po
