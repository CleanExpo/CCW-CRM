"""Analytics tools for data insights and business intelligence."""

from datetime import UTC, datetime, timedelta
from typing import Any

from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Customer, Order, OrderItem, OrderStatus, Product, ProductCategory
from src.utils import get_logger

from .base import BaseDatabaseTool

logger = get_logger(__name__)


# Input schemas


class AggregateSalesInput(BaseModel):
    """Input for sales aggregation."""

    start_date: str | None = Field(
        default=None, description="Start date in ISO format (YYYY-MM-DD). Default: 30 days ago"
    )
    end_date: str | None = Field(
        default=None, description="End date in ISO format (YYYY-MM-DD). Default: today"
    )
    group_by: str = Field(
        default="product",
        description="Group sales by: 'product', 'customer', 'category', or 'date'",
    )
    top_n: int = Field(default=10, description="Number of top results to return", ge=1, le=50)


class AnalyzeTrendsInput(BaseModel):
    """Input for trend analysis."""

    category: str | None = Field(default=None, description="Filter by product category")
    days: int = Field(default=90, description="Number of days to analyze", ge=7, le=365)
    metric: str = Field(
        default="sales",
        description="Metric to analyze: 'sales', 'orders', 'revenue'",
    )


class CustomerSegmentationInput(BaseModel):
    """Input for customer segmentation (RFM analysis)."""

    days: int = Field(default=90, description="Number of days for recency calculation", ge=30, le=365)


class InventoryAnalysisInput(BaseModel):
    """Input for inventory analysis."""

    low_stock_threshold: int = Field(default=10, description="Stock level considered low", ge=0)
    include_inactive: bool = Field(default=False, description="Include inactive products")


# Tool implementations


