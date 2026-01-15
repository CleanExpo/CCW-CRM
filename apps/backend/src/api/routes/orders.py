"""Orders API routes."""
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from src.config.database import get_db
from src.config.settings import Settings, get_settings
from src.db.demo_models import Order as OrderModel
from src.db.demo_models import OrderItem as OrderItemModel
from src.db.demo_models import Product as ProductModel
from src.db.demo_models import Customer as CustomerModel
from src.db.inventory_models import ProductStockByLocation, StockAdjustment
from src.db.schemas import Order, OrderCreate, OrderUpdate, OrderItem, PaginatedResponse
from src.utils.calculations import calculate_line_total, calculate_totals

router = APIRouter(prefix="/api/orders", tags=["orders"])


async def generate_order_number(db: AsyncSession) -> str:
    """Generate next order number."""
    year = datetime.now().year
    # Get count of orders this year
    query = select(func.count()).where(OrderModel.order_number.like(f"ORD-{year}-%"))
    result = await db.execute(query)
    count = result.scalar_one()
    return f"ORD-{year}-{count + 1:03d}"


async def deduct_stock_for_order(
    db: AsyncSession,
    order_items: list[dict],
    location: str,
    order_id: UUID,
) -> None:
    """Deduct stock from inventory when order is confirmed.

    Args:
        db: Database session
        order_items: List of order items with product_id and quantity
        location: Fulfillment location (brisbane, sydney, melbourne)
        order_id: Order ID for reference

    Raises:
        HTTPException: If insufficient stock available
    """
    # First, check all products have sufficient stock
    insufficient_stock = []

    for item in order_items:
        product_id = item["product_id"]
        quantity = item["quantity"]

        # Check stock availability
        stmt = select(ProductStockByLocation, ProductModel).join(
            ProductModel, ProductStockByLocation.product_id == ProductModel.id
        ).where(
            and_(
                ProductStockByLocation.product_id == product_id,
                ProductStockByLocation.location == location,
            )
        )
        result = await db.execute(stmt)
        row = result.first()

        if not row or row[0].available < quantity:
            stock_available = row[0].available if row else 0
            product_name = row[1].name if row else "Unknown Product"
            insufficient_stock.append({
                "product_name": product_name,
                "product_id": str(product_id),
                "requested": quantity,
                "available": stock_available,
            })

    # If any product has insufficient stock, raise error
    if insufficient_stock:
        error_details = [
            f"{item['product_name']}: requested {item['requested']}, available {item['available']}"
            for item in insufficient_stock
        ]
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock at {location}. " + "; ".join(error_details)
        )

    # Deduct stock for each item
    for item in order_items:
        product_id = item["product_id"]
        quantity = item["quantity"]

        # Get stock record
        stmt = select(ProductStockByLocation).where(
            and_(
                ProductStockByLocation.product_id == product_id,
                ProductStockByLocation.location == location,
            )
        )
        result = await db.execute(stmt)
        stock = result.scalar_one()

        previous_qty = stock.stock
        stock.stock -= quantity

        # Log stock adjustment
        adjustment = StockAdjustment(
            product_id=product_id,
            location=location,
            quantity_change=-quantity,
            previous_quantity=previous_qty,
            new_quantity=stock.stock,
            adjustment_type="order_fulfillment",
            reason=f"Order {str(order_id)[:8]} confirmed",
            reference_id=order_id,
        )
        db.add(adjustment)


