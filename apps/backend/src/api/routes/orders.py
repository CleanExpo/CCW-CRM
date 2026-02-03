"""Orders API routes.

Performance optimized with cache invalidation on writes.
"""
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from src.api.deps import get_optional_user
from src.cache.decorators import invalidate_cache
from src.config.database import get_db
from src.config.settings import Settings, get_settings
from src.services.sse_service import sse_service
from src.db.demo_models import Order as OrderModel
from src.db.demo_models import OrderActivity as OrderActivityModel
from src.db.demo_models import OrderItem as OrderItemModel
from src.db.demo_models import Product as ProductModel
from src.db.inventory_models import ProductStockByLocation, StockAdjustment, StockReservation
from src.db.models import User
from src.db.schemas import (
    Order,
    OrderActivity,
    OrderCreate,
    OrderItem,
    OrderUpdate,
    PaginatedResponse,
)
from pydantic import BaseModel
from src.monitoring import metrics
from src.utils.calculations import calculate_line_total, calculate_totals

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.get("/status-stream")
async def order_status_stream(request: Request):
    """
    PHASE 4: Real-time order status updates via Server-Sent Events (SSE).

    Frontend subscribes to this endpoint to receive live order status changes,
    activity updates, and fulfillment progress without manual refresh.

    Channel: "order-updates"
    Events: status_changed, activity_added, fulfillment_updated
    """
    return await sse_service.subscribe(request, "order-updates", heartbeat_interval=15)


class StatusUpdate(BaseModel):
    """Request body for status updates."""
    status: str
    fulfillment_location: str = "brisbane"


async def invalidate_order_caches() -> None:
    """Invalidate all order-related caches."""
    await invalidate_cache("dashboard_metrics")
    await invalidate_cache("dashboard_revenue")
    await invalidate_cache("dashboard_order_status")
    await invalidate_cache("dashboard_activity")
    await invalidate_cache("dashboard_categories")
    await invalidate_cache("dashboard_top_products")
    await invalidate_cache("dashboard_revenue_location")

RESERVABLE_STATUSES = {"pending", "processing"}


async def generate_order_number(db: AsyncSession) -> str:
    """
    Generate next order number using PostgreSQL SEQUENCE.

    This is guaranteed to be unique and atomic at the database level.
    No race conditions possible.

    Format: ORD-YYYY-NNNNNN (e.g., ORD-2026-000123)
    """
    from sqlalchemy import text

    result = await db.execute(text("SELECT generate_order_number()"))
    order_number = result.scalar()
    return order_number


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

        # Get stock record with pessimistic lock to prevent race conditions
        stmt = select(ProductStockByLocation).where(
            and_(
                ProductStockByLocation.product_id == product_id,
                ProductStockByLocation.location == location,
            )
        ).with_for_update()
        result = await db.execute(stmt)
        stock = result.scalar_one_or_none()

        if not stock:
            # Stock record was deleted between check and reservation (race condition)
            raise HTTPException(
                status_code=400,
                detail=f"Stock record not found for product {product_id} at {location}"
            )

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


def normalize_status(value: str | None) -> str | None:
    if value is None:
        return None
    return value.value if hasattr(value, "value") else str(value)


async def log_order_activity(
    db: AsyncSession,
    order_id: UUID,
    event_type: str,
    message: str,
    created_by: str | None = None,
    meta_data: dict | None = None,
) -> None:
    activity = OrderActivityModel(
        order_id=order_id,
        event_type=event_type,
        message=message,
        created_by=created_by,
        meta_data=meta_data,
    )
    db.add(activity)


def enforce_admin(current_user: User | None, action: str) -> None:
    if current_user and not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail=f"Admin privileges required to {action}.",
        )