class AggregateSalesTool(BaseDatabaseTool):
    """Tool for aggregating sales metrics by period, product, customer, or category."""

    name: str = "aggregate_sales"
    description: str = (
        "Aggregate sales metrics grouped by product, customer, category, or date. "
        "Returns top N items with quantities and revenue. Use this for questions about "
        "sales performance, best-selling products, top customers, or revenue trends."
    )
    args_schema: type[BaseModel] = AggregateSalesInput

    async def _execute(self, db: AsyncSession, **kwargs: Any) -> dict[str, Any]:
        """Execute sales aggregation query."""
        start_date = kwargs.get("start_date")
        end_date = kwargs.get("end_date")
        group_by = kwargs.get("group_by", "product")
        top_n = kwargs.get("top_n", 10)

        # Parse dates
        if start_date:
            start_dt = datetime.fromisoformat(start_date).replace(tzinfo=UTC)
        else:
            start_dt = datetime.now(UTC) - timedelta(days=30)

        if end_date:
            end_dt = datetime.fromisoformat(end_date).replace(tzinfo=UTC)
        else:
            end_dt = datetime.now(UTC)

        # Build query based on group_by
        if group_by == "product":
            query = (
                select(
                    Product.id,
                    Product.name,
                    Product.sku,
                    Product.category,
                    func.sum(OrderItem.quantity).label("total_quantity"),
                    func.sum(OrderItem.line_total).label("total_revenue"),
                    func.count(func.distinct(Order.id)).label("order_count"),
                )
                .join(OrderItem, OrderItem.product_id == Product.id)
                .join(Order, Order.id == OrderItem.order_id)
                .where(
                    and_(
                        Order.order_date >= start_dt,
                        Order.order_date <= end_dt,
                        Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.DELIVERED]),
                    )
                )
                .group_by(Product.id, Product.name, Product.sku, Product.category)
                .order_by(desc("total_revenue"))
                .limit(top_n)
            )

            result = await db.execute(query)
            rows = result.all()

            return {
                "group_by": "product",
                "period": {"start": start_dt.isoformat(), "end": end_dt.isoformat()},
                "results": [
                    {
                        "product_id": str(row.id),
                        "name": row.name,
                        "sku": row.sku,
                        "category": row.category.value,
                        "total_quantity": int(row.total_quantity or 0),
                        "total_revenue": float(row.total_revenue or 0),
                        "order_count": int(row.order_count or 0),
                    }
                    for row in rows
                ],
                "total_items": len(rows),
            }

        elif group_by == "customer":
            query = (
                select(
                    Customer.id,
                    Customer.company_name,
                    Customer.customer_number,
                    func.count(func.distinct(Order.id)).label("order_count"),
                    func.sum(Order.total).label("total_revenue"),
                )
                .join(Order, Order.customer_id == Customer.id)
                .where(
                    and_(
                        Order.order_date >= start_dt,
                        Order.order_date <= end_dt,
                        Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.DELIVERED]),
                    )
                )
                .group_by(Customer.id, Customer.company_name, Customer.customer_number)
                .order_by(desc("total_revenue"))
                .limit(top_n)
            )

            result = await db.execute(query)
            rows = result.all()

            return {
                "group_by": "customer",
                "period": {"start": start_dt.isoformat(), "end": end_dt.isoformat()},
                "results": [
                    {
                        "customer_id": str(row.id),
                        "company_name": row.company_name,
                        "customer_number": row.customer_number,
                        "order_count": int(row.order_count or 0),
                        "total_revenue": float(row.total_revenue or 0),
                    }
                    for row in rows
                ],
                "total_items": len(rows),
            }

        elif group_by == "category":
            query = (
                select(
                    Product.category,
                    func.sum(OrderItem.quantity).label("total_quantity"),
                    func.sum(OrderItem.line_total).label("total_revenue"),
                    func.count(func.distinct(Order.id)).label("order_count"),
                    func.count(func.distinct(Product.id)).label("product_count"),
                )
                .join(OrderItem, OrderItem.product_id == Product.id)
                .join(Order, Order.id == OrderItem.order_id)
                .where(
                    and_(
                        Order.order_date >= start_dt,
                        Order.order_date <= end_dt,
                        Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.DELIVERED]),
                    )
                )
                .group_by(Product.category)
                .order_by(desc("total_revenue"))
            )

            result = await db.execute(query)
            rows = result.all()

            return {
                "group_by": "category",
                "period": {"start": start_dt.isoformat(), "end": end_dt.isoformat()},
                "results": [
                    {
                        "category": row.category.value,
                        "total_quantity": int(row.total_quantity or 0),
                        "total_revenue": float(row.total_revenue or 0),
                        "order_count": int(row.order_count or 0),
                        "product_count": int(row.product_count or 0),
                    }
                    for row in rows
                ],
                "total_items": len(rows),
            }

        elif group_by == "date":
            # Group by day
            query = (
                select(
                    func.date(Order.order_date).label("date"),
                    func.count(func.distinct(Order.id)).label("order_count"),
                    func.sum(Order.total).label("total_revenue"),
                )
                .where(
                    and_(
                        Order.order_date >= start_dt,
                        Order.order_date <= end_dt,
                        Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.DELIVERED]),
                    )
                )
                .group_by(func.date(Order.order_date))
                .order_by(func.date(Order.order_date))
            )

            result = await db.execute(query)
            rows = result.all()

            return {
                "group_by": "date",
                "period": {"start": start_dt.isoformat(), "end": end_dt.isoformat()},
                "results": [
                    {
                        "date": str(row.date),
                        "order_count": int(row.order_count or 0),
                        "total_revenue": float(row.total_revenue or 0),
                    }
                    for row in rows
                ],
                "total_items": len(rows),
            }

        return {"error": f"Invalid group_by value: {group_by}"}