@router.get("", response_model=PaginatedResponse)
async def list_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = None,
    status: str | None = None,
    customer_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List orders with pagination and filters."""
    # Build query
    query = select(OrderModel).options(
        selectinload(OrderModel.order_items),
        joinedload(OrderModel.customer)
    )

    # Apply filters
    if search:
        search_filter = f"%{search}%"
        query = query.where(OrderModel.order_number.ilike(search_filter))

    if status:
        query = query.where(OrderModel.status == status)

    if customer_id:
        query = query.where(OrderModel.customer_id == customer_id)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar_one()

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(OrderModel.created_at.desc())

    # Execute query
    result = await db.execute(query)
    orders = result.scalars().all()

    # Build response with customer_name and items included
    items = []
    for o in orders:
        # Access relationships BEFORE converting to Pydantic to ensure they are loaded
        customer_name = "Unknown Customer"
        if hasattr(o, 'customer') and o.customer:
            customer_name = o.customer.company_name

        # Access order_items before Pydantic conversion
        order_items_list = []
        if hasattr(o, 'order_items') and o.order_items:
            order_items_list = [OrderItem.model_validate(item).model_dump() for item in o.order_items]

        # Convert order to dict
        order_dict = Order.model_validate(o).model_dump()

        # Override with accessed values
        order_dict["customer_name"] = customer_name
        order_dict["items"] = order_items_list

        items.append(order_dict)

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/{order_id}")
async def get_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single order by ID."""
    query = (
        select(OrderModel)
        .options(selectinload(OrderModel.order_items))
        .where(OrderModel.id == order_id)
    )
    result = await db.execute(query)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Manually build response dict from SQLAlchemy model
    from src.db.schemas import OrderItem as OrderItemSchema

    response = {
        "id": str(order.id),
        "organization_id": str(order.organization_id) if order.organization_id else None,
        "order_number": order.order_number,
        "customer_id": str(order.customer_id),
        "status": order.status.value if hasattr(order.status, 'value') else order.status,
        "notes": order.notes,
        "total": str(order.total),
        "order_date": order.order_date.isoformat(),
        "created_at": order.created_at.isoformat(),
        "updated_at": order.updated_at.isoformat(),
        # Manually serialize order_items
        "order_items": [
            {
                "id": str(item.id),
                "order_id": str(item.order_id),
                "product_id": str(item.product_id),
                "quantity": item.quantity,
                "unit_price": str(item.unit_price),
                "line_total": str(item.line_total),
                "created_at": item.created_at.isoformat(),
            }
            for item in order.order_items
        ],
        # Also provide 'items' for frontend compatibility
        "items": [
            {
                "id": str(item.id),
                "order_id": str(item.order_id),
                "product_id": str(item.product_id),
                "quantity": item.quantity,
                "unit_price": str(item.unit_price),
                "line_total": str(item.line_total),
                "created_at": item.created_at.isoformat(),
            }
            for item in order.order_items
        ],
    }

    return response


