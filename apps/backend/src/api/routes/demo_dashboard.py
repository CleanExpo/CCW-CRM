"""
Demo dashboard endpoints.

Provides metrics, charts, and activity feed for the overnight demo.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import String, and_, case, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.demo_models import (
    Customer,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    Quote,
    QuoteStatus,
)

router = APIRouter(prefix="/api/dashboard", tags=["Demo Dashboard"])


class DashboardMetrics(BaseModel):
    """Dashboard metrics model."""

    total_revenue_this_month: str
    active_orders: int
    total_products: int
    total_customers: int
    low_stock_alerts: int
    pending_quotes: int


class RevenueDataPoint(BaseModel):
    """Revenue chart data point."""

    month: str
    revenue: str


class CategoryDataPoint(BaseModel):
    """Category distribution data point."""

    category: str
    value: str
    percentage: float


class TopProductDataPoint(BaseModel):
    """Top product data point."""

    name: str
    revenue: str
    quantity_sold: int


class InventoryDataPoint(BaseModel):
    """Inventory status data point."""

    warehouse: str
    in_stock: int
    low_stock: int
    out_of_stock: int


class ActivityItem(BaseModel):
    """Activity feed item."""

    type: str  # "order", "quote", "customer", "stock"
    title: str
    description: str
    timestamp: datetime
    status: str | None = None


@router.get("/metrics", response_model=DashboardMetrics)
async def get_dashboard_metrics(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> DashboardMetrics:
    """Get dashboard metrics."""
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Total revenue this month (delivered orders only)
    revenue_result = await db.execute(
        select(func.sum(Order.total))
        .where(Order.order_date >= month_start)
        .where(func.cast(Order.status, String) == "DELIVERED")
    )
    total_revenue = revenue_result.scalar() or Decimal(0)

    # Active orders (not delivered or cancelled)
    active_orders_result = await db.execute(
        select(func.count(Order.id)).where(
            func.cast(Order.status, String).in_([
                "PENDING",
                "CONFIRMED",
                "PROCESSING",
                "SHIPPED"
            ])
        )
    )
    active_orders = active_orders_result.scalar() or 0

    # Total products
    total_products_result = await db.execute(
        select(func.count(Product.id)).where(Product.is_active)
    )
    total_products = total_products_result.scalar() or 0

    # Total customers
    total_customers_result = await db.execute(
        select(func.count(Customer.id)).where(Customer.is_active)
    )
    total_customers = total_customers_result.scalar() or 0

    # Low stock alerts (stock <= 10)
    low_stock_result = await db.execute(
        select(func.count(Product.id))
        .where(Product.stock <= 10)
        .where(Product.is_active)
    )
    low_stock_alerts = low_stock_result.scalar() or 0

    # Pending quotes
    pending_quotes_result = await db.execute(
        select(func.count(Quote.id)).where(
            func.cast(Quote.status, String).in_(["DRAFT", "PENDING", "SENT"])
        )
    )
    pending_quotes = pending_quotes_result.scalar() or 0

    return DashboardMetrics(
        total_revenue_this_month=str(total_revenue),
        active_orders=active_orders,
        total_products=total_products,
        total_customers=total_customers,
        low_stock_alerts=low_stock_alerts,
        pending_quotes=pending_quotes,
    )


@router.get("/charts/revenue", response_model=list[RevenueDataPoint])
async def get_revenue_chart(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[RevenueDataPoint]:
    """Get revenue trend for last 6 months."""
    now = datetime.now(UTC)
    six_months_ago = (now - timedelta(days=180)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Single query with date grouping (avoid N+1 loop)
    result = await db.execute(
        select(
            extract("year", Order.order_date).label("year"),
            extract("month", Order.order_date).label("month"),
            func.sum(Order.total).label("revenue"),
        )
        .where(Order.order_date >= six_months_ago)
        .where(Order.status == OrderStatus.DELIVERED)
        .group_by(extract("year", Order.order_date), extract("month", Order.order_date))
        .order_by(extract("year", Order.order_date), extract("month", Order.order_date))
    )
    monthly_revenue = {(int(row.year), int(row.month)): row.revenue for row in result.all()}

    # Build response for last 6 months (fill in zeros for missing months)
    revenue_data = []
    for i in range(5, -1, -1):
        month_date = now - timedelta(days=i * 30)
        year, month = month_date.year, month_date.month
        revenue = monthly_revenue.get((year, month), Decimal(0))
        revenue_data.append(
            RevenueDataPoint(
                month=month_date.strftime("%b %Y"),
                revenue=str(revenue or Decimal(0)),
            )
        )

    return revenue_data


@router.get("/charts/categories", response_model=list[CategoryDataPoint])
async def get_category_distribution(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[CategoryDataPoint]:
    """Get sales distribution by product category."""
    # Get total sales by category (from order items)
    result = await db.execute(
        select(Product.category, func.sum(OrderItem.line_total))
        .join(OrderItem, Product.id == OrderItem.product_id)
        .join(Order, OrderItem.order_id == Order.id)
        .where(func.cast(Order.status, String) == "DELIVERED")
        .group_by(Product.category)
        .order_by(func.sum(OrderItem.line_total).desc())
    )
    category_sales = result.all()

    # Calculate total and percentages
    total = sum(Decimal(str(sales)) for _, sales in category_sales)
    if total == 0:
        total = Decimal(1)  # Avoid division by zero

    category_data = []
    for category, sales in category_sales:
        sales_decimal = Decimal(str(sales))
        percentage = float((sales_decimal / total) * 100)
        category_data.append(
            CategoryDataPoint(
                category=category.value.replace("_", " ").title(),
                value=str(sales_decimal),
                percentage=round(percentage, 1),
            )
        )

    return category_data


@router.get("/charts/top-products", response_model=list[TopProductDataPoint])
async def get_top_products(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[TopProductDataPoint]:
    """Get top 10 selling products by revenue."""
    result = await db.execute(
        select(
            Product.name,
            func.sum(OrderItem.line_total).label("revenue"),
            func.sum(OrderItem.quantity).label("quantity"),
        )
        .join(OrderItem, Product.id == OrderItem.product_id)
        .join(Order, OrderItem.order_id == Order.id)
        .where(func.cast(Order.status, String) == "DELIVERED")
        .group_by(Product.id, Product.name)
        .order_by(func.sum(OrderItem.line_total).desc())
        .limit(10)
    )
    top_products = result.all()

    return [
        TopProductDataPoint(
            name=name,
            revenue=str(revenue),
            quantity_sold=quantity,
        )
        for name, revenue, quantity in top_products
    ]


@router.get("/charts/inventory", response_model=list[InventoryDataPoint])
async def get_inventory_status(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[InventoryDataPoint]:
    """Get inventory status by warehouse."""
    # Single query with CASE statements (avoid N+1 warehouse loop)
    result = await db.execute(
        select(
            Product.warehouse_location,
            func.sum(case((Product.stock > 10, 1), else_=0)).label("in_stock"),
            func.sum(case((and_(Product.stock > 0, Product.stock <= 10), 1), else_=0)).label("low_stock"),
            func.sum(case((Product.stock == 0, 1), else_=0)).label("out_of_stock"),
        )
        .where(Product.is_active)
        .where(Product.warehouse_location.isnot(None))
        .group_by(Product.warehouse_location)
    )
    warehouse_stats = result.all()

    return [
        InventoryDataPoint(
            warehouse=row.warehouse_location,
            in_stock=int(row.in_stock or 0),
            low_stock=int(row.low_stock or 0),
            out_of_stock=int(row.out_of_stock or 0),
        )
        for row in warehouse_stats
    ]


@router.get("/activity", response_model=list[ActivityItem])
async def get_recent_activity(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    limit: int = 20,
) -> list[ActivityItem]:
    """Get recent activity feed (orders, quotes, customers)."""
    activity_items = []

    # Recent orders
    orders_result = await db.execute(
        select(Order, Customer.company_name)
        .join(Customer, Order.customer_id == Customer.id)
        .order_by(Order.created_at.desc())
        .limit(limit // 3)
    )
    orders = orders_result.all()

    for order, company_name in orders:
        activity_items.append(
            ActivityItem(
                type="order",
                title=f"Order {order.order_number}",
                description=f"{company_name} - ${order.total}",
                timestamp=order.created_at,
                status=order.status.value,
            )
        )

    # Recent quotes
    quotes_result = await db.execute(
        select(Quote, Customer.company_name)
        .join(Customer, Quote.customer_id == Customer.id)
        .order_by(Quote.created_at.desc())
        .limit(limit // 3)
    )
    quotes = quotes_result.all()

    for quote, company_name in quotes:
        activity_items.append(
            ActivityItem(
                type="quote",
                title=f"Quote {quote.quote_number}",
                description=f"{company_name} - ${quote.total}",
                timestamp=quote.created_at,
                status=quote.status.value,
            )
        )

    # Recent customers
    customers_result = await db.execute(
        select(Customer).order_by(Customer.created_at.desc()).limit(limit // 3)
    )
    customers = customers_result.scalars().all()

    for customer in customers:
        activity_items.append(
            ActivityItem(
                type="customer",
                title="New Customer",
                description=customer.company_name,
                timestamp=customer.created_at,
                status="active" if customer.is_active else "inactive",
            )
        )

    # Sort all activity by timestamp
    activity_items.sort(key=lambda x: x.timestamp, reverse=True)

    return activity_items[:limit]