async def get_or_create_stock_record(
    db: AsyncSession,
    product_id: UUID,
    location: str,
    fallback_stock: int,
) -> ProductStockByLocation:
    stmt = select(ProductStockByLocation).where(
        and_(
            ProductStockByLocation.product_id == product_id,
            ProductStockByLocation.location == location,
        )
    )
    result = await db.execute(stmt)
    stock = result.scalar_one_or_none()

    if stock:
        return stock

    stock = ProductStockByLocation(
        product_id=product_id,
        location=location,
        stock=max(fallback_stock, 0),
        reserved=0,
    )
    db.add(stock)
    await db.flush()
    return stock


async def reserve_stock_for_order(
    db: AsyncSession,
    order_id: UUID,
    order_items: list[dict],
    location: str,
    products_by_id: dict[UUID, ProductModel],
) -> int:
    insufficient_stock = []

    for item in order_items:
        product_id = item["product_id"]
        product = products_by_id.get(product_id)
        fallback_stock = int(product.stock) if product else 0
        stock = await get_or_create_stock_record(db, product_id, location, fallback_stock)

        if stock.available < item["quantity"]:
            product_name = product.name if product else "Unknown Product"
            insufficient_stock.append({
                "product_name": product_name,
                "product_id": str(product_id),
                "requested": item["quantity"],
                "available": stock.available,
            })

    if insufficient_stock:
        error_details = [
            f"{item['product_name']}: requested {item['requested']}, available {item['available']}"
            for item in insufficient_stock
        ]
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock to reserve at {location}. " + "; ".join(error_details)
        )

    expires_at = datetime.now() + timedelta(hours=24)
    total_reserved = 0
    for item in order_items:
        product_id = item["product_id"]
        product = products_by_id.get(product_id)
        fallback_stock = int(product.stock) if product else 0
        stock = await get_or_create_stock_record(db, product_id, location, fallback_stock)

        reservation = StockReservation(
            product_id=product_id,
            order_id=order_id,
            location=location,
            quantity=item["quantity"],
            status="active",
            expires_at=expires_at,
        )
        db.add(reservation)
        stock.reserved += item["quantity"]
        total_reserved += item["quantity"]

    return total_reserved


