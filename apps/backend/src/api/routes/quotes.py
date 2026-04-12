"""Quotes API routes.

Performance optimized with cache invalidation on writes.
"""
from datetime import UTC, datetime, time, timedelta
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.api.deps import get_current_user
from src.cache.decorators import invalidate_cache
from src.config.database import get_async_db
from src.config.settings import Settings, get_settings
from src.db.demo_models import Customer as CustomerModel
from src.db.demo_models import Order as OrderModel
from src.db.demo_models import OrderItem as OrderItemModel
from src.db.demo_models import Product as ProductModel
from src.db.demo_models import Quote as QuoteModel
from src.db.demo_models import QuoteItem as QuoteItemModel
from src.db.schemas import (
    Order,
    OrderItem,
    PaginatedResponse,
    Quote,
    QuoteCreate,
    QuoteItem,
    QuoteUpdate,
)
from src.monitoring import metrics
from src.services.email_notifications import email_service
from src.services.sse_service import sse_service
from src.utils.calculations import calculate_line_total, calculate_totals

router = APIRouter(prefix="/api/quotes", tags=["quotes"], dependencies=[Depends(get_current_user)])


class StatusUpdate(BaseModel):
    """Request body for status updates."""
    status: str


async def invalidate_quote_caches() -> None:
    """Invalidate all quote-related caches."""
    await invalidate_cache("dashboard_metrics")
    await invalidate_cache("dashboard_quote_conversion")
    await invalidate_cache("dashboard_activity")


async def generate_quote_number(db: AsyncSession) -> str:
    """
    Generate next quote number using PostgreSQL SEQUENCE.

    This is guaranteed to be unique and atomic at the database level.
    No race conditions possible.

    Format: Q-YYYY-NNNNNN (e.g., Q-2026-000456)
    """
    from sqlalchemy import text

    result = await db.execute(text("SELECT generate_quote_number()"))
    quote_number = result.scalar()
    return quote_number


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


@router.get("", response_model=PaginatedResponse)
async def list_quotes(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = None,
    status: str | None = None,
    customer_id: UUID | None = None,
    db: AsyncSession = Depends(get_async_db),
):
    """List quotes with pagination and filters."""
    # Build query
    query = select(QuoteModel).options(selectinload(QuoteModel.quote_items))

    # Apply filters
    if search:
        search_filter = f"%{search}%"
        query = query.where(QuoteModel.quote_number.ilike(search_filter))

    if status:
        query = query.where(QuoteModel.status == status)

    if customer_id:
        query = query.where(QuoteModel.customer_id == customer_id)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar_one()

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(QuoteModel.created_at.desc())

    # Execute query
    result = await db.execute(query)
    quotes = result.scalars().all()

    items = []
    for q in quotes:
        quote_dict = Quote.model_validate(q).model_dump()
        # Pydantic serializer handles valid_until conversion
        quote_dict["items"] = [
            QuoteItem.model_validate(item).model_dump()
            for item in q.quote_items
        ]
        items.append(quote_dict)

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/{quote_id}")
async def get_quote(
    quote_id: UUID,
    db: AsyncSession = Depends(get_async_db),
):
    """Get a single quote by ID."""
    query = (
        select(QuoteModel)
        .options(selectinload(QuoteModel.quote_items))
        .where(QuoteModel.id == quote_id)
    )
    result = await db.execute(query)
    quote = result.scalar_one_or_none()

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Use Pydantic serialization (handles status enum and valid_until conversion)
    quote_dict = Quote.model_validate(quote).model_dump()
    quote_dict["items"] = [
        QuoteItem.model_validate(item).model_dump()
        for item in quote.quote_items
    ]
    return quote_dict


