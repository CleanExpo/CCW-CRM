"""Quotes API routes."""
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
from src.db.demo_models import Quote as QuoteModel
from src.db.demo_models import QuoteItem as QuoteItemModel
from src.db.schemas import Order, PaginatedResponse, Quote, QuoteCreate, QuoteUpdate

router = APIRouter(prefix="/api/quotes", tags=["quotes"])


async def generate_quote_number(db: AsyncSession) -> str:
    """Generate next quote number."""
    year = datetime.now().year
    # Get count of quotes this year
    query = select(func.count()).where(QuoteModel.quote_number.like(f"Q-{year}-%"))
    result = await db.execute(query)
    count = result.scalar_one()
    return f"Q-{year}-{count + 1:03d}"


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
    query = select(QuoteModel).options(selectinload(QuoteModel.items))

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

    return {
        "items": [Quote.model_validate(q) for q in quotes],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.get("/{quote_id}", response_model=Quote)
async def get_quote(
    quote_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single quote by ID."""
    query = (
        select(QuoteModel)
        .options(selectinload(QuoteModel.items))
        .where(QuoteModel.id == quote_id)
    )
    result = await db.execute(query)
    quote = result.scalar_one_or_none()

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    return Quote.model_validate(quote)


@router.post("", response_model=Quote, status_code=201)
async def create_quote(
    quote_data: QuoteCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new quote with items."""
    # Generate quote number
    quote_number = await generate_quote_number(db)

    # Batch fetch all products at once (avoid N+1 queries)
    product_ids = [item.product_id for item in quote_data.items]
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
    quote_items = []

    for item_data in quote_data.items:
        product = products_map[item_data.product_id]
        unit_price = product.price
        line_total = unit_price * item_data.quantity
        total += line_total

        quote_items.append({
            "product_id": item_data.product_id,
            "quantity": item_data.quantity,
            "unit_price": unit_price,
            "line_total": line_total,
        })

    # Create quote
    quote = QuoteModel(
        quote_number=quote_number,
        customer_id=quote_data.customer_id,
        status=quote_data.status,
        total=total,
        valid_until=quote_data.valid_until,
        notes=quote_data.notes,
    )
    db.add(quote)
    await db.flush()

    # Create quote items
    for item_data in quote_items:
        item = QuoteItemModel(quote_id=quote.id, **item_data)
        db.add(item)

    await db.commit()

    # Reload with items (single query, no redundant refresh)
    query = (
        select(QuoteModel)
        .options(selectinload(QuoteModel.items))
        .where(QuoteModel.id == quote.id)
    )
    result = await db.execute(query)
    quote = result.scalar_one()

    return Quote.model_validate(quote)


@router.put("/{quote_id}", response_model=Quote)
async def update_quote(
    quote_id: UUID,
    quote_data: QuoteUpdate,
    db: AsyncSession = Depends(get_db),
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
    for field, value in update_data.items():
        setattr(quote, field, value)

    # Handle line items update if provided
    if quote_data.items is not None:
        # Bulk delete existing items (avoid N+1)
        await db.execute(delete(QuoteItemModel).where(QuoteItemModel.quote_id == quote_id))
        await db.flush()

        # Batch fetch all products at once (avoid N+1 queries)
        product_ids = [item.product_id for item in quote_data.items]
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
        quote_items = []

        for item_data in quote_data.items:
            product = products_map[item_data.product_id]
            unit_price = product.price
            line_total = unit_price * item_data.quantity
            total += line_total

            quote_items.append({
                "product_id": item_data.product_id,
                "quantity": item_data.quantity,
                "unit_price": unit_price,
                "line_total": line_total,
            })

        # Create new quote items
        for item_data in quote_items:
            item = QuoteItemModel(quote_id=quote.id, **item_data)
            db.add(item)

        # Update quote total
        quote.total = total

    await db.commit()

    # Reload with items (single query, no redundant refresh)
    query = (
        select(QuoteModel)
        .options(selectinload(QuoteModel.items))
        .where(QuoteModel.id == quote.id)
    )
    result = await db.execute(query)
    quote = result.scalar_one()

    return Quote.model_validate(quote)


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
        .options(selectinload(QuoteModel.items))
        .where(QuoteModel.id == quote_id)
    )
    result = await db.execute(query)
    quote = result.scalar_one_or_none()

    if not quote:
        raise HTTPException(status_code=404, detail="Quote not found")

    if quote.status == "accepted":
        raise HTTPException(
            status_code=400, detail="Quote has already been converted to an order"
        )

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
    for quote_item in quote.items:
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

    # Reload with items
    query = (
        select(OrderModel)
        .options(selectinload(OrderModel.items))
        .where(OrderModel.id == order.id)
    )
    result = await db.execute(query)
    order = result.scalar_one()

    return Order.model_validate(order)