class AnalyzeTrendsTool(BaseDatabaseTool):
    """Tool for identifying trends and patterns in sales data."""

    name: str = "analyze_trends"
    description: str = (
        "Analyze trends and patterns in sales, orders, or revenue over time. "
        "Identifies growth/decline patterns, seasonal trends, and anomalies. "
        "Use this for questions about trends, growth, decline, or patterns."
    )
    args_schema: type[BaseModel] = AnalyzeTrendsInput

    async def _execute(self, db: AsyncSession, **kwargs: Any) -> dict[str, Any]:
        """Execute trend analysis."""
        category = kwargs.get("category")
        days = kwargs.get("days", 90)
        metric = kwargs.get("metric", "sales")

        end_date = datetime.now(UTC)
        start_date = end_date - timedelta(days=days)

        # Get weekly aggregates
        query = (
            select(
                func.date_trunc("week", Order.order_date).label("week"),
                func.count(func.distinct(Order.id)).label("order_count"),
                func.sum(Order.total).label("total_revenue"),
                func.sum(OrderItem.quantity).label("total_quantity"),
            )
            .join(OrderItem, OrderItem.order_id == Order.id)
            .join(Product, Product.id == OrderItem.product_id)
            .where(
                and_(
                    Order.order_date >= start_date,
                    Order.order_date <= end_date,
                    Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.DELIVERED]),
                )
            )
            .group_by(func.date_trunc("week", Order.order_date))
            .order_by(func.date_trunc("week", Order.order_date))
        )

        if category:
            query = query.where(Product.category == ProductCategory(category))

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return {
                "category": category,
                "period_days": days,
                "trend": "no_data",
                "data_points": [],
            }

        # Calculate trend
        data_points = []
        for row in rows:
            if metric == "sales":
                value = int(row.total_quantity or 0)
            elif metric == "orders":
                value = int(row.order_count or 0)
            elif metric == "revenue":
                value = float(row.total_revenue or 0)
            else:
                value = 0

            data_points.append(
                {
                    "week": str(row.week),
                    "value": value,
                }
            )

        # Simple trend calculation (first half vs second half)
        midpoint = len(data_points) // 2
        first_half_avg = sum(d["value"] for d in data_points[:midpoint]) / max(midpoint, 1)
        second_half_avg = sum(d["value"] for d in data_points[midpoint:]) / max(
            len(data_points) - midpoint, 1
        )

        if second_half_avg > first_half_avg * 1.1:
            trend = "increasing"
            trend_percentage = ((second_half_avg - first_half_avg) / first_half_avg) * 100
        elif second_half_avg < first_half_avg * 0.9:
            trend = "decreasing"
            trend_percentage = ((first_half_avg - second_half_avg) / first_half_avg) * 100
        else:
            trend = "stable"
            trend_percentage = 0

        return {
            "category": category,
            "metric": metric,
            "period_days": days,
            "trend": trend,
            "trend_percentage": round(trend_percentage, 2),
            "first_half_average": round(first_half_avg, 2),
            "second_half_average": round(second_half_avg, 2),
            "data_points": data_points,
            "total_weeks": len(data_points),
        }


class CustomerSegmentationTool(BaseDatabaseTool):
    """Tool for RFM (Recency, Frequency, Monetary) customer segmentation analysis."""

    name: str = "segment_customers"
    description: str = (
        "Perform RFM (Recency, Frequency, Monetary) analysis to segment customers. "
        "Identifies VIP customers, at-risk customers, and inactive customers. "
        "Use this for questions about customer segments, VIP customers, or customer behavior."
    )
    args_schema: type[BaseModel] = CustomerSegmentationInput

    async def _execute(self, db: AsyncSession, **kwargs: Any) -> dict[str, Any]:
        """Execute customer segmentation."""
        days = kwargs.get("days", 90)
        cutoff_date = datetime.now(UTC) - timedelta(days=days)

        # RFM query
        query = (
            select(
                Customer.id,
                Customer.company_name,
                Customer.customer_number,
                func.max(Order.order_date).label("last_order_date"),
                func.count(func.distinct(Order.id)).label("order_count"),
                func.sum(Order.total).label("total_spent"),
            )
            .join(Order, Order.customer_id == Customer.id)
            .where(
                and_(
                    Order.order_date >= cutoff_date,
                    Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.DELIVERED]),
                )
            )
            .group_by(Customer.id, Customer.company_name, Customer.customer_number)
            .order_by(desc("total_spent"))
        )

        result = await db.execute(query)
        rows = result.all()

        if not rows:
            return {
                "period_days": days,
                "total_customers": 0,
                "segments": {},
            }

        # Calculate RFM scores
        now = datetime.now(UTC)
        customers = []

        for row in rows:
            recency_days = (now - row.last_order_date).days
            frequency = int(row.order_count or 0)
            monetary = float(row.total_spent or 0)

            # Simple segmentation
            if recency_days <= 30 and frequency >= 3 and monetary >= 1000:
                segment = "vip"
            elif recency_days <= 30 and frequency >= 2:
                segment = "active"
            elif recency_days <= 60:
                segment = "regular"
            elif recency_days <= 90:
                segment = "at_risk"
            else:
                segment = "inactive"

            customers.append(
                {
                    "customer_id": str(row.id),
                    "company_name": row.company_name,
                    "customer_number": row.customer_number,
                    "segment": segment,
                    "recency_days": recency_days,
                    "frequency": frequency,
                    "monetary": monetary,
                }
            )

        # Group by segment
        segments = {}
        for customer in customers:
            segment = customer["segment"]
            if segment not in segments:
                segments[segment] = []
            segments[segment].append(customer)

        return {
            "period_days": days,
            "total_customers": len(customers),
            "segments": {
                seg: {"count": len(custs), "customers": custs[:10]}  # Limit to top 10 per segment
                for seg, custs in segments.items()
            },
        }