@router.post("", response_model=Quote, status_code=201)
async def create_quote(
    quote_data: QuoteCreate,
    db: AsyncSession = Depends(get_async_db),
    settings: Settings = Depends(get_settings),
):
    """Create a new quote with items."""
    # Generate quote number
    quote_number = await generate_quote_number(db)
    # Pydantic validator now handles datetime conversion
    valid_until = quote_data.valid_until

    # Calculate totals using shared calculation utilities
    quote_items = []
    line_items_for_calc = []

    # OPTIMIZATION: Batch load all products in single query (was N queries)
    product_ids = [item.product_id for item in quote_data.items]
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
    for item_data in quote_data.items:
        product = products_by_id[item_data.product_id]
        unit_price = product.price

        # Use shared calculation utility for line total
        line_total = calculate_line_total(item_data.quantity, unit_price)

        quote_items.append({
            "product_id": item_data.product_id,
            "quantity": item_data.quantity,
            "unit_price": unit_price,
            "line_total": line_total,
        })

        line_items_for_calc.append((item_data.quantity, unit_price))

    # Calculate totals with tax using shared utility
    totals = calculate_totals(line_items_for_calc, settings.tax_rate_decimal, tax_enabled=True)
    total = totals["total"]

    # Create quote
    quote = QuoteModel(
        quote_number=quote_number,
        customer_id=quote_data.customer_id,
        status=quote_data.status,
        total=total,
        valid_until=valid_until,
        notes=quote_data.notes,
    )
    db.add(quote)
    await db.flush()

    # Create quote items - BULK INSERT OPTIMIZATION (ISS-031)
    # Use add_all() for single bulk insert instead of individual adds
    quote_item_models = [
        QuoteItemModel(quote_id=quote.id, **item_data)
        for item_data in quote_items
    ]
    db.add_all(quote_item_models)

    await db.commit()

    # Refresh with items relationship loaded (no separate query = no race condition)
    await db.refresh(quote, attribute_names=['quote_items'])

    # Invalidate quote-related caches
    await invalidate_quote_caches()

    # Track business metrics (Pydantic ensures status is QuoteStatus enum)
    metrics.quotes_created.labels(status=quote.status.value).inc()

    # Publish real-time events
    await sse_service.publish("dashboard-metrics", {
        "type": "metrics_updated",
        "metric": "pending_quotes",
        "change": "increment",
        "timestamp": datetime.now(UTC).isoformat(),
    })

    await sse_service.publish("dashboard-activity", {
        "activity_type": "quote_created",
        "title": "New Quote",
        "description": f"Quote {quote_number} created - ${total}",
        "link": f"/quotes/{quote.id}",
        "timestamp": datetime.now(UTC).isoformat(),
    })

    # Build response from already-loaded quote object (Pydantic serializer handles valid_until)
    quote_dict = Quote.model_validate(quote).model_dump()
    quote_dict["items"] = [
        QuoteItem.model_validate(item).model_dump()
        for item in quote.quote_items
    ]
    return quote_dict


