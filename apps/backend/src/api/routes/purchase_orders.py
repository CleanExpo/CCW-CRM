"""
Purchase Order API endpoints with line items and receiving workflow.

Provides full CRUD operations for purchase orders including:
- Create/update with line items
- Status management (draft → received)
- Goods receipt workflow (partial/full receiving)
- Automatic stock updates on receipt
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import get_current_user
from src.api.middleware.tenant_isolation import CurrentOrganization
from src.config.database import get_async_db
from src.config.xero_settings import XeroSettings, get_xero_settings
from src.db.demo_models import Product
from src.db.inventory_models import (
    ProductStockByLocation,
    PurchaseOrder,
    PurchaseOrderItem,
    Supplier,
)
from src.integrations.xero import get_xero_client
from src.integrations.xero.auth import XeroAuth
from src.integrations.xero.bills import push_purchase_order_as_bill

router = APIRouter(prefix="/api/purchase-orders", tags=["Purchase Orders"], dependencies=[Depends(get_current_user)])


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
    delivery_location: str = Field(..., pattern="^(brisbane|sydney|melbourne)$", description="Warehouse location")  # noqa: E501
    expected_delivery_date: datetime | None = None
    notes: str | None = None
    items: list[PurchaseOrderItemCreate] = Field(..., min_length=1, description="At least one item required")  # noqa: E501


class PurchaseOrderUpdate(BaseModel):
    """Schema for updating a purchase order."""

    supplier_id: UUID | None = None
    delivery_location: str | None = Field(None, pattern="^(brisbane|sydney|melbourne)$")
    expected_delivery_date: datetime | None = None
    notes: str | None = None
    status: str | None = Field(None, pattern="^(draft|pending_approval|approved|ordered|in_transit|received|cancelled)$")  # noqa: E501


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
    query = query.order_by(PurchaseOrder.created_at.desc()).limit(page_size).offset((page - 1) * page_size)  # noqa: E501

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
    po_with_items = result.scalar_one_or_none()

    if not po_with_items:
        # PO was deleted between creation and reload (rare race condition)
        raise HTTPException(status_code=500, detail="Purchase order not found after creation")

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
            detail=f"Cannot update PO with status '{po.status}'. Only draft/pending_approval can be modified."  # noqa: E501
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
            detail=f"Cannot receive {receive_data.quantity_received} units. Only {remaining_qty} remaining."  # noqa: E501
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


@router.delete("/{po_id}", status_code=204, response_model=None)
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


# ============================================
# GAP-016: Three-way match endpoint
# ============================================


class ThreeWayMatchRequest(BaseModel):
    """Request for three-way matching."""

    purchase_order_id: UUID
    goods_receipt_id: UUID
    invoice_id: UUID
    variance_tolerance: Decimal = Decimal("0.05")  # 5%


class ThreeWayMatchResponse(BaseModel):
    """Response from three-way matching."""

    match_status: str  # "FULL_MATCH", "PARTIAL_MATCH", "NO_MATCH"
    confidence: float  # 0.0 to 1.0
    quantity_variance: dict  # {product_id: variance}
    price_variance: dict
    missing_items: list[str]
    extra_items: list[str]
    recommendation: str


@router.post("/three-way-match", response_model=ThreeWayMatchResponse)
async def perform_three_way_match(
    request: ThreeWayMatchRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ThreeWayMatchResponse:
    """
    Perform three-way match: PO + GRN + Invoice.

    Uses procurement_matching service for business logic.
    """
    from src.services.procurement_matching import (
        GRNItem,
        InvoiceItemData,
        POItem,
        match_po_grn_invoice,
    )

    # Get PO items
    po_result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.items))
        .where(PurchaseOrder.id == request.purchase_order_id)
    )
    po = po_result.scalar_one_or_none()

    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    # Convert to service data structures
    po_items = [
        POItem(
            product_id=item.product_id,
            quantity=item.quantity,
            unit_cost=item.unit_cost,
        )
        for item in po.items
    ]

    # Use quantity_received as GRN data (simplified)
    grn_items = [
        GRNItem(
            product_id=item.product_id,
            quantity_received=item.quantity_received,
        )
        for item in po.items
    ]

    # Mock invoice items (in production would fetch from invoice table)
    invoice_items = [
        InvoiceItemData(
            product_id=item.product_id,
            quantity=item.quantity_received,
            unit_price=item.unit_cost,
        )
        for item in po.items
    ]

    # Call service
    result = match_po_grn_invoice(
        po_items=po_items,
        grn_items=grn_items,
        invoice_items=invoice_items,
    )

    # Build response
    quantity_variance = {}
    price_variance = {}
    missing_items = []
    extra_items = []

    for variance in result.variances:
        if variance.variance_type.value == "quantity_variance":
            quantity_variance[str(variance.product_id)] = {
                "expected": variance.expected,
                "actual": variance.actual,
                "description": variance.description,
            }
        elif variance.variance_type.value == "price_variance":
            price_variance[str(variance.product_id)] = {
                "expected": str(variance.expected),
                "actual": str(variance.actual),
                "description": variance.description,
            }
        elif variance.variance_type.value == "missing_item":
            missing_items.append(variance.description)
        elif variance.variance_type.value == "extra_item":
            extra_items.append(variance.description)

    recommendation = ""
    if result.match_status.value == "full_match":
        recommendation = "All items match. Approve for payment."
    elif result.match_status.value == "partial_match":
        recommendation = "Some variances detected. Review before payment."
    else:
        recommendation = "Significant variances. Investigation required before payment."

    return ThreeWayMatchResponse(
        match_status=result.match_status.value.upper(),
        confidence=result.confidence,
        quantity_variance=quantity_variance,
        price_variance=price_variance,
        missing_items=missing_items,
        extra_items=extra_items,
        recommendation=recommendation
    )


# ============================================
# GAP-017: Unmatched PO items endpoint
# ============================================


class UnmatchedPOItem(BaseModel):
    """Unmatched PO item."""

    po_id: UUID
    po_number: str
    product_name: str
    quantity_ordered: int
    quantity_received: int
    quantity_invoiced: int
    days_outstanding: int
    supplier_name: str


class UnmatchedPOItemsResponse(BaseModel):
    """Response for unmatched PO items."""

    items: list[UnmatchedPOItem]
    total: int


@router.get("/unmatched-po-items", response_model=UnmatchedPOItemsResponse)
async def get_unmatched_po_items(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    organization_id: Annotated[UUID, Query()],
    older_than_days: int = Query(30, ge=1),
) -> UnmatchedPOItemsResponse:
    """
    List purchase order items not yet matched to GRN/invoice.
    """

    cutoff_date = datetime.now(UTC) - timedelta(days=older_than_days)

    # Query POs older than cutoff
    stmt = select(PurchaseOrder).options(selectinload(PurchaseOrder.items)).where(
        and_(
            PurchaseOrder.created_at < cutoff_date,
            PurchaseOrder.status.in_(["ordered", "in_transit"])
        )
    )
    result = await db.execute(stmt)
    pos = result.scalars().all()

    items = []

    for po in pos:
        # Fetch supplier name
        supplier_result = await db.execute(
            select(Supplier).where(Supplier.id == po.supplier_id)
        )
        supplier = supplier_result.scalar_one_or_none()
        supplier_name = supplier.name if supplier else "Unknown"

        for po_item in po.items:
            # Check if fully received
            if po_item.quantity_received < po_item.quantity:
                # Fetch product name
                product_result = await db.execute(
                    select(Product).where(Product.id == po_item.product_id)
                )
                product = product_result.scalar_one_or_none()
                product_name = product.name if product else "Unknown"

                days_outstanding = (datetime.now(UTC) - po.created_at).days

                items.append(UnmatchedPOItem(
                    po_id=po.id,
                    po_number=po.po_number,
                    product_name=product_name,
                    quantity_ordered=po_item.quantity,
                    quantity_received=po_item.quantity_received,
                    quantity_invoiced=0,  # Would need invoice tracking
                    days_outstanding=days_outstanding,
                    supplier_name=supplier_name
                ))

    return UnmatchedPOItemsResponse(
        items=items,
        total=len(items)
    )


# ============================================
# UNI-1815: Sync Purchase Order to Xero as Bill
# ============================================


def _get_xero_auth_for_po(
    settings: Annotated[XeroSettings, Depends(get_xero_settings)],
) -> XeroAuth:
    return XeroAuth(
        client_id=settings.client_id,
        client_secret=settings.client_secret,
        redirect_uri=settings.redirect_uri,
        scopes=settings.scopes_list,
    )


@router.post("/{po_id}/sync-to-xero")
async def sync_purchase_order_to_xero(
    po_id: UUID,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    xero_auth: Annotated[XeroAuth, Depends(_get_xero_auth_for_po)],
    settings: Annotated[XeroSettings, Depends(get_xero_settings)],
) -> dict:
    """Push a purchase order to Xero as an Accounts Payable bill (ACCPAY invoice)."""
    result = await db.execute(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.items))
        .where(PurchaseOrder.id == po_id)
    )
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")

    supplier_result = await db.execute(select(Supplier).where(Supplier.id == po.supplier_id))
    supplier = supplier_result.scalar_one_or_none()
    if not supplier or not supplier.xero_contact_id:
        raise HTTPException(status_code=400, detail="Supplier has no linked Xero contact ID")

    connection = await xero_auth.get_active_connection(db, org_id)
    if not connection:
        raise HTTPException(status_code=400, detail="No active Xero connection for this organisation")

    demo_mode = connection.access_token.startswith("demo_")
    xero_client = get_xero_client(
        access_token=connection.access_token,
        tenant_id=connection.tenant_id,
        demo_mode=demo_mode,
    )

    try:
        po_data = {
            "supplier_contact_id": supplier.xero_contact_id,
            "reference": po.po_number,
            "date": po.order_date.date().isoformat() if po.order_date else datetime.now().date().isoformat(),
            "due_date": (
                po.expected_delivery_date.date().isoformat()
                if po.expected_delivery_date
                else datetime.now().date().isoformat()
            ),
            "line_items": [
                {
                    "description": f"Product {item.product_id}",
                    "quantity": item.quantity,
                    "unit_amount": float(item.unit_cost),
                }
                for item in po.items
            ],
        }

        bill_id = await push_purchase_order_as_bill(xero_client, po_data)

        po.xero_purchase_order_id = bill_id
        po.xero_synced_at = datetime.now()
        await db.commit()
    finally:
        await xero_client.close()

    return {"xero_bill_id": bill_id}
