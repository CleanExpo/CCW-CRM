"""Quotes API routes.

Performance optimized with cache invalidation on writes.
"""
from datetime import datetime, time, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.cache.decorators import invalidate_cache
from src.config.database import get_db
from src.config.settings import Settings, get_settings
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
from src.utils.calculations import calculate_line_total, calculate_totals

router = APIRouter(prefix="/api/quotes", tags=["quotes"])


async def invalidate_quote_caches() -> None:
    """Invalidate all quote-related caches."""
    await invalidate_cache("dashboard_metrics")
    await invalidate_cache("dashboard_quote_conversion")
    await invalidate_cache("dashboard_activity")


async def generate_quote_number(db: AsyncSession) -> str:
    """Generate next quote number with microsecond timestamp to avoid race conditions."""
    now = datetime.now()
    year = now.year
    # Use microseconds to ensure uniqueness in concurrent scenarios
    timestamp_suffix = f"{now.month:02d}{now.day:02d}{now.hour:02d}{now.minute:02d}{now.second:02d}{now.microsecond:06d}"
    return f"Q-{year}-{timestamp_suffix}"


async def generate_order_number(db: AsyncSession) -> str:
    """Generate next order number."""
    year = datetime.now().year
    query = select(func.count()).where(OrderModel.order_number.like(f"ORD-{year}-%"))
    result = await db.execute(query)
    count = result.scalar_one()
    return f"ORD-{year}-{count + 1:03d}"


@router.get("", response_model=PaginatedResponse)
async def list_quotes(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = None,
    status: str | None = None,
    customer_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
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
        quote_dict["valid_until"] = (
            q.valid_until.date().isoformat() if q.valid_until else None
        )
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
    db: AsyncSession = Depends(get_db),
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

    # Manually build response dict from SQLAlchemy model
    response = {
        "id": str(quote.id),
        "organization_id": str(quote.organization_id) if quote.organization_id else None,
        "quote_number": quote.quote_number,
        "customer_id": str(quote.customer_id),
        "status": quote.status.value if hasattr(quote.status, 'value') else quote.status,
        "valid_until": quote.valid_until.date().isoformat() if quote.valid_until else None,
        "notes": quote.notes,
        "total": str(quote.total),
        "quote_date": quote.quote_date.isoformat(),
        "created_at": quote.created_at.isoformat(),
        "updated_at": quote.updated_at.isoformat(),
        # Manually serialize quote_items
        "items": [
            {
                "id": str(item.id),
                "quote_id": str(item.quote_id),
                "product_id": str(item.product_id),
                "quantity": item.quantity,
                "unit_price": str(item.unit_price),
                "line_total": str(item.line_total),
                "created_at": item.created_at.isoformat(),
            }
            for item in quote.quote_items
        ],
    }

    return response


@router.post("", response_model=Quote, status_code=201)
async def create_quote(
    quote_data: QuoteCreate,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """Create a new quote with items."""
    # Generate quote number
    quote_number = await generate_quote_number(db)
    valid_until = (
        datetime.combine(quote_data.valid_until, time.min, tzinfo=timezone.utc)
        if quote_data.valid_until
        else None
    )

    # Calculate totals using shared calculation utilities
    quote_items = []
    line_items_for_calc = []

    for item_data in quote_data.items:
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

    # Create quote items
    for item_data in quote_items:
        item = QuoteItemModel(quote_id=quote.id, **item_data)
        db.add(item)

    await db.commit()
    await db.refresh(quote)

    # Invalidate quote-related caches
    await invalidate_quote_caches()

    # Reload with items
    query = (
        select(QuoteModel)
        .options(selectinload(QuoteModel.quote_items))
        .where(QuoteModel.id == quote.id)
    )
    result = await db.execute(query)
    quote = result.scalar_one()

    quote_dict = Quote.model_validate(quote).model_dump()
    quote_dict["valid_until"] = (
        quote.valid_until.date().isoformat() if quote.valid_until else None
    )
    quote_dict["items"] = [
        QuoteItem.model_validate(item).model_dump()
        for item in quote.quote_items
    ]
    return quote_dict


@router.put("/{quote_id}", response_model=Quote)
async def update_quote(
    quote_id: UUID,
    quote_data: QuoteUpdate,
    db: AsyncSession = Depends(get_db),
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
            tzinfo=timezone.utc,
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
        quote_items = []
        line_items_for_calc = []

        for item_data in quote_data.items:
            # Get product to get price
            product_query = select(ProductModel).where(ProductModel.id == item_data.product_id)
            product_result = await db.execute(product_query)
            product = product_result.scalar_one_or_none()

            if not product:
                raise HTTPException(
                    status_code=400, detail=f"Product {item_data.product_id} not found"
                )

            unit_price = product.price
            line_total = calculate_line_total(item_data.quantity, unit_price)

            quote_items.append({
                "product_id": item_data.product_id,
                "quantity": item_data.quantity,
                "unit_price": unit_price,
                "line_total": line_total,
            })

            line_items_for_calc.append((item_data.quantity, unit_price))

        # Create new quote items
        for item_data in quote_items:
            item = QuoteItemModel(quote_id=quote.id, **item_data)
            db.add(item)

        totals = calculate_totals(
            line_items_for_calc,
            settings.tax_rate_decimal,
            tax_enabled=True,
        )
        quote.total = totals["total"]

    await db.commit()
    await db.refresh(quote)

    # Invalidate quote-related caches
    await invalidate_quote_caches()

    # Reload with items
    query = (
        select(QuoteModel)
        .options(selectinload(QuoteModel.quote_items))
        .where(QuoteModel.id == quote.id)
    )
    result = await db.execute(query)
    quote = result.scalar_one()

    quote_dict = Quote.model_validate(quote).model_dump()
    quote_dict["valid_until"] = (
        quote.valid_until.date().isoformat() if quote.valid_until else None
    )
    quote_dict["items"] = [
        QuoteItem.model_validate(item).model_dump()
        for item in quote.quote_items
    ]
    return quote_dict


@router.delete("/{quote_id}", status_code=204)
async def delete_quote(
    quote_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a quote and its items."""
    # Get existing quote
    query = select(QuoteModel).where(QuoteModel.id == quote_id)
    result = await db.execute(query)
    quote = result.scalar_one_or_none()

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    # Delete quote (cascade will delete items)
    await db.delete(quote)
    await db.commit()

    # Invalidate quote-related caches
    await invalidate_quote_caches()

    return None


@router.post("/{quote_id}/convert-to-order", response_model=Order, status_code=201)
async def convert_quote_to_order(
    quote_id: UUID,
    db: AsyncSession = Depends(get_db),
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

    if quote.valid_until and quote.valid_until < datetime.now(timezone.utc):
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

    # Create order items from quote items
    for quote_item in quote.quote_items:
        order_item = OrderItemModel(
            order_id=order.id,
            product_id=quote_item.product_id,
            quantity=quote_item.quantity,
            unit_price=quote_item.unit_price,
            line_total=quote_item.line_total,
        )
        db.add(order_item)

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

    # Reload with items
    query = (
        select(OrderModel)
        .options(selectinload(OrderModel.order_items))
        .where(OrderModel.id == order.id)
    )
    result = await db.execute(query)
    order = result.scalar_one()

    order_dict = Order.model_validate(order).model_dump()
    order_dict["items"] = [
        OrderItem.model_validate(item).model_dump()
        for item in order.order_items
    ]
    return order_dict