@router.put("/{quote_id}", response_model=Quote)
async def update_quote(
    quote_id: UUID,
    quote_data: QuoteUpdate,
    db: AsyncSession = Depends(get_async_db),
    settings: Settings = Depends(get_settings),
):
    """Update a quote."""
    # Get existing quote
    query = select(QuoteModel).where(QuoteModel.id == quote_id)
    result = await db.execute(query)
    quote = result.scalar_one_or_none()

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Update fields (excluding items which we'll handle separately)
    update_data = quote_data.model_dump(exclude_unset=True, exclude={"items"})
    if update_data.get("valid_until"):
        update_data["valid_until"] = datetime.combine(
            update_data["valid_until"],
            time.min,
            tzinfo=UTC,
        )
    for field, value in update_data.items():
        setattr(quote, field, value)

    # Handle line items update if provided
    if quote_data.items is not None:
        # Delete existing items
        delete_query = select(QuoteItemModel).where(QuoteItemModel.quote_id == quote_id)
        delete_result = await db.execute(delete_query)
        existing_items = delete_result.scalars().all()
        for item in existing_items:
            await db.delete(item)
        await db.flush()

        # Calculate new total and create items
        # OPTIMIZATION: Batch load all products in single query (was N queries)
        product_ids = [item.product_id for item in quote_data.items]
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
        quote_items = []
        line_items_for_calc = []

        for item_data in quote_data.items:
            product = products_by_id[item_data.product_id]
            unit_price = product.price
            line_total = calculate_line_total(item_data.quantity, unit_price)

            quote_items.append({
                "product_id": item_data.product_id,
                "quantity": item_data.quantity,
                "unit_price": unit_price,
                "line_total": line_total,
            })

            line_items_for_calc.append((item_data.quantity, unit_price))

        # Create new quote items - BULK INSERT OPTIMIZATION (ISS-031)
        # Use add_all() for single bulk insert instead of individual adds
        quote_item_models = [
            QuoteItemModel(quote_id=quote.id, **item_data)
            for item_data in quote_items
        ]
        db.add_all(quote_item_models)

        totals = calculate_totals(
            line_items_for_calc,
            settings.tax_rate_decimal,
            tax_enabled=True,
        )
        quote.total = totals["total"]

    await db.commit()

    # Refresh with items relationship loaded (no separate query = no race condition)
    await db.refresh(quote, attribute_names=['quote_items'])

    # Invalidate quote-related caches
    await invalidate_quote_caches()

    # Publish real-time update
    await sse_service.publish("dashboard-activity", {
        "activity_type": "quote_updated",
        "title": "Quote Updated",
        "description": f"Quote {quote.quote_number} updated",
        "link": f"/quotes/{quote.id}",
        "timestamp": datetime.now(UTC).isoformat(),
    })

    # Build response from already-loaded quote object (Pydantic serializer handles valid_until)
    quote_dict = Quote.model_validate(quote).model_dump()
    quote_dict["items"] = [
        QuoteItem.model_validate(item).model_dump()
        for item in quote.quote_items
    ]
    return quote_dict


@router.delete("/{quote_id}", status_code=204, response_model=None)
async def delete_quote(
    quote_id: UUID,
    db: AsyncSession = Depends(get_async_db),
):
    """Delete a quote and its items."""
    # Get existing quote
    query = select(QuoteModel).where(QuoteModel.id == quote_id)
    result = await db.execute(query)
    quote = result.scalar_one_or_none()

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Store info before deletion
    quote_number = quote.quote_number

    # Delete quote (cascade will delete items)
    await db.delete(quote)
    await db.commit()

    # Invalidate quote-related caches
    await invalidate_quote_caches()

    # Publish real-time events
    await sse_service.publish("dashboard-metrics", {
        "type": "metrics_updated",
        "metric": "pending_quotes",
        "change": "decrement",
        "timestamp": datetime.now(UTC).isoformat(),
    })

    await sse_service.publish("dashboard-activity", {
        "activity_type": "quote_deleted",
        "title": "Quote Deleted",
        "description": f"Quote {quote_number} deleted",
        "link": "/quotes",
        "timestamp": datetime.now(UTC).isoformat(),
    })

    return None


@router.patch("/{quote_id}/status", response_model=Quote)
async def update_quote_status(
    quote_id: UUID,
    status_update: StatusUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_async_db),
):
    """
    Update quote status (PATCH endpoint accepting JSON body).

    Validates status and updates the quote. RESTful endpoint.
    """
    # Get existing quote
    query = select(QuoteModel).where(QuoteModel.id == quote_id)
    result = await db.execute(query)
    quote = result.scalar_one_or_none()

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Validate status (must be a valid QuoteStatus)
    valid_statuses = ["draft", "pending", "sent", "accepted", "rejected", "expired"]
    if status_update.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )

    # Update status
    quote.status = status_update.status
    await db.commit()

    # Refresh with items relationship loaded (no separate query = no race condition)
    await db.refresh(quote, attribute_names=['quote_items'])

    # Invalidate quote-related caches
    await invalidate_quote_caches()

    # Track business metrics for status changes
    if status_update.status == "sent":
        metrics.quotes_created.labels(status="sent").inc()
        # Send quote notification email (non-blocking)
        cust_result = await db.execute(
            select(CustomerModel).where(CustomerModel.id == quote.customer_id)
        )
        customer = cust_result.scalar_one_or_none()
        if customer and customer.email:
            valid_until_str = quote.valid_until.strftime("%d/%m/%Y") if quote.valid_until else None
            background_tasks.add_task(
                email_service.send_quote_sent_notification,
                quote_number=quote.quote_number,
                customer_email=customer.email,
                customer_name=customer.company_name or customer.contact_name or "Valued Customer",
                total=float(quote.total or 0),
                valid_until=valid_until_str,
            )
    elif status_update.status == "accepted":
        metrics.quotes_converted.inc()

    # Build response from already-loaded quote object (Pydantic serializer handles valid_until)
    quote_dict = Quote.model_validate(quote).model_dump()
    quote_dict["items"] = [
        QuoteItem.model_validate(item).model_dump()
        for item in quote.quote_items
    ]
    return quote_dict


