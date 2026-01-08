"""Dashboard API routes."""
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db
from src.db.erp_models import Customer as CustomerModel
from src.db.erp_models import Order as OrderModel
from src.db.erp_models import OrderItem as OrderItemModel
from src.db.erp_models import Product as ProductModel
from src.db.erp_models import Quote as QuoteModel
from src.db.schemas import CategorySales, DashboardMetrics, RevenueDataPoint, TopProduct

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/metrics", response_model=DashboardMetrics)
async def get_dashboard_metrics(db: AsyncSession = Depends(get_db)):
    """Get dashboard metrics summary."""
    # Total revenue (from delivered orders)
    revenue_query = select(func.sum(OrderModel.total)).where(
        OrderModel.status == "delivered"
    )
    revenue_result = await db.execute(revenue_query)
    total_revenue = revenue_result.scalar_one() or Decimal("0.00")

    # Active orders (not delivered or cancelled)
    active_orders_query = select(func.count()).where(
        OrderModel.status.in_(["draft", "pending", "confirmed", "processing", "shipped"])
    )
    active_orders_result = await db.execute(active_orders_query)
    active_orders = active_orders_result.scalar_one()

    # Total products
    products_query = select(func.count()).where(ProductModel.is_active)
    products_result = await db.execute(products_query)
    total_products = products_result.scalar_one()

    # Total customers
    customers_query = select(func.count()).where(CustomerModel.is_active)
    customers_result = await db.execute(customers_query)
    total_customers = customers_result.scalar_one()

    # Low stock alerts (stock < 10)
    low_stock_query = select(func.count()).where(
        (ProductModel.stock < 10) & ProductModel.is_active
    )
    low_stock_result = await db.execute(low_stock_query)
    low_stock_alerts = low_stock_result.scalar_one()

    # Pending quotes
    pending_quotes_query = select(func.count()).where(
        QuoteModel.status.in_(["draft", "pending", "sent"])
    )
    pending_quotes_result = await db.execute(pending_quotes_query)
    pending_quotes = pending_quotes_result.scalar_one()

    return DashboardMetrics(
        total_revenue=total_revenue,
        active_orders=active_orders,
        total_products=total_products,
        total_customers=total_customers,
        low_stock_alerts=low_stock_alerts,
        pending_quotes=pending_quotes,
    )


@router.get("/charts/revenue", response_model=list[RevenueDataPoint])
async def get_revenue_chart(db: AsyncSession = Depends(get_db)):
    """Get monthly revenue for the last 6 months."""
    # Calculate date 6 months ago
    six_months_ago = datetime.now() - timedelta(days=180)

    # Get revenue by month
    query = (
        select(
            func.to_char(OrderModel.order_date, "YYYY-MM").label("month"),
            func.sum(OrderModel.total).label("revenue"),
        )
        .where(
            (OrderModel.order_date >= six_months_ago)
            & (OrderModel.status == "delivered")
        )
        .group_by(func.to_char(OrderModel.order_date, "YYYY-MM"))
        .order_by(func.to_char(OrderModel.order_date, "YYYY-MM"))
    )

    result = await db.execute(query)
    rows = result.all()

    # Fill in missing months with zero
    revenue_data = []
    current_date = six_months_ago.replace(day=1)
    end_date = datetime.now()

    revenue_map = {row.month: row.revenue for row in rows}

    while current_date <= end_date:
        month_str = current_date.strftime("%Y-%m")
        revenue = revenue_map.get(month_str, Decimal("0.00"))
        revenue_data.append(RevenueDataPoint(month=month_str, revenue=revenue))
        # Move to next month
        if current_date.month == 12:
            current_date = current_date.replace(year=current_date.year + 1, month=1)
        else:
            current_date = current_date.replace(month=current_date.month + 1)

    return revenue_data


@router.get("/charts/sales-by-category", response_model=list[CategorySales])
async def get_sales_by_category(db: AsyncSession = Depends(get_db)):
    """Get sales totals by product category."""
    query = (
        select(
            ProductModel.category,
            func.sum(OrderItemModel.line_total).label("total"),
        )
        .join(OrderItemModel, ProductModel.id == OrderItemModel.product_id)
        .join(OrderModel, OrderItemModel.order_id == OrderModel.id)
        .where(OrderModel.status == "delivered")
        .group_by(ProductModel.category)
        .order_by(func.sum(OrderItemModel.line_total).desc())
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        CategorySales(category=row.category, total=row.total or Decimal("0.00"))
        for row in rows
    ]


@router.get("/charts/top-products", response_model=list[TopProduct])
async def get_top_products(db: AsyncSession = Depends(get_db)):
    """Get top 5 products by quantity sold."""
    query = (
        select(
            ProductModel.name,
            func.sum(OrderItemModel.quantity).label("quantity_sold"),
            func.sum(OrderItemModel.line_total).label("revenue"),
        )
        .join(OrderItemModel, ProductModel.id == OrderItemModel.product_id)
        .join(OrderModel, OrderItemModel.order_id == OrderModel.id)
        .where(OrderModel.status == "delivered")
        .group_by(ProductModel.name)
        .order_by(func.sum(OrderItemModel.quantity).desc())
        .limit(5)
    )

    result = await db.execute(query)
    rows = result.all()

    return [
        TopProduct(
            name=row.name,
            quantity_sold=row.quantity_sold or 0,
            revenue=row.revenue or Decimal("0.00"),
        )
        for row in rows
    ]


@router.get("/recent-activity")
async def get_recent_activity(db: AsyncSession = Depends(get_db)):
    """Get recent orders and quotes for activity feed."""
    # Get recent orders
    orders_query = (
        select(OrderModel)
        .order_by(OrderModel.created_at.desc())
        .limit(5)
    )
    orders_result = await db.execute(orders_query)
    orders = orders_result.scalars().all()

    # Get recent quotes
    quotes_query = (
        select(QuoteModel)
        .order_by(QuoteModel.created_at.desc())
        .limit(5)
    )
    quotes_result = await db.execute(quotes_query)
    quotes = quotes_result.scalars().all()

    # Combine and sort by date
    activity = []

    for order in orders:
        activity.append({
            "type": "order",
            "id": str(order.id),
            "number": order.order_number,
            "status": order.status,
            "total": float(order.total),
            "date": order.created_at.isoformat(),
        })

    for quote in quotes:
        activity.append({
            "type": "quote",
            "id": str(quote.id),
            "number": quote.quote_number,
            "status": quote.status,
            "total": float(quote.total),
            "date": quote.created_at.isoformat(),
        })

    # Sort by date descending
    activity.sort(key=lambda x: x["date"], reverse=True)

    return activity[:10]  # Return top 10 most recent