async def release_reservations_for_order(
    db: AsyncSession,
    order_id: UUID,
    release_status: str,
) -> int:
    stmt = select(StockReservation).where(
        and_(
            StockReservation.order_id == order_id,
            StockReservation.status == "active",
        )
    )
    result = await db.execute(stmt)
    reservations = result.scalars().all()

    if not reservations:
        return 0

    now = datetime.now()
    released = 0

    # OPTIMIZATION: Batch load all stock records in single query (was N queries)
    product_ids = [r.product_id for r in reservations]
    locations = [r.location for r in reservations]

    stock_stmt = select(ProductStockByLocation).where(
        and_(
            ProductStockByLocation.product_id.in_(product_ids),
            ProductStockByLocation.location.in_(locations),
        )
    )
    stock_result = await db.execute(stock_stmt)
    stocks = stock_result.scalars().all()

    # Create lookup dictionary: (product_id, location) -> stock
    stock_lookup = {(s.product_id, s.location): s for s in stocks}

    # Update reservations and stock in memory (single commit at function end)
    for reservation in reservations:
        stock = stock_lookup.get((reservation.product_id, reservation.location))

        if stock:
            stock.reserved = max(0, stock.reserved - reservation.quantity)

        reservation.status = release_status
        if release_status == "fulfilled":
            reservation.fulfilled_at = now
        else:
            reservation.cancelled_at = now

        released += reservation.quantity

    return released


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
        try:
            # Convert string to OrderStatus enum
            from src.db.demo_models import OrderStatus
            status_enum = OrderStatus(status)
            query = query.where(OrderModel.status == status_enum.value)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status: {status}. Valid values: {[s.value for s in OrderStatus]}"
            )

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
            order_items_list = [OrderItem.model_validate(item).model_dump() for item in o.order_items]  # noqa: E501

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

    response = {
        "id": str(order.id),
        "organization_id": str(order.organization_id) if order.organization_id else None,
        "order_number": order.order_number,
        "customer_id": str(order.customer_id),
        "status": order.status.value if hasattr(order.status, 'value') else order.status,
        "notes": order.notes,
        "total": str(order.total),
        "order_date": order.order_date.isoformat(),
        "fulfillment_location": order.fulfillment_location,
        "tracking_number": order.tracking_number,
        "carrier_name": order.carrier_name,
        "shipped_date": order.shipped_date.isoformat() if order.shipped_date else None,
        "estimated_delivery_date": (
            order.estimated_delivery_date.isoformat()
            if order.estimated_delivery_date
            else None
        ),
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


@router.get("/{order_id}/activity", response_model=list[OrderActivity])
async def get_order_activity(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get audit trail for an order."""
    query = (
        select(OrderActivityModel)
        .where(OrderActivityModel.order_id == order_id)
        .order_by(OrderActivityModel.created_at.desc())
    )
    result = await db.execute(query)
    activities = result.scalars().all()

    return [OrderActivity.model_validate(activity) for activity in activities]


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
    # OPTIMIZATION: Batch load all products in single query (was N queries)
    product_ids = [item.product_id for item in order_data.items]
    products_query = select(ProductModel).where(ProductModel.id.in_(product_ids))
    products_result = await db.execute(products_query)
    products = products_result.scalars().all()

    # Create lookup dictionary
    products_by_id: dict[UUID, ProductModel] = {p.id: p for p in products}

    # Validate all products exist
    missing_ids = set(product_ids) - set(products_by_id.keys())
    if missing_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Products not found: {', '.join(str(id) for id in missing_ids)}"
        )

    # Process items without additional queries
    order_items = []
    line_items_for_calc = []

    for item_data in order_data.items:
        product = products_by_id[item_data.product_id]
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

    await log_order_activity(
        db=db,
        order_id=order.id,
        event_type="created",
        message=f"Order created with {len(order_items)} items.",
        meta_data={
            "status": normalize_status(order_data.status),
            "total": str(total),
        },
    )

    status_value = normalize_status(order_data.status)
    if status_value in RESERVABLE_STATUSES and order_data.fulfillment_location:
        reserved_count = await reserve_stock_for_order(
            db=db,
            order_id=order.id,
            order_items=order_items,
            location=order_data.fulfillment_location,
            products_by_id=products_by_id,
        )
        await log_order_activity(
            db=db,
            order_id=order.id,
            event_type="stock_reserved",
            message=f"Reserved {reserved_count} units at {order_data.fulfillment_location}.",
            meta_data={"location": order_data.fulfillment_location},
        )

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

    # Invalidate order-related caches
    await invalidate_order_caches()

    # PHASE 5: Publish comprehensive real-time events
    # Get customer name for events
    from src.db.demo_models import Customer
    customer_query = select(Customer).where(Customer.id == order_data.customer_id)
    customer_result = await db.execute(customer_query)
    customer = customer_result.scalar_one_or_none()
    customer_name = customer.company_name if customer else "Unknown Customer"

    # Publish to order-updates channel
    await sse_service.publish("order-updates", {
        "event_type": "order_created",
        "order_id": str(order.id),
        "order_number": order_number,
        "customer_name": customer_name,
        "status": order_data.status,
        "total": str(total),
        "timestamp": datetime.utcnow().isoformat(),
    })

    # Publish to dashboard-activity channel
    await sse_service.publish("dashboard-activity", {
        "activity_type": "order_created",
        "title": "New Order",
        "description": f"Order {order_number} created - ${total}",
        "link": f"/orders/{order.id}",
        "timestamp": datetime.utcnow().isoformat(),
    })

    # PHASE 4: Publish dashboard metrics update
    await sse_service.publish("dashboard-metrics", {
        "type": "metrics_updated",
        "metric": "active_orders",
        "change": "increment",
        "timestamp": datetime.utcnow().isoformat(),
    })

    # Track business metrics
    status_value = normalize_status(order.status)
    location = order_data.fulfillment_location or "unknown"
    metrics.orders_created.labels(status=status_value, location=location).inc()
    metrics.orders_revenue.labels(location=location).inc(float(total))

    # Reload with items
    query = (
        select(OrderModel)
        .options(selectinload(OrderModel.order_items))
        .where(OrderModel.id == order.id)
    )
    result = await db.execute(query)
    order = result.scalar_one_or_none()

    if not order:
        # Order was deleted between operation and reload (rare race condition)
        raise HTTPException(status_code=500, detail="Order not found after operation")

    order_dict = Order.model_validate(order).model_dump()
    order_dict["items"] = [
        OrderItem.model_validate(item).model_dump() for item in order.order_items
    ]
    return order_dict


@router.put("/{order_id}", response_model=Order)
async def update_order(
    order_id: UUID,
    order_data: OrderUpdate,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User | None = Depends(get_optional_user),
):
    """Update an order."""
    # Get existing order
    query = select(OrderModel).where(OrderModel.id == order_id)
    result = await db.execute(query)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order_data.status is not None:
        enforce_admin(current_user, "change order status")

    previous_status = order.status.value if hasattr(order.status, "value") else order.status
    previous_notes = order.notes
    previous_tracking_number = order.tracking_number
    previous_carrier_name = order.carrier_name
    previous_shipped_date = order.shipped_date
    previous_estimated_delivery = order.estimated_delivery_date

    # Update fields (excluding items which we'll handle separately)
    update_data = order_data.model_dump(exclude_unset=True, exclude={"items"})
    # Only set fields that exist on the Order model (subtotal and tax don't exist as columns)
    valid_fields = {
        "customer_id",
        "status",
        "notes",
        "total",
        "order_date",
        "fulfillment_location",
        "tracking_number",
        "carrier_name",
        "shipped_date",
        "estimated_delivery_date",
    }
    for field, value in update_data.items():
        if field in valid_fields:
            setattr(order, field, value)

    # Handle line items update if provided
    if order_data.items is not None:
        # Validate order can be edited
        current_status = normalize_status(order.status)
        if current_status in ['shipped', 'delivered', 'cancelled']:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot update items for order in status: {current_status}"
            )

        # Validate all items have valid quantities
        for item_data in order_data.items:
            if item_data.quantity <= 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid quantity {item_data.quantity} for product {item_data.product_id}"
                )

        # Delete existing items
        delete_query = select(OrderItemModel).where(OrderItemModel.order_id == order_id)
        delete_result = await db.execute(delete_query)
        existing_items = delete_result.scalars().all()
        for item in existing_items:
            await db.delete(item)
        await db.flush()

        # Calculate new total and create items
        order_items = []
        line_items_for_calc = []
        products_by_id: dict[UUID, ProductModel] = {}

        for item_data in order_data.items:
            # Get product to get price
            product_query = select(ProductModel).where(ProductModel.id == item_data.product_id)
            product_result = await db.execute(product_query)
            product = product_result.scalar_one_or_none()

            if not product:
                raise HTTPException(
                    status_code=400, detail=f"Product {item_data.product_id} not found"
                )

            # Validate stock availability if order is confirmed
            if current_status == 'confirmed' and product.stock < item_data.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for {product.name}: {product.stock} available, {item_data.quantity} requested"
                )

            unit_price = product.price
            products_by_id[item_data.product_id] = product
            line_total = calculate_line_total(item_data.quantity, unit_price)

            order_items.append({
                "product_id": item_data.product_id,
                "quantity": item_data.quantity,
                "unit_price": unit_price,
                "line_total": line_total,
            })

            line_items_for_calc.append((item_data.quantity, unit_price))

        # Create new order items
        for item_data in order_items:
            item = OrderItemModel(order_id=order.id, **item_data)
            db.add(item)

        totals = calculate_totals(
            line_items_for_calc,
            settings.tax_rate_decimal,
            tax_enabled=True,
        )
        order.total = totals["total"]

        await log_order_activity(
            db=db,
            order_id=order.id,
            event_type="items_updated",
            message=f"Line items updated ({len(order_data.items)} items).",
            meta_data={"total": str(order.total)},
        )

        if normalize_status(order.status) in RESERVABLE_STATUSES:
            released = await release_reservations_for_order(
                db=db,
                order_id=order.id,
                release_status="cancelled",
            )
            if released:
                reserved_count = await reserve_stock_for_order(
                    db=db,
                    order_id=order.id,
                    order_items=order_items,
                    location=order.fulfillment_location or "brisbane",
                    products_by_id=products_by_id,
                )
                await log_order_activity(
                    db=db,
                    order_id=order.id,
                    event_type="stock_reserved",
                    message=f"Reserved {reserved_count} units after item update.",
                    meta_data={"location": order.fulfillment_location or "brisbane"},
                )

    if order_data.status is not None:
        updated_status = order.status.value if hasattr(order.status, "value") else order.status
        if updated_status != previous_status:
            await log_order_activity(
                db=db,
                order_id=order.id,
                event_type="status_updated",
                message=f"Status changed from {previous_status} to {updated_status}.",
                meta_data={"from": previous_status, "to": updated_status},
            )

            # PHASE 4: Publish real-time status update to SSE subscribers
            await sse_service.publish("order-updates", {
                "type": "status_changed",
                "order_id": str(order.id),
                "order_number": order.order_number,
                "previous_status": previous_status,
                "new_status": updated_status,
            })

            if previous_status in RESERVABLE_STATUSES and updated_status not in RESERVABLE_STATUSES:
                released = await release_reservations_for_order(
                    db=db,
                    order_id=order.id,
                    release_status="cancelled",
                )
                if released:
                    await log_order_activity(
                        db=db,
                        order_id=order.id,
                        event_type="stock_released",
                        message=f"Released {released} reserved units.",
                        meta_data={"reason": "status_change"},
                    )

    if order_data.notes is not None and order_data.notes != previous_notes:
        await log_order_activity(
            db=db,
            order_id=order.id,
            event_type="notes_updated",
            message="Order notes updated.",
        )

    tracking_changed = (
        order.tracking_number != previous_tracking_number
        or order.carrier_name != previous_carrier_name
        or order.shipped_date != previous_shipped_date
        or order.estimated_delivery_date != previous_estimated_delivery
    )
    if tracking_changed:
        await log_order_activity(
            db=db,
            order_id=order.id,
            event_type="fulfillment_updated",
            message="Fulfillment tracking updated.",
            meta_data={
                "tracking_number": order.tracking_number,
                "carrier_name": order.carrier_name,
            },
        )

        # PHASE 4: Publish real-time fulfillment update to SSE subscribers
        await sse_service.publish("order-updates", {
            "type": "fulfillment_updated",
            "order_id": str(order.id),
            "order_number": order.order_number,
            "tracking_number": order.tracking_number,
            "carrier_name": order.carrier_name,
            "shipped_date": str(order.shipped_date) if order.shipped_date else None,
            "estimated_delivery_date": str(order.estimated_delivery_date) if order.estimated_delivery_date else None,
        })

    await db.commit()
    await db.refresh(order)

    # Invalidate order-related caches
    await invalidate_order_caches()

    # PHASE 4: Publish dashboard metrics update if status changed
    if order_data.status is not None and updated_status != previous_status:
        await sse_service.publish("dashboard-metrics", {
            "type": "metrics_updated",
            "metric": "active_orders",
            "change": "status_change",
            "timestamp": datetime.utcnow().isoformat(),
        })

    # Reload with items
    query = (
        select(OrderModel)
        .options(selectinload(OrderModel.order_items))
        .where(OrderModel.id == order.id)
    )
    result = await db.execute(query)
    order = result.scalar_one_or_none()

    if not order:
        # Order was deleted between operation and reload (rare race condition)
        raise HTTPException(status_code=500, detail="Order not found after operation")

    order_dict = Order.model_validate(order).model_dump()
    order_dict["items"] = [
        OrderItem.model_validate(item).model_dump() for item in order.order_items
    ]
    return order_dict


@router.put("/{order_id}/status", response_model=Order)
async def update_order_status(
    order_id: UUID,
    status: str = Query(..., description="New status"),
    fulfillment_location: str = Query("brisbane", description="Fulfillment location"),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """Update order status and deduct stock when confirming with pessimistic locking."""
    # Get existing order with items using pessimistic lock to prevent race conditions
    query = select(OrderModel).options(
        selectinload(OrderModel.order_items)
    ).where(OrderModel.id == order_id).with_for_update()
    result = await db.execute(query)
    order = result.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    enforce_admin(current_user, "change order status")

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
        released = await release_reservations_for_order(
            db=db,
            order_id=order.id,
            release_status="fulfilled",
        )
        if released:
            await log_order_activity(
                db=db,
                order_id=order.id,
                event_type="stock_released",
                message=f"Released {released} reserved units for fulfillment.",
                meta_data={"reason": "order_confirmed"},
            )

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

    if old_status in RESERVABLE_STATUSES and status not in RESERVABLE_STATUSES and not is_confirming:
        released = await release_reservations_for_order(
            db=db,
            order_id=order.id,
            release_status="cancelled",
        )
        if released:
            await log_order_activity(
                db=db,
                order_id=order.id,
                event_type="stock_released",
                message=f"Released {released} reserved units.",
                meta_data={"reason": "status_change"},
            )

    await log_order_activity(
        db=db,
        order_id=order.id,
        event_type="status_updated",
        message=f"Status changed from {old_status} to {status}.",
        meta_data={"from": old_status, "to": status},
    )
    await db.commit()
    await db.refresh(order)

    # Invalidate order-related caches
    await invalidate_order_caches()

    # Track business metrics for status changes
    location = order.fulfillment_location or "unknown"
    if status == "confirmed":
        metrics.orders_confirmed.labels(location=location).inc()
    elif status == "shipped":
        metrics.orders_shipped.labels(location=location).inc()
    elif status == "delivered":
        metrics.orders_delivered.labels(location=location).inc()

    # Reload with items
    query = (
        select(OrderModel)
        .options(selectinload(OrderModel.order_items))
        .where(OrderModel.id == order.id)
    )
    result = await db.execute(query)
    order = result.scalar_one_or_none()

    if not order:
        # Order was deleted between operation and reload (rare race condition)
        raise HTTPException(status_code=500, detail="Order not found after operation")

    order_dict = Order.model_validate(order).model_dump()
    order_dict["items"] = [
        OrderItem.model_validate(item).model_dump() for item in order.order_items
    ]
    return order_dict


@router.patch("/{order_id}/status", response_model=Order)
async def update_order_status_patch(
    order_id: UUID,
    status_update: StatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """
    Update order status (PATCH endpoint accepting JSON body).

    This is the RESTful PATCH version that accepts JSON body.
    The PUT version uses query parameters for backwards compatibility.
    """
    # Call the existing PUT endpoint logic with query params extracted from body
    return await update_order_status(
        order_id=order_id,
        status=status_update.status,
        fulfillment_location=status_update.fulfillment_location,
        db=db,
        current_user=current_user,
    )


@router.delete("/{order_id}", status_code=204)
async def delete_order(
    order_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> None:
    """Delete an order and its items."""
    enforce_admin(current_user, "delete orders")
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

    # Invalidate order-related caches
    await invalidate_order_caches()

    # Return None for 204 No Content - proper REST standard
    return None
