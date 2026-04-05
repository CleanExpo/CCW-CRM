"""
Public statistics endpoint for the landing page showcase.

Returns only aggregate counts — no PII, no customer names, no order details.
Equivalent risk level to the public /health endpoint.
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import String, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.demo_models import (
    Customer,
    Order,
    Product,
    Quote,
)

router = APIRouter(prefix="/api/public", tags=["Public"])


class PublicStats(BaseModel):
    """Aggregate statistics for the landing page. No PII."""

    total_products: int
    total_customers: int
    active_orders: int
    pending_quotes: int
    total_revenue_this_month: str
    low_stock_alerts: int
    product_categories: int
    warehouse_count: int
    fetched_at: str


@router.get("/stats", response_model=PublicStats)
async def get_public_stats(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> PublicStats:
    """Get aggregate platform statistics for the public landing page.

    Returns only counts and totals — no personally identifiable information.
    """
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Total active products
    products_result = await db.execute(
        select(func.count(Product.id)).where(Product.is_active)
    )
    total_products = products_result.scalar() or 0

    # Distinct product categories
    categories_result = await db.execute(
        select(func.count(func.distinct(Product.category))).where(Product.is_active)
    )
    product_categories = categories_result.scalar() or 0

    # Total active customers
    customers_result = await db.execute(
        select(func.count(Customer.id)).where(Customer.is_active)
    )
    total_customers = customers_result.scalar() or 0

    # Active orders (pending, confirmed, processing, shipped)
    active_orders_result = await db.execute(
        select(func.count(Order.id)).where(
            func.cast(Order.status, String).in_(
                ["pending", "confirmed", "processing", "shipped"]
            )
        )
    )
    active_orders = active_orders_result.scalar() or 0

    # Pending quotes (draft, pending, sent)
    pending_quotes_result = await db.execute(
        select(func.count(Quote.id)).where(
            func.cast(Quote.status, String).in_(["draft", "pending", "sent"])
        )
    )
    pending_quotes = pending_quotes_result.scalar() or 0

    # Revenue this month (delivered orders)
    revenue_result = await db.execute(
        select(func.sum(Order.total))
        .where(Order.order_date >= month_start)
        .where(func.cast(Order.status, String) == "delivered")
    )
    total_revenue = revenue_result.scalar() or Decimal(0)

    # Low stock alerts (active products with stock <= 10)
    low_stock_result = await db.execute(
        select(func.count(Product.id))
        .where(Product.is_active)
        .where(Product.stock <= 10)
    )
    low_stock_alerts = low_stock_result.scalar() or 0

    # Warehouse locations: Brisbane HQ, Sydney Branch, Melbourne Branch
    # This is a known business constant (free-text field has inconsistent values)
    warehouse_count = 3

    return PublicStats(
        total_products=total_products,
        total_customers=total_customers,
        active_orders=active_orders,
        pending_quotes=pending_quotes,
        total_revenue_this_month=str(total_revenue),
        low_stock_alerts=low_stock_alerts,
        product_categories=product_categories,
        warehouse_count=warehouse_count,
        fetched_at=now.isoformat(),
    )
