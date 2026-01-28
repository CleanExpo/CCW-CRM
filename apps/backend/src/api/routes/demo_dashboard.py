"""
Demo dashboard endpoints.

Provides metrics, charts, and activity feed for the overnight demo.
Performance optimized with Redis caching and query optimization.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import String, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.cache.decorators import cached
from src.config.database import get_async_db
from src.db.demo_models import (
    Customer,
    Order,
    OrderItem,
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
@cached(ttl=60, key_prefix="dashboard_metrics")  # 1 minute cache - metrics need to be fairly fresh
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
        .where(func.cast(Order.status, String) == "delivered")
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
@cached(ttl=300, key_prefix="dashboard_revenue")  # 5 minute cache
async def get_revenue_chart(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[RevenueDataPoint]:
    """Get revenue trend for last 6 months.

    Optimized with single aggregation query using date_trunc.
    Previously: 6 separate queries (one per month)
    Now: 1 query with GROUP BY month
    """
    now = datetime.now(UTC)
    # Calculate 6 months ago (start of that month)
    six_months_ago = (now - timedelta(days=180)).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )

    # Single optimized query with date grouping
    month_col = func.date_trunc("month", Order.order_date)
    result = await db.execute(
        select(
            month_col.label("month"),
            func.sum(Order.total).label("revenue"),
        )
        .where(Order.order_date >= six_months_ago)
        .where(func.cast(Order.status, String) == "delivered")
        .group_by(month_col)
        .order_by(month_col)
    )
    monthly_revenue = {row[0]: row[1] for row in result.all()}

    # Build response with all 6 months (filling in zeros for missing months)
    revenue_data = []
    for i in range(5, -1, -1):
        month_date = now - timedelta(days=i * 30)
        month_start = month_date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Find matching month in results (compare year and month)
        revenue = Decimal(0)
        for month_key, month_revenue in monthly_revenue.items():
            is_matching_month = (
                month_key
                and month_key.year == month_start.year
                and month_key.month == month_start.month
            )
            if is_matching_month:
                revenue = month_revenue or Decimal(0)
                break

        revenue_data.append(
            RevenueDataPoint(
                month=month_start.strftime("%b %Y"),
                revenue=str(revenue),
            )
        )

    return revenue_data


@router.get("/charts/categories", response_model=list[CategoryDataPoint])
@cached(ttl=300, key_prefix="dashboard_categories")  # 5 minute cache
async def get_category_distribution(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[CategoryDataPoint]:
    """Get sales distribution by product category."""
    # Get total sales by category (from order items)
    result = await db.execute(
        select(Product.category, func.sum(OrderItem.line_total))
        .join(OrderItem, Product.id == OrderItem.product_id)
        .join(Order, OrderItem.order_id == Order.id)
        .where(func.cast(Order.status, String) == "delivered")
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
@cached(ttl=300, key_prefix="dashboard_top_products")  # 5 minute cache
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
        .where(func.cast(Order.status, String) == "delivered")
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
@cached(ttl=120, key_prefix="dashboard_inventory")  # 2 minute cache
async def get_inventory_status(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[InventoryDataPoint]:
    """Get inventory status by warehouse.

    Optimized with single aggregation query to eliminate N+1 pattern.
    Previously: 1 + (3 * N) queries where N = number of warehouses
    Now: 1 query with conditional aggregation
    """
    from sqlalchemy import case

    # Single optimized query with conditional aggregation
    result = await db.execute(
        select(
            Product.warehouse_location,
            # In stock (> 10)
            func.count(case((Product.stock > 10, Product.id))).label("in_stock"),
            # Low stock (1-10)
            func.count(
                case(((Product.stock > 0) & (Product.stock <= 10), Product.id))
            ).label("low_stock"),
            # Out of stock (0)
            func.count(case((Product.stock == 0, Product.id))).label("out_of_stock"),
        )
        .where(Product.is_active)
        .where(Product.warehouse_location.isnot(None))
        .group_by(Product.warehouse_location)
    )
    warehouse_stats = result.all()

    inventory_data = [
        InventoryDataPoint(
            warehouse=warehouse,
            in_stock=in_stock,
            low_stock=low_stock,
            out_of_stock=out_of_stock,
        )
        for warehouse, in_stock, low_stock, out_of_stock in warehouse_stats
    ]

    return inventory_data


@router.get("/activity", response_model=list[ActivityItem])
@cached(ttl=30, key_prefix="dashboard_activity")  # 30 second cache - activity feed should be fresh
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
                status=order.status,
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
                status=quote.status,
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


# New Analytics Endpoints


class OrderStatusCount(BaseModel):
    """Order status count with percentage."""

    status: str
    count: int
    percentage: float


class OrderStatusBreakdown(BaseModel):
    """Order status breakdown response."""

    total_active_orders: int
    by_status: list[OrderStatusCount]


@router.get("/order-status-breakdown", response_model=OrderStatusBreakdown)
@cached(ttl=60, key_prefix="dashboard_order_status")  # 1 minute cache
async def get_order_status_breakdown(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> OrderStatusBreakdown:
    """Get order fulfillment status breakdown."""
    # Get active orders (not delivered or cancelled)
    active_statuses = ["pending", "confirmed", "processing", "shipped"]

    # Total active orders
    total_result = await db.execute(
        select(func.count(Order.id)).where(
            func.cast(Order.status, String).in_(active_statuses)
        )
    )
    total_active = total_result.scalar() or 0

    # Count by status
    status_result = await db.execute(
        select(Order.status, func.count(Order.id))
        .where(func.cast(Order.status, String).in_(active_statuses))
        .group_by(Order.status)
    )
    status_counts = status_result.all()

    # Calculate percentages
    by_status = []
    for status, count in status_counts:
        percentage = (count / total_active * 100) if total_active > 0 else 0
        by_status.append(
            OrderStatusCount(
                status=status,
                count=count,
                percentage=round(percentage, 1),
            )
        )

    # Sort by order status progression
    status_order = {"pending": 0, "confirmed": 1, "processing": 2, "shipped": 3}
    by_status.sort(key=lambda x: status_order.get(x.status, 99))

    return OrderStatusBreakdown(
        total_active_orders=total_active,
        by_status=by_status,
    )


class QuoteConversionData(BaseModel):
    """Quote conversion metrics response."""

    total_quotes: int
    accepted: int
    rejected: int
    pending: int
    expired: int
    conversion_rate: float
    average_quote_value: str
    total_converted_revenue: str


@router.get("/quote-conversion", response_model=QuoteConversionData)
@cached(ttl=120, key_prefix="dashboard_quote_conversion")  # 2 minute cache
async def get_quote_conversion(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> QuoteConversionData:
    """Get quote conversion metrics."""
    # Get counts by status
    status_result = await db.execute(
        select(Quote.status, func.count(Quote.id))
        .group_by(Quote.status)
    )
    status_counts = dict(status_result.all())

    # Extract counts
    total_quotes = sum(status_counts.values())
    accepted = status_counts.get(QuoteStatus.ACCEPTED, 0)
    rejected = status_counts.get(QuoteStatus.REJECTED, 0)
    pending = sum(
        status_counts.get(s, 0)
        for s in [QuoteStatus.DRAFT, QuoteStatus.PENDING, QuoteStatus.SENT]
    )
    expired = status_counts.get(QuoteStatus.EXPIRED, 0)

    # Conversion rate
    conversion_rate = (accepted / total_quotes * 100) if total_quotes > 0 else 0

    # Average quote value
    avg_result = await db.execute(select(func.avg(Quote.total)))
    avg_quote_value = avg_result.scalar() or Decimal(0)

    # Total converted revenue (accepted quotes)
    revenue_result = await db.execute(
        select(func.sum(Quote.total)).where(
            func.cast(Quote.status, String) == "accepted"
        )
    )
    total_converted_revenue = revenue_result.scalar() or Decimal(0)

    return QuoteConversionData(
        total_quotes=total_quotes,
        accepted=accepted,
        rejected=rejected,
        pending=pending,
        expired=expired,
        conversion_rate=round(conversion_rate, 1),
        average_quote_value=str(avg_quote_value),
        total_converted_revenue=str(total_converted_revenue),
    )


class LocationRevenue(BaseModel):
    """Revenue data for a single location."""

    location: str
    revenue: str
    percentage: float
    order_count: int
    average_order_value: str
    growth_percentage: float | None


class RevenueByLocationData(BaseModel):
    """Revenue breakdown by fulfillment location."""

    locations: list[LocationRevenue]
    total_revenue: str
    period: str


@router.get("/revenue-by-location", response_model=RevenueByLocationData)
@cached(ttl=300, key_prefix="dashboard_revenue_location")  # 5 minute cache
async def get_revenue_by_location(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> RevenueByLocationData:
    """Get revenue breakdown by fulfillment location (last 30 days)."""
    now = datetime.now(UTC)
    period_start = now - timedelta(days=30)
    prev_period_start = period_start - timedelta(days=30)

    # Get revenue by location for current period
    current_result = await db.execute(
        select(
            Order.fulfillment_location,
            func.sum(Order.total).label("revenue"),
            func.count(Order.id).label("order_count"),
        )
        .where(Order.order_date >= period_start)
        .where(func.cast(Order.status, String) == "delivered")
        .where(Order.fulfillment_location.isnot(None))
        .group_by(Order.fulfillment_location)
    )
    current_data = current_result.all()

    # Get revenue by location for previous period (for growth calculation)
    prev_result = await db.execute(
        select(
            Order.fulfillment_location,
            func.sum(Order.total).label("revenue"),
        )
        .where(Order.order_date >= prev_period_start)
        .where(Order.order_date < period_start)
        .where(func.cast(Order.status, String) == "delivered")
        .where(Order.fulfillment_location.isnot(None))
        .group_by(Order.fulfillment_location)
    )
    prev_data = dict(prev_result.all())

    # Calculate total revenue
    total_revenue = sum(Decimal(str(revenue)) for _, revenue, _ in current_data)

    # Build location revenue data
    locations = []
    for location, revenue, order_count in current_data:
        revenue_decimal = Decimal(str(revenue))
        percentage = (
            float((revenue_decimal / total_revenue) * 100) if total_revenue > 0 else 0
        )
        avg_order_value = revenue_decimal / order_count if order_count > 0 else Decimal(0)

        # Calculate growth percentage
        prev_revenue = prev_data.get(location, Decimal(0))
        if prev_revenue > 0:
            growth = float(((revenue_decimal - prev_revenue) / prev_revenue) * 100)
        else:
            growth = None

        locations.append(
            LocationRevenue(
                location=location,
                revenue=str(revenue_decimal),
                percentage=round(percentage, 1),
                order_count=order_count,
                average_order_value=str(avg_order_value),
                growth_percentage=round(growth, 1) if growth is not None else None,
            )
        )

    # Sort by revenue descending
    locations.sort(key=lambda x: Decimal(x.revenue), reverse=True)

    return RevenueByLocationData(
        locations=locations,
        total_revenue=str(total_revenue),
        period="Last 30 days",
    )