@router.post("/generate", response_model=Quote, status_code=201)
async def generate_quote_with_ai(
    requirements: str,
    customer_id: UUID | None = None,
    db: AsyncSession = Depends(get_async_db),
    settings: Settings = Depends(get_settings),
):
    """Generate a quote using AI from natural language requirements.

    This endpoint proxies to the AI generation service and creates a quote
    in the database. For now, it creates a standard quote as AI generation
    is being developed.
    """
    # TODO: Integrate with AI quote generation service at /api/ai/generate/quote
    # For now, create a standard quote to support the load tests

    # Ensure we have a customer
    if not customer_id:
        # Get first available customer for testing
        customer_query = select(QuoteModel).limit(1)
        result = await db.execute(customer_query)
        first_quote = result.scalar_one_or_none()
        if first_quote:
            customer_id = first_quote.customer_id
        else:
            raise HTTPException(
                status_code=400,
                detail="customer_id is required for quote generation"
            )

    # Get first available product for testing
    product_query = select(ProductModel).limit(1)
    result = await db.execute(product_query)
    product = result.scalar_one_or_none()

    if not product:
        raise HTTPException(
            status_code=400,
            detail="No products available for quote generation"
        )

    # Create a simple quote with one item
    quote_data = QuoteCreate(
        customer_id=customer_id,
        status="draft",
        valid_until=(datetime.now(UTC) + timedelta(days=30)).date(),
        notes=f"AI Generated: {requirements[:100]}",
        items=[
            {
                "product_id": product.id,
                "quantity": 1,
            }
        ],
    )

    # Use the create_quote function to maintain consistency
    return await create_quote(quote_data, db, settings)


@router.post("/{quote_id}/convert-to-order", response_model=Order, status_code=201)
async def convert_quote_to_order(
    quote_id: UUID,
    db: AsyncSession = Depends(get_async_db),
):
    """Convert a quote to an order."""
    # Get existing quote with items
    query = (
        select(QuoteModel)
        .options(selectinload(QuoteModel.quote_items))
        .where(QuoteModel.id == quote_id)
    )
    result = await db.execute(query)
    quote = result.scalar_one_or_none()

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    if quote.valid_until and quote.valid_until < datetime.now(UTC):
        raise HTTPException(status_code=400, detail="Quote has expired")

    # Generate order number
    order_number = await generate_order_number(db)

    # Create order
    order = OrderModel(
        order_number=order_number,
        customer_id=quote.customer_id,
        status="confirmed",
        total=quote.total,
        notes=f"Converted from quote {quote.quote_number}",
    )
    db.add(order)
    await db.flush()

    # Create order items from quote items - BULK INSERT OPTIMIZATION (ISS-031)
    # Use add_all() for single bulk insert instead of individual adds
    order_item_models = [
        OrderItemModel(
            order_id=order.id,
            product_id=quote_item.product_id,
            quantity=quote_item.quantity,
            unit_price=quote_item.unit_price,
            line_total=quote_item.line_total,
        )
        for quote_item in quote.quote_items
    ]
    db.add_all(order_item_models)

    # Update quote status
    quote.status = "accepted"

    await db.commit()
    await db.refresh(order)

    # Invalidate both quote and order caches (since we're creating an order from a quote)
    await invalidate_quote_caches()
    await invalidate_cache("dashboard_metrics")
    await invalidate_cache("dashboard_revenue")
    await invalidate_cache("dashboard_order_status")
    await invalidate_cache("dashboard_activity")

    # Track business metrics for quote conversion
    metrics.quotes_converted.inc()

    # Publish real-time events
    await sse_service.publish("dashboard-metrics", {
        "type": "metrics_updated",
        "metric": "pending_quotes",
        "change": "decrement",
        "timestamp": datetime.now(UTC).isoformat(),
    })

    await sse_service.publish("dashboard-metrics", {
        "type": "metrics_updated",
        "metric": "active_orders",
        "change": "increment",
        "timestamp": datetime.now(UTC).isoformat(),
    })

    await sse_service.publish("dashboard-activity", {
        "activity_type": "quote_converted",
        "title": "Quote Converted to Order",
        "description": f"Quote {quote.quote_number} converted to order {order_number}",
        "link": f"/orders/{order.id}",
        "timestamp": datetime.now(UTC).isoformat(),
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
        # Order was deleted between creation and reload (race condition or concurrent delete)
        raise HTTPException(status_code=404, detail="Order not found after creation - may have been deleted")

    order_dict = Order.model_validate(order).model_dump()
    order_dict["items"] = [
        OrderItem.model_validate(item).model_dump()
        for item in order.order_items
    ]
    return order_dict
