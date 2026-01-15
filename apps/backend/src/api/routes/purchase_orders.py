"""
Purchase Order API endpoints with line items and receiving workflow.

Provides full CRUD operations for purchase orders including:
- Create/update with line items
- Status management (draft → received)
- Goods receipt workflow (partial/full receiving)
- Automatic stock updates on receipt
"""

from datetime import datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.config.database import get_async_db
from src.db.inventory_models import PurchaseOrder, PurchaseOrderItem, Supplier, ProductStockByLocation
from src.db.demo_models import Product

router = APIRouter(prefix="/api/purchase-orders", tags=["Purchase Orders"])


# Pydantic models
class PurchaseOrderItemCreate(BaseModel):
    """Schema for creating a purchase order line item."""

    product_id: UUID
    quantity: int = Field(..., ge=1, description="Quantity to order")
    unit_cost: Decimal = Field(..., ge=0, description="Cost per unit")


class PurchaseOrderItemUpdate(BaseModel):
    """Schema for updating a purchase order line item."""

    quantity: int | None = Field(None, ge=1)
    unit_cost: Decimal | None = Field(None, ge=0)


class PurchaseOrderItemResponse(BaseModel):
    """Schema for purchase order line item response."""

    id: UUID
    product_id: UUID
    quantity: int
    quantity_received: int
    unit_cost: Decimal
    subtotal: Decimal

    class Config:
        from_attributes = True


class PurchaseOrderCreate(BaseModel):
    """Schema for creating a purchase order."""

    supplier_id: UUID
    delivery_location: str = Field(..., pattern="^(brisbane|sydney|melbourne)$", description="Warehouse location")
    expected_delivery_date: datetime | None = None
    notes: str | None = None
    items: list[PurchaseOrderItemCreate] = Field(..., min_length=1, description="At least one item required")


class PurchaseOrderUpdate(BaseModel):
    """Schema for updating a purchase order."""

    supplier_id: UUID | None = None
    delivery_location: str | None = Field(None, pattern="^(brisbane|sydney|melbourne)$")
    expected_delivery_date: datetime | None = None
    notes: str | None = None
    status: str | None = Field(None, pattern="^(draft|pending_approval|approved|ordered|in_transit|received|cancelled)$")


class PurchaseOrderResponse(BaseModel):
    """Schema for purchase order response."""

    id: UUID
    po_number: str
    supplier_id: UUID
    delivery_location: str
    status: str
    order_date: datetime | None
    expected_delivery_date: datetime | None
    actual_delivery_date: datetime | None
    subtotal: Decimal
    tax: Decimal
    shipping_cost: Decimal | None
    total: Decimal
    notes: str | None
    items: list[PurchaseOrderItemResponse]
    created_at: datetime

    class Config:
        from_attributes = True


class ReceiveItemRequest(BaseModel):
    """Schema for receiving goods against a line item."""

    quantity_received: int = Field(..., ge=1, description="Quantity being received")


class PaginatedPOResponse(BaseModel):
    """Paginated response for purchase order list."""

    data: list[PurchaseOrderResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


def generate_po_number(db_session) -> str:
    """Generate next PO number in format: PO-YYYY-NNN."""
    # This would ideally query the database for the highest number
    # For now, using timestamp-based approach
    import time
    return f"PO-{datetime.now().year}-{int(time.time() % 10000):04d}"


def calculate_po_totals(items: list[PurchaseOrderItemCreate]) -> tuple[Decimal, Decimal, Decimal]:
    """Calculate PO subtotal, tax (10% GST), and total."""
    subtotal = sum(item.quantity * item.unit_cost for item in items)
    tax = subtotal * Decimal("0.10")  # 10% GST
    total = subtotal + tax
    return subtotal, tax, total


@router.get("", response_model=PaginatedPOResponse)
async def list_purchase_orders(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = Query(None, description="Search by PO number"),
    status: str | None = Query(None, description="Filter by status"),
    location: str | None = Query(None, description="Filter by delivery location"),
    supplier_id: UUID | None = Query(None, description="Filter by supplier"),
) -> PaginatedPOResponse:
    """
    List purchase orders with pagination and filters.
    """
    query = select(PurchaseOrder).options(selectinload(PurchaseOrder.items))

    # Apply filters
    if search:
        query = query.where(PurchaseOrder.po_number.ilike(f"%{search}%"))

    if status:
        query = query.where(PurchaseOrder.status == status)

    if location:
        query = query.where(PurchaseOrder.delivery_location == location)

    if supplier_id:
        query = query.where(PurchaseOrder.supplier_id == supplier_id)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.order_by(PurchaseOrder.created_at.desc()).limit(page_size).offset((page - 1) * page_size)

    # Execute
    result = await db.execute(query)
    pos = result.scalars().all()

    return PaginatedPOResponse(
        data=[PurchaseOrderResponse.model_validate(po) for po in pos],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{po_id}", response_model=PurchaseOrderResponse)
async def get_purchase_order(
    po_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> PurchaseOrderResponse:
    """Get a single purchase order by ID with line items."""
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.items))
        .where(PurchaseOrder.id == po_id)
    )
    po = result.scalar_one_or_none()

    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    return PurchaseOrderResponse.model_validate(po)


