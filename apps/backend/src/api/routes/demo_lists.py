"""
Demo list endpoints.

List endpoints for products, customers, orders, and quotes.
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.demo_models import (
    Customer,
    Order,
    OrderItem,
    Product,
    Quote,
    QuoteItem,
)

router = APIRouter(prefix="/api", tags=["Demo Lists"])


# Pydantic models for responses
class ProductListItem(BaseModel):
    """Product list item."""

    id: str
    sku: str
    name: str
    category: str
    price: str
    cost: str
    stock: int
    warehouse_location: str | None
    is_active: bool


class CustomerListItem(BaseModel):
    """Customer list item."""

    id: str
    customer_number: str
    company_name: str
    contact_name: str
    email: str
    phone: str | None
    city: str | None
    state: str | None
    is_active: bool


class OrderListItem(BaseModel):
    """Order list item."""

    id: str
    order_number: str
    customer_name: str
    status: str
    total: str
    order_date: datetime
    item_count: int


class QuoteListItem(BaseModel):
    """Quote list item."""

    id: str
    quote_number: str
    customer_name: str
    status: str
    total: str
    quote_date: datetime
    valid_until: datetime | None
    item_count: int


class PaginatedResponse(BaseModel):
    """Paginated response wrapper."""

    data: list
    total: int
    page: int
    page_size: int
    total_pages: int


@router.get("/products")
async def list_products(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = None,
    category: str | None = None,
) -> PaginatedResponse:
    """List products with pagination and filters."""
    # Build query
    query = select(Product)

    # Apply filters
    if search:
        query = query.where(
            or_(
                Product.name.ilike(f"%{search}%"),
                Product.sku.ilike(f"%{search}%"),
            )
        )

    if category:
        query = query.where(Product.category == category)

    # Count total
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.order_by(Product.name).limit(page_size).offset((page - 1) * page_size)

    # Execute query
    result = await db.execute(query)
    products = result.scalars().all()

    # Convert to response model
    product_items = [
        ProductListItem(
            id=str(p.id),
            sku=p.sku,
            name=p.name,
            category=p.category.value,
            price=str(p.price),
            cost=str(p.cost),
            stock=p.stock,
            warehouse_location=p.warehouse_location,
            is_active=p.is_active,
        )
        for p in products
    ]

    return PaginatedResponse(
        data=product_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/customers")
async def list_customers(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: str | None = None,
) -> PaginatedResponse:
    """List customers with pagination and search."""
    # Build query
    query = select(Customer)

    # Apply filters
    if search:
        query = query.where(
            or_(
                Customer.company_name.ilike(f"%{search}%"),
                Customer.contact_name.ilike(f"%{search}%"),
                Customer.email.ilike(f"%{search}%"),
                Customer.customer_number.ilike(f"%{search}%"),
            )
        )

    # Count total
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.order_by(Customer.company_name).limit(page_size).offset((page - 1) * page_size)

    # Execute query
    result = await db.execute(query)
    customers = result.scalars().all()

    # Convert to response model
    customer_items = [
        CustomerListItem(
            id=str(c.id),
            customer_number=c.customer_number,
            company_name=c.company_name,
            contact_name=c.contact_name,
            email=c.email,
            phone=c.phone,
            city=c.city,
            state=c.state,
            is_active=c.is_active,
        )
        for c in customers
    ]

    return PaginatedResponse(
        data=customer_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/orders")
async def list_orders(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    status: str | None = None,
) -> PaginatedResponse:
    """List orders with pagination and filters."""
    # Build query
    query = select(Order, Customer.company_name).join(Customer, Order.customer_id == Customer.id)

    # Apply filters
    if status:
        query = query.where(Order.status == status)

    # Count total
    count_query = select(func.count()).select_from(
        select(Order)
        .join(Customer, Order.customer_id == Customer.id)
        .where(Order.status == status if status else True)
        .subquery()
    )
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.order_by(Order.order_date.desc()).limit(page_size).offset((page - 1) * page_size)

    # Execute query
    result = await db.execute(query)
    orders_with_customers = result.all()

    # Get item counts for each order
    order_ids = [order.id for order, _ in orders_with_customers]
    item_counts_result = await db.execute(
        select(OrderItem.order_id, func.count(OrderItem.id))
        .where(OrderItem.order_id.in_(order_ids))
        .group_by(OrderItem.order_id)
    )
    item_counts = {order_id: count for order_id, count in item_counts_result.all()}

    # Convert to response model
    order_items = [
        OrderListItem(
            id=str(order.id),
            order_number=order.order_number,
            customer_name=customer_name,
            status=order.status.value,
            total=str(order.total),
            order_date=order.order_date,
            item_count=item_counts.get(order.id, 0),
        )
        for order, customer_name in orders_with_customers
    ]

    return PaginatedResponse(
        data=order_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/quotes")
async def list_quotes(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    status: str | None = None,
) -> PaginatedResponse:
    """List quotes with pagination and filters."""
    # Build query
    query = select(Quote, Customer.company_name).join(Customer, Quote.customer_id == Customer.id)

    # Apply filters
    if status:
        query = query.where(Quote.status == status)

    # Count total
    count_query = select(func.count()).select_from(
        select(Quote)
        .join(Customer, Quote.customer_id == Customer.id)
        .where(Quote.status == status if status else True)
        .subquery()
    )
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.order_by(Quote.quote_date.desc()).limit(page_size).offset((page - 1) * page_size)

    # Execute query
    result = await db.execute(query)
    quotes_with_customers = result.all()

    # Get item counts for each quote
    quote_ids = [quote.id for quote, _ in quotes_with_customers]
    item_counts_result = await db.execute(
        select(QuoteItem.quote_id, func.count(QuoteItem.id))
        .where(QuoteItem.quote_id.in_(quote_ids))
        .group_by(QuoteItem.quote_id)
    )
    item_counts = {quote_id: count for quote_id, count in item_counts_result.all()}

    # Convert to response model
    quote_items = [
        QuoteListItem(
            id=str(quote.id),
            quote_number=quote.quote_number,
            customer_name=customer_name,
            status=quote.status.value,
            total=str(quote.total),
            quote_date=quote.quote_date,
            valid_until=quote.valid_until,
            item_count=item_counts.get(quote.id, 0),
        )
        for quote, customer_name in quotes_with_customers
    ]

    return PaginatedResponse(
        data=quote_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )
