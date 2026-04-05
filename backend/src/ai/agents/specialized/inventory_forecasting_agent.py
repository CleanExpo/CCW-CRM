"""
Inventory Forecasting Agent.

AI-powered demand prediction and stock replenishment recommendations.
"""

from datetime import datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.base_agent import BaseAgent
from src.db.demo_models import Order, OrderItem, Product

logger = structlog.get_logger(__name__)


class InventoryForecastingAgent(BaseAgent):
    """
    Predicts inventory needs and generates reorder recommendations.

    Uses historical sales data to forecast demand, calculate stock depletion dates,
    detect seasonal patterns, and recommend optimal reorder quantities.
    """

    def __init__(self):
        """Initialize the inventory forecasting agent."""
        super().__init__(
            name="InventoryForecastingAgent",
            auto_register=True
        )
        self.capabilities = [
            "inventory_forecasting",
            "demand_prediction",
            "reorder_recommendations",
            "seasonal_pattern_detection",
            "safety_stock_calculation",
        ]
        self.description = "AI-powered inventory forecasting and replenishment planning"
        self.requires_verification = False  # Auto-suggestions, not direct actions
        self.estimated_execution_time = 8  # seconds

        # Forecasting parameters
        self.lookback_days = 90  # Use last 3 months of data
        self.min_order_history = 3  # Minimum orders needed for forecast
        self.safety_stock_factor = 1.5  # 50% buffer above average demand
        self.lead_time_days = 14  # Default supplier lead time

    async def execute(self, task: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        """
        Generate inventory forecasts and reorder recommendations.

        Args:
            task: Task description
            context: Additional context with keys:
                - product_id: Optional specific product (if None, forecast all low-stock products)
                - forecast_days: Days to forecast ahead (default: 30)
                - include_seasonal: Whether to include seasonal analysis (default: True)

        Returns:
            Dictionary with:
            - forecasts: List of product forecasts
            - reorder_recommendations: Products needing reorder
            - total_products_analyzed: Count
            - confidence: Overall forecast confidence
            - error: Error message if any
        """
        self._log_execution_start(task, context)

        if not context:
            context = {}

        product_id = context.get("product_id")
        forecast_days = context.get("forecast_days", 30)
        include_seasonal = context.get("include_seasonal", True)

        try:
            async with self.get_db_session() as db:
                if product_id:
                    # Forecast single product
                    forecasts = [await self._forecast_product(db, product_id, forecast_days, include_seasonal)]
                else:
                    # Forecast all active products
                    forecasts = await self._forecast_all_products(db, forecast_days, include_seasonal)

                # Generate reorder recommendations (products below reorder point)
                reorder_recommendations = [
                    f for f in forecasts
                    if f.get("needs_reorder", False)
                ]

                # Calculate overall confidence
                avg_confidence = sum(f.get("confidence", 0) for f in forecasts) / len(forecasts) if forecasts else 0.0

                result = {
                    "forecasts": forecasts,
                    "reorder_recommendations": reorder_recommendations,
                    "total_products_analyzed": len(forecasts),
                    "confidence": avg_confidence,
                }

                self._log_execution_complete(True)
                return result

        except Exception as e:
            logger.error("Inventory forecasting failed", error=str(e), context=context)
            self._log_execution_complete(False, str(e))
            return {"error": str(e)}

    async def stream(self, task: str, context: dict[str, Any] | None = None):
        """Not implemented for this agent."""
        yield "Inventory forecasting does not support streaming"

    async def _forecast_all_products(
        self,
        db: AsyncSession,
        forecast_days: int,
        include_seasonal: bool
    ) -> list[dict[str, Any]]:
        """
        Forecast all active products with sufficient history.

        Args:
            db: Database session
            forecast_days: Days to forecast ahead
            include_seasonal: Whether to include seasonal analysis

        Returns:
            List of product forecasts
        """
        # Get all active products
        products_query = select(Product).where(Product.is_active == True)
        products_result = await db.execute(products_query)
        products = products_result.scalars().all()

        forecasts = []
        for product in products:
            try:
                forecast = await self._forecast_product(db, str(product.id), forecast_days, include_seasonal)
                forecasts.append(forecast)
            except Exception as e:
                logger.warning("Failed to forecast product", product_id=str(product.id), error=str(e))
                # Continue with other products

        return forecasts

    async def _forecast_product(
        self,
        db: AsyncSession,
        product_id: str,
        forecast_days: int,
        include_seasonal: bool
    ) -> dict[str, Any]:
        """
        Forecast demand for a single product.

        Args:
            db: Database session
            product_id: Product UUID
            forecast_days: Days to forecast ahead
            include_seasonal: Whether to include seasonal analysis

        Returns:
            Product forecast details
        """
        # Get product details
        product_query = select(Product).where(Product.id == product_id)
        product_result = await db.execute(product_query)
        product = product_result.scalar_one_or_none()

        if not product:
            raise ValueError(f"Product {product_id} not found")

        # Calculate sales velocity (average daily sales)
        sales_velocity = await self._calculate_sales_velocity(db, product_id)

        # Calculate stock depletion date
        depletion_date, days_until_depletion = self._calculate_depletion_date(
            current_stock=product.stock,
            daily_sales=sales_velocity["avg_daily_sales"]
        )

        # Calculate reorder point and safety stock
        reorder_point = self._calculate_reorder_point(
            daily_sales=sales_velocity["avg_daily_sales"],
            lead_time_days=self.lead_time_days,
            safety_factor=self.safety_stock_factor
        )

        safety_stock = self._calculate_safety_stock(
            daily_sales=sales_velocity["avg_daily_sales"],
            safety_factor=self.safety_stock_factor
        )

        # Calculate recommended order quantity (EOQ simplified)
        recommended_order_qty = self._calculate_order_quantity(
            daily_sales=sales_velocity["avg_daily_sales"],
            lead_time_days=self.lead_time_days
        )

        # Detect seasonal patterns (if requested)
        seasonal_pattern = None
        if include_seasonal:
            seasonal_pattern = await self._detect_seasonal_pattern(db, product_id)

        # Determine confidence based on data quality
        confidence = self._calculate_confidence(
            order_count=sales_velocity["order_count"],
            days_of_data=sales_velocity["days_of_data"],
            std_dev=sales_velocity.get("std_dev", 0)
        )

        # Determine if reorder is needed
        needs_reorder = product.stock <= reorder_point
        urgency = self._calculate_urgency(days_until_depletion)

        return {
            "product_id": str(product.id),
            "product_name": product.name,
            "sku": product.sku,
            "current_stock": product.stock,
            "sales_velocity": {
                "avg_daily_sales": round(sales_velocity["avg_daily_sales"], 2),
                "total_sold": sales_velocity["total_sold"],
                "order_count": sales_velocity["order_count"],
                "days_of_data": sales_velocity["days_of_data"],
            },
            "forecast": {
                "days_until_depletion": days_until_depletion,
                "depletion_date": depletion_date.isoformat() if depletion_date else None,
                "reorder_point": reorder_point,
                "safety_stock": safety_stock,
            },
            "recommendation": {
                "needs_reorder": needs_reorder,
                "urgency": urgency,  # "critical", "high", "medium", "low"
                "recommended_order_qty": recommended_order_qty,
                "estimated_cost": float(product.cost) * recommended_order_qty if product.cost else None,
            },
            "seasonal_pattern": seasonal_pattern,
            "confidence": confidence,
        }

    async def _calculate_sales_velocity(
        self,
        db: AsyncSession,
        product_id: str
    ) -> dict[str, Any]:
        """
        Calculate average daily sales velocity from order history.

        Args:
            db: Database session
            product_id: Product UUID

        Returns:
            Dictionary with avg_daily_sales, total_sold, order_count, days_of_data
        """
        # Get order items for this product in the lookback period
        cutoff_date = datetime.utcnow() - timedelta(days=self.lookback_days)

        query = (
            select(
                func.sum(OrderItem.quantity).label("total_sold"),
                func.count(OrderItem.id).label("order_count"),
            )
            .join(Order, OrderItem.order_id == Order.id)
            .where(
                OrderItem.product_id == product_id,
                Order.order_date >= cutoff_date,
                Order.status.in_(["confirmed", "processing", "shipped", "delivered"])  # Exclude draft/cancelled
            )
        )

        result = await db.execute(query)
        row = result.first()

        total_sold = row.total_sold or 0
        order_count = row.order_count or 0

        # Calculate actual days of data (from first order to now)
        first_order_query = (
            select(func.min(Order.order_date))
            .join(OrderItem, Order.id == OrderItem.order_id)
            .where(
                OrderItem.product_id == product_id,
                Order.order_date >= cutoff_date,
                Order.status.in_(["confirmed", "processing", "shipped", "delivered"])
            )
        )
        first_order_result = await db.execute(first_order_query)
        first_order_date = first_order_result.scalar()

        if first_order_date:
            days_of_data = (datetime.utcnow() - first_order_date).days
            days_of_data = max(days_of_data, 1)  # At least 1 day
        else:
            days_of_data = self.lookback_days

        # Calculate average daily sales
        avg_daily_sales = total_sold / days_of_data if days_of_data > 0 else 0

        return {
            "avg_daily_sales": avg_daily_sales,
            "total_sold": total_sold,
            "order_count": order_count,
            "days_of_data": days_of_data,
        }

    def _calculate_depletion_date(
        self,
        current_stock: int,
        daily_sales: float
    ) -> tuple[datetime | None, int | None]:
        """
        Calculate when stock will deplete at current sales velocity.

        Args:
            current_stock: Current stock level
            daily_sales: Average daily sales rate

        Returns:
            (depletion_date, days_until_depletion)
        """
        if daily_sales <= 0:
            return None, None  # No sales = no depletion

        days_until_depletion = int(current_stock / daily_sales)
        depletion_date = datetime.utcnow() + timedelta(days=days_until_depletion)

        return depletion_date, days_until_depletion

    def _calculate_reorder_point(
        self,
        daily_sales: float,
        lead_time_days: int,
        safety_factor: float
    ) -> int:
        """
        Calculate reorder point (when to place order).

        Formula: Reorder Point = (Avg Daily Sales × Lead Time) + Safety Stock

        Args:
            daily_sales: Average daily sales
            lead_time_days: Supplier lead time in days
            safety_factor: Safety stock multiplier

        Returns:
            Reorder point quantity
        """
        lead_time_demand = daily_sales * lead_time_days
        safety_stock = self._calculate_safety_stock(daily_sales, safety_factor)
        reorder_point = int(lead_time_demand + safety_stock)

        return max(reorder_point, 0)

    def _calculate_safety_stock(
        self,
        daily_sales: float,
        safety_factor: float
    ) -> int:
        """
        Calculate safety stock buffer.

        Args:
            daily_sales: Average daily sales
            safety_factor: Safety stock multiplier

        Returns:
            Safety stock quantity
        """
        # Simplified: safety_factor × daily_sales × lead_time
        # More complex versions use standard deviation
        safety_stock = int(daily_sales * self.lead_time_days * (safety_factor - 1))
        return max(safety_stock, 0)

    def _calculate_order_quantity(
        self,
        daily_sales: float,
        lead_time_days: int
    ) -> int:
        """
        Calculate recommended order quantity (simplified EOQ).

        Args:
            daily_sales: Average daily sales
            lead_time_days: Supplier lead time

        Returns:
            Recommended order quantity
        """
        # Simplified: Order enough for 2× lead time
        # Real EOQ formula: sqrt((2 × demand × order_cost) / holding_cost)
        order_qty = int(daily_sales * lead_time_days * 2)
        return max(order_qty, 1)

    async def _detect_seasonal_pattern(
        self,
        db: AsyncSession,
        product_id: str
    ) -> dict[str, Any] | None:
        """
        Detect seasonal sales patterns (monthly variations).

        Args:
            db: Database session
            product_id: Product UUID

        Returns:
            Seasonal pattern details or None if insufficient data
        """
        # Get monthly sales for the past year
        one_year_ago = datetime.utcnow() - timedelta(days=365)

        query = (
            select(
                func.date_trunc("month", Order.order_date).label("month"),
                func.sum(OrderItem.quantity).label("total_quantity"),
            )
            .join(Order, OrderItem.order_id == Order.id)
            .where(
                OrderItem.product_id == product_id,
                Order.order_date >= one_year_ago,
                Order.status.in_(["confirmed", "processing", "shipped", "delivered"])
            )
            .group_by(func.date_trunc("month", Order.order_date))
            .order_by(func.date_trunc("month", Order.order_date))
        )

        result = await db.execute(query)
        rows = result.all()

        if len(rows) < 6:  # Need at least 6 months of data
            return None

        # Calculate average and identify peaks/troughs
        monthly_sales = [row.total_quantity for row in rows]
        avg_monthly_sales = sum(monthly_sales) / len(monthly_sales)

        peak_months = []
        trough_months = []

        for row in rows:
            month_name = row.month.strftime("%B")
            quantity = row.total_quantity

            if quantity >= avg_monthly_sales * 1.3:  # 30% above average
                peak_months.append(month_name)
            elif quantity <= avg_monthly_sales * 0.7:  # 30% below average
                trough_months.append(month_name)

        if not peak_months and not trough_months:
            return None  # No clear pattern

        return {
            "pattern_detected": True,
            "peak_months": peak_months,
            "trough_months": trough_months,
            "avg_monthly_sales": round(avg_monthly_sales, 2),
        }

    def _calculate_confidence(
        self,
        order_count: int,
        days_of_data: int,
        std_dev: float
    ) -> float:
        """
        Calculate forecast confidence based on data quality.

        Args:
            order_count: Number of orders in history
            days_of_data: Days of historical data
            std_dev: Standard deviation of sales (if available)

        Returns:
            Confidence score (0-1)
        """
        # Base confidence on order count and data recency
        if order_count < self.min_order_history:
            return 0.3  # Low confidence with insufficient data

        # More orders = higher confidence (max at 30+ orders)
        order_confidence = min(order_count / 30, 1.0)

        # More days of data = higher confidence (max at 90 days)
        data_confidence = min(days_of_data / 90, 1.0)

        # Average the two factors
        confidence = (order_confidence + data_confidence) / 2

        return round(confidence, 2)

    def _calculate_urgency(self, days_until_depletion: int | None) -> str:
        """
        Calculate reorder urgency based on days until depletion.

        Args:
            days_until_depletion: Days until stock runs out

        Returns:
            Urgency level: "critical", "high", "medium", "low"
        """
        if days_until_depletion is None:
            return "low"

        if days_until_depletion <= 7:
            return "critical"  # Less than 1 week
        elif days_until_depletion <= 14:
            return "high"  # Less than 2 weeks
        elif days_until_depletion <= 30:
            return "medium"  # Less than 1 month
        else:
            return "low"  # More than 1 month