@router.post("", response_model=Order, status_code=201)
async def create_order(
    order_data: OrderCreate,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Create a new order with items."""
    # Generate order number
    order_number = await generate_order_number(db)

    # Calculate totals using shared calculation utilities
    order_items = []
    line_items_for_calc = []

    for item_data in order_data.items:
        # Get product to get price
        product_query = select(ProductModel).where(ProductModel.id == item_data.product_id)
        product_result = await db.execute(product_query)
        product = product_result.scalar_one_or_none()

        if not product:
            raise HTTPException(
                status_code=400, detail=f"Product {item_data.product_id} not found"
            )

        unit_price = product.price
        # Use shared calculation utility for line total
        line_total = calculate_line_total(item_data.quantity, unit_price)

        order_items.append({
            "product_id": item_data.product_id,
            "quantity": item_data.quantity,
            "unit_price": unit_price,
            "line_total": line_total,
        })

        line_items_for_calc.append((item_data.quantity, unit_price))

    # Calculate totals with tax using shared utility
    totals = calculate_totals(line_items_for_calc, settings.tax_rate_decimal, tax_enabled=True)
    total = totals["total"]

    # Create order
    order = OrderModel(
        order_number=order_number,
        customer_id=order_data.customer_id,
        status=order_data.status,
        total=total,
        notes=order_data.notes,
    )
    db.add(order)
    await db.flush()

    # Create order items
    for item_data in order_items:
        item = OrderItemModel(order_id=order.id, **item_data)
        db.add(item)

    # Deduct stock if order is confirmed
    if order_data.status == "confirmed":
        await deduct_stock_for_order(
            db=db,
            order_items=order_items,
            location=order_data.fulfillment_location,
            order_id=order.id,
        )

    await db.commit()
    await db.refresh(order)

    # Reload with items
    query = (
        select(OrderModel)
        .options(selectinload(OrderModel.order_items))
        .where(OrderModel.id == order.id)
    )
    result = await db.execute(query)
    order = result.scalar_one()

    return Order.model_validate(order)


@router.put("/{order_id}", response_model=Order)
async def update_order(
    order_id: UUID,
    order_data: OrderUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update an order."""
    # Get existing order
    query = select(OrderModel).where(OrderModel.id == order_id)
    result = await db.execute(query)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Update fields (excluding items which we'll handle separately)
    update_data = order_data.model_dump(exclude_unset=True, exclude={"items"})
    # Only set fields that exist on the Order model (subtotal and tax don't exist as columns)
    valid_fields = {"customer_id", "status", "notes", "total", "order_date"}
    for field, value in update_data.items():
        if field in valid_fields:
            setattr(order, field, value)

    # Handle line items update if provided
    if order_data.items is not None:
        # Delete existing items
        delete_query = select(OrderItemModel).where(OrderItemModel.order_id == order_id)
        delete_result = await db.execute(delete_query)
        existing_items = delete_result.scalars().all()
        for item in existing_items:
            await db.delete(item)
        await db.flush()

        # Calculate new total and create items
        total = Decimal("0.00")
        order_items = []

        for item_data in order_data.items:
            # Get product to get price
            product_query = select(ProductModel).where(ProductModel.id == item_data.product_id)
            product_result = await db.execute(product_query)
            product = product_result.scalar_one_or_none()

            if not product:
                raise HTTPException(
                    status_code=400, detail=f"Product {item_data.product_id} not found"
                )

            unit_price = product.price
            line_total = unit_price * item_data.quantity
            total += line_total

            order_items.append({
                "product_id": item_data.product_id,
                "quantity": item_data.quantity,
                "unit_price": unit_price,
                "line_total": line_total,
            })

        # Create new order items
        for item_data in order_items:
            item = OrderItemModel(order_id=order.id, **item_data)
            db.add(item)

        # Update order total
        order.total = total

    await db.commit()
    await db.refresh(order)

    # Reload with items
    query = (
        select(OrderModel)
        .options(selectinload(OrderModel.order_items))
        .where(OrderModel.id == order.id)
    )
    result = await db.execute(query)
    order = result.scalar_one()

    return Order.model_validate(order)


@router.put("/{order_id}/status", response_model=Order)
async def update_order_status(
    order_id: UUID,
    status: str = Query(..., description="New status"),
    fulfillment_location: str = Query("brisbane", description="Fulfillment location"),
    db: AsyncSession = Depends(get_db),
):
    """Update order status and deduct stock when confirming."""
    # Get existing order with items
    query = select(OrderModel).options(
        selectinload(OrderModel.order_items)
    ).where(OrderModel.id == order_id)
    result = await db.execute(query)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Validate status
    valid_statuses = [
        "draft", "pending", "confirmed", "processing",
        "shipped", "delivered", "cancelled"
    ]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )

    # Check if changing TO confirmed status (and not already confirmed)
    old_status = order.status.value if hasattr(order.status, 'value') else order.status
    is_confirming = status == "confirmed" and old_status != "confirmed"

    # Deduct stock if confirming order
    if is_confirming:
        # Prepare order items for stock deduction
        order_items = [
            {
                "product_id": item.product_id,
                "quantity": item.quantity,
            }
            for item in order.order_items
        ]

        await deduct_stock_for_order(
            db=db,
            order_items=order_items,
            location=fulfillment_location,
            order_id=order.id,
        )

    order.status = status
    await db.commit()
    await db.refresh(order)

    # Reload with items
    query = (
        select(OrderModel)
        .options(selectinload(OrderModel.order_items))
        .where(OrderModel.id == order.id)
    )
    result = await db.execute(query)
    order = result.scalar_one()

    return Order.model_validate(order)


@router.delete("/{order_id}")
async def delete_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete an order and its items."""
    # Get existing order
    query = select(OrderModel).where(OrderModel.id == order_id)
    result = await db.execute(query)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Delete order items first
    delete_items_query = select(OrderItemModel).where(OrderItemModel.order_id == order_id)
    items_result = await db.execute(delete_items_query)
    items = items_result.scalars().all()
    for item in items:
        await db.delete(item)

    # Delete the order
    await db.delete(order)
    await db.commit()

    return {"message": "Order deleted successfully", "order_id": str(order_id)}