@router.post("", response_model=PurchaseOrderResponse, status_code=201)
async def create_purchase_order(
    po_data: PurchaseOrderCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> PurchaseOrderResponse:
    """
    Create a new purchase order with line items.

    - Validates supplier exists
    - Validates all products exist
    - Generates PO number
    - Calculates totals (subtotal + 10% GST)
    """
    # Validate supplier exists
    supplier_result = await db.execute(select(Supplier).where(Supplier.id == po_data.supplier_id))
    if not supplier_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Supplier not found")

    # Validate all products exist
    product_ids = [item.product_id for item in po_data.items]
    products_result = await db.execute(select(Product).where(Product.id.in_(product_ids)))
    existing_products = {p.id for p in products_result.scalars().all()}
    missing_products = set(product_ids) - existing_products
    if missing_products:
        raise HTTPException(status_code=400, detail=f"Products not found: {missing_products}")

    # Calculate totals
    subtotal, tax, total = calculate_po_totals(po_data.items)

    # Create PO
    po = PurchaseOrder(
        po_number=generate_po_number(db),
        supplier_id=po_data.supplier_id,
        delivery_location=po_data.delivery_location,
        expected_delivery_date=po_data.expected_delivery_date,
        notes=po_data.notes,
        status="draft",
        subtotal=subtotal,
        tax=tax,
        total=total,
    )
    db.add(po)
    await db.flush()  # Get PO ID before creating items

    # Create line items
    for item_data in po_data.items:
        item = PurchaseOrderItem(
            purchase_order_id=po.id,
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            unit_cost=item_data.unit_cost,
            subtotal=item_data.quantity * item_data.unit_cost,
        )
        db.add(item)

    await db.commit()
    await db.refresh(po)

    # Load items for response
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.items))
        .where(PurchaseOrder.id == po.id)
    )
    po_with_items = result.scalar_one()

    return PurchaseOrderResponse.model_validate(po_with_items)


@router.put("/{po_id}", response_model=PurchaseOrderResponse)
async def update_purchase_order(
    po_id: UUID,
    po_data: PurchaseOrderUpdate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> PurchaseOrderResponse:
    """
    Update a purchase order.

    - Can only update if status is 'draft' or 'pending_approval'
    - Cannot modify items (use separate endpoints)
    """
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.items))
        .where(PurchaseOrder.id == po_id)
    )
    po = result.scalar_one_or_none()

    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # Only allow updates for draft/pending_approval
    if po.status not in ["draft", "pending_approval"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot update PO with status '{po.status}'. Only draft/pending_approval can be modified."
        )

    # Update fields
    update_data = po_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(po, field, value)

    # If status changed to 'ordered', set order_date
    if po_data.status == "ordered" and po.order_date is None:
        po.order_date = datetime.now()

    await db.commit()
    await db.refresh(po)

    return PurchaseOrderResponse.model_validate(po)


@router.post("/{po_id}/items/{item_id}/receive", response_model=PurchaseOrderItemResponse)
async def receive_goods(
    po_id: UUID,
    item_id: UUID,
    receive_data: ReceiveItemRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> PurchaseOrderItemResponse:
    """
    Receive goods for a purchase order line item.

    - Updates quantity_received
    - Updates product stock at delivery location
    - Marks PO as 'received' if all items fully received
    - Can receive partial quantities over multiple calls
    """
    # Get PO and item
    po_result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.items))
        .where(PurchaseOrder.id == po_id)
    )
    po = po_result.scalar_one_or_none()

    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    item = next((i for i in po.items if i.id == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="PO item not found")

    # Validate quantity
    remaining_qty = item.quantity - item.quantity_received
    if receive_data.quantity_received > remaining_qty:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot receive {receive_data.quantity_received} units. Only {remaining_qty} remaining."
        )

    # Update quantity_received
    item.quantity_received += receive_data.quantity_received

    # Update stock at delivery location
    stock_result = await db.execute(
        select(ProductStockByLocation).where(
            ProductStockByLocation.product_id == item.product_id,
            ProductStockByLocation.location == po.delivery_location
        )
    )
    stock = stock_result.scalar_one_or_none()

    if stock:
        stock.quantity_on_hand += receive_data.quantity_received
        stock.quantity_available = stock.quantity_on_hand - stock.quantity_reserved
    else:
        # Create stock record if doesn't exist
        stock = ProductStockByLocation(
            product_id=item.product_id,
            location=po.delivery_location,
            quantity_on_hand=receive_data.quantity_received,
            quantity_reserved=0,
            quantity_available=receive_data.quantity_received,
        )
        db.add(stock)

    # Check if all items fully received
    all_received = all(i.quantity == i.quantity_received for i in po.items)
    if all_received:
        po.status = "received"
        po.actual_delivery_date = datetime.now()

    await db.commit()
    await db.refresh(item)

    return PurchaseOrderItemResponse.model_validate(item)


@router.delete("/{po_id}", status_code=204)
async def cancel_purchase_order(
    po_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """
    Cancel a purchase order (sets status to 'cancelled').

    - Can only cancel if status is 'draft', 'pending_approval', or 'approved'
    - Cannot cancel orders that are in_transit or received
    """
    result = await db.execute(select(PurchaseOrder).where(PurchaseOrder.id == po_id))
    po = result.scalar_one_or_none()

    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    if po.status in ["in_transit", "received"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel PO with status '{po.status}'. Contact supplier for returns."
        )

    po.status = "cancelled"
    await db.commit()