class InventoryAnalysisTool(BaseDatabaseTool):
    """Tool for analyzing inventory levels and making stock recommendations."""

    name: str = "analyze_inventory"
    description: str = (
        "Analyze inventory levels, identify low stock products, and make reorder recommendations. "
        "Use this for questions about inventory, stock levels, low stock, or reorder needs."
    )
    args_schema: type[BaseModel] = InventoryAnalysisInput

    async def _execute(self, db: AsyncSession, **kwargs: Any) -> dict[str, Any]:
        """Execute inventory analysis."""
        low_stock_threshold = kwargs.get("low_stock_threshold", 10)
        include_inactive = kwargs.get("include_inactive", False)

        # Get products with stock levels
        query = select(
            Product.id,
            Product.name,
            Product.sku,
            Product.category,
            Product.stock,
            Product.price,
            Product.cost,
            Product.is_active,
        ).order_by(Product.stock)

        if not include_inactive:
            query = query.where(Product.is_active == True)  # noqa: E712

        result = await db.execute(query)
        products = result.all()

        # Categorize products
        out_of_stock = []
        low_stock = []
        adequate_stock = []
        overstocked = []

        for prod in products:
            prod_data = {
                "product_id": str(prod.id),
                "name": prod.name,
                "sku": prod.sku,
                "category": prod.category.value,
                "stock": prod.stock,
                "price": float(prod.price),
                "cost": float(prod.cost),
                "is_active": prod.is_active,
            }

            if prod.stock == 0:
                out_of_stock.append(prod_data)
            elif prod.stock <= low_stock_threshold:
                low_stock.append(prod_data)
            elif prod.stock <= low_stock_threshold * 3:
                adequate_stock.append(prod_data)
            else:
                overstocked.append(prod_data)

        return {
            "low_stock_threshold": low_stock_threshold,
            "summary": {
                "out_of_stock_count": len(out_of_stock),
                "low_stock_count": len(low_stock),
                "adequate_stock_count": len(adequate_stock),
                "overstocked_count": len(overstocked),
                "total_products": len(products),
            },
            "out_of_stock": out_of_stock[:20],  # Limit results
            "low_stock": low_stock[:20],
            "recommendations": self._generate_reorder_recommendations(
                out_of_stock + low_stock, low_stock_threshold
            ),
        }

    def _generate_reorder_recommendations(
        self, products: list[dict[str, Any]], threshold: int
    ) -> list[dict[str, Any]]:
        """Generate reorder recommendations based on stock levels."""
        recommendations = []

        for prod in products:
            stock = prod["stock"]
            reorder_quantity = max(threshold * 3 - stock, threshold)

            recommendations.append(
                {
                    "product_id": prod["product_id"],
                    "name": prod["name"],
                    "sku": prod["sku"],
                    "current_stock": stock,
                    "recommended_order": reorder_quantity,
                    "estimated_cost": reorder_quantity * prod["cost"],
                    "priority": "urgent" if stock == 0 else "high" if stock <= 3 else "medium",
                }
            )

        return recommendations


# Export all tools
__all__ = [
    "AggregateSalesTool",
    "AnalyzeTrendsTool",
    "CustomerSegmentationTool",
    "InventoryAnalysisTool",
]
