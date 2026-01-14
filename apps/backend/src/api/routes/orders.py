"""Orders API routes."""
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.config.database import get_db
from src.db.demo_models import Order as OrderModel
from src.db.demo_models import OrderItem as OrderItemModel
from src.db.demo_models import Product as ProductModel
from src.db.schemas import Order, OrderCreate, OrderUpdate, PaginatedResponse

router = APIRouter(prefix="/api/orders", tags=["orders"])


async def generate_order_number(db: AsyncSession) -> str:
    """Generate next order number."""
    year = datetime.now().year
    # Get count of orders this year
    query = select(func.count()).where(OrderModel.order_number.like(f"ORD-{year}-%"))
    result = await db.execute(query)
    count = result.scalar_one()
    return f"ORD-{year}-{count + 1:03d}"


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
    query = select(OrderModel).options(selectinload(OrderModel.items))

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

    return {
        "items": [Order.model_validate(o) for o in orders],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/{order_id}", response_model=Order)
async def get_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single order by ID."""
    query = (
        select(OrderModel)
        .options(selectinload(OrderModel.items))
        .where(OrderModel.id == order_id)
    )
    result = await db.execute(query)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return Order.model_validate(order)


@router.post("", response_model=Order, status_code=201)
async def create_order(
    order_data: OrderCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new order with items."""
    # Generate order number
    order_number = await generate_order_number(db)

    # Batch fetch all products at once (avoid N+1 queries)
    product_ids = [item.product_id for item in order_data.items]
    products_result = await db.execute(
        select(ProductModel).where(ProductModel.id.in_(product_ids))
    )
    products_map = {p.id: p for p in products_result.scalars().all()}

    # Validate all products exist
    missing_products = [pid for pid in product_ids if pid not in products_map]
    if missing_products:
        raise HTTPException(
            status_code=400, detail=f"Products not found: {missing_products}"
        )

    # Calculate total from items
    total = Decimal("0.00")
    order_items = []

    for item_data in order_data.items:
        product = products_map[item_data.product_id]
        unit_price = product.price
        line_total = unit_price * item_data.quantity
        total += line_total

        order_items.append({
            "product_id": item_data.product_id,
            "quantity": item_data.quantity,
            "unit_price": unit_price,
            "line_total": line_total,
        })

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

    await db.commit()

    # Reload with items (single query, no redundant refresh)
    query = (
        select(OrderModel)
        .options(selectinload(OrderModel.items))
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
        # Bulk delete existing items (avoid N+1)
        await db.execute(delete(OrderItemModel).where(OrderItemModel.order_id == order_id))
        await db.flush()

        # Batch fetch all products at once (avoid N+1 queries)
        product_ids = [item.product_id for item in order_data.items]
        products_result = await db.execute(
            select(ProductModel).where(ProductModel.id.in_(product_ids))
        )
        products_map = {p.id: p for p in products_result.scalars().all()}

        # Validate all products exist
        missing_products = [pid for pid in product_ids if pid not in products_map]
        if missing_products:
            raise HTTPException(
                status_code=400, detail=f"Products not found: {missing_products}"
            )

        # Calculate new total and create items
        total = Decimal("0.00")
        order_items = []

        for item_data in order_data.items:
            product = products_map[item_data.product_id]
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

    # Reload with items (single query, no redundant refresh)
    query = (
        select(OrderModel)
        .options(selectinload(OrderModel.items))
        .where(OrderModel.id == order.id)
    )
    result = await db.execute(query)
    order = result.scalar_one()

    return Order.model_validate(order)


@router.put("/{order_id}/status", response_model=Order)
async def update_order_status(
    order_id: UUID,
    status: str = Query(..., description="New status"),
    db: AsyncSession = Depends(get_db),
):
    """Update order status."""
    # Get existing order
    query = select(OrderModel).where(OrderModel.id == order_id)
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

    order.status = status
    await db.commit()

    # Reload with items (single query, no redundant refresh)
    query = (
        select(OrderModel)
        .options(selectinload(OrderModel.items))
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

    # Bulk delete order items first (avoid N+1)
    await db.execute(delete(OrderItemModel).where(OrderItemModel.order_id == order_id))

    # Delete the order
    await db.delete(order)
    await db.commit()

    return {"message": "Order deleted successfully", "order_id": str(order_id)}
