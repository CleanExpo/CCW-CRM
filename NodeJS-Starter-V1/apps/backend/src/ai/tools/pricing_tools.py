"""Pricing analysis and recommendation tools."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Order, OrderItem, Product, Quote, QuoteItem
from src.utils import get_logger

from .base import BaseTool, ToolOutput

logger = get_logger(__name__)


class AnalyzePricingHistoryTool(BaseTool):
    """Analyze historical pricing data for products."""

    name = "analyze_pricing_history"
    description = "Analyze historical pricing trends for products based on orders and quotes"

    def __init__(self):
        super().__init__(self.name, self.description)

    async def execute(
        self, product_id: UUID | None = None, days: int = 90, db: AsyncSession | None = None
    ) -> ToolOutput:
        """Analyze pricing history.

        Args:
            product_id: Specific product to analyze (None = all products)
            days: Number of days to look back
            db: Database session

        Returns:
            ToolOutput with pricing analysis
        """
        if not db:
            return ToolOutput(
                success=False, error="Database session required", data={}
            )

        try:
            since_date = datetime.now(UTC) - timedelta(days=days)

            # Analyze order pricing
            order_query = (
                select(
                    OrderItem.product_id,
                    Product.sku,
                    Product.name,
                    func.count(OrderItem.id).label("order_count"),
                    func.avg(OrderItem.unit_price).label("avg_order_price"),
                    func.min(OrderItem.unit_price).label("min_order_price"),
                    func.max(OrderItem.unit_price).label("max_order_price"),
                    func.sum(OrderItem.quantity).label("total_quantity_sold"),
                )
                .join(Order, OrderItem.order_id == Order.id)
                .join(Product, OrderItem.product_id == Product.id)
                .where(Order.order_date >= since_date)
            )

            if product_id:
                order_query = order_query.where(OrderItem.product_id == product_id)

            order_query = order_query.group_by(
                OrderItem.product_id, Product.sku, Product.name
            )

            order_result = await db.execute(order_query)
            order_data = order_result.all()

            # Analyze quote pricing
            quote_query = (
                select(
                    QuoteItem.product_id,
                    Product.sku,
                    Product.name,
                    func.count(QuoteItem.id).label("quote_count"),
                    func.avg(QuoteItem.unit_price).label("avg_quote_price"),
                    func.min(QuoteItem.unit_price).label("min_quote_price"),
                    func.max(QuoteItem.unit_price).label("max_quote_price"),
                )
                .join(Quote, QuoteItem.quote_id == Quote.id)
                .join(Product, QuoteItem.product_id == Product.id)
                .where(Quote.quote_date >= since_date)
            )

            if product_id:
                quote_query = quote_query.where(QuoteItem.product_id == product_id)

            quote_query = quote_query.group_by(
                QuoteItem.product_id, Product.sku, Product.name
            )

            quote_result = await db.execute(quote_query)
            quote_data = quote_result.all()

            # Format results
            analysis = []

            for row in order_data:
                analysis.append(
                    {
                        "product_id": str(row.product_id),
                        "sku": row.sku,
                        "name": row.name,
                        "order_count": row.order_count,
                        "avg_order_price": float(row.avg_order_price or 0),
                        "min_order_price": float(row.min_order_price or 0),
                        "max_order_price": float(row.max_order_price or 0),
                        "total_quantity_sold": row.total_quantity_sold or 0,
                        "data_source": "orders",
                    }
                )

            for row in quote_data:
                # Find if we already have this product from orders
                existing = next(
                    (item for item in analysis if item["product_id"] == str(row.product_id)),
                    None,
                )
                if existing:
                    existing["quote_count"] = row.quote_count
                    existing["avg_quote_price"] = float(row.avg_quote_price or 0)
                    existing["min_quote_price"] = float(row.min_quote_price or 0)
                    existing["max_quote_price"] = float(row.max_quote_price or 0)
                    existing["data_source"] = "orders_and_quotes"
                else:
                    analysis.append(
                        {
                            "product_id": str(row.product_id),
                            "sku": row.sku,
                            "name": row.name,
                            "quote_count": row.quote_count,
                            "avg_quote_price": float(row.avg_quote_price or 0),
                            "min_quote_price": float(row.min_quote_price or 0),
                            "max_quote_price": float(row.max_quote_price or 0),
                            "data_source": "quotes",
                        }
                    )

            return ToolOutput(
                success=True,
                data={
                    "analysis": analysis,
                    "analysis_period_days": days,
                    "products_analyzed": len(analysis),
                },
            )

        except Exception as e:
            logger.error("Pricing history analysis failed", error=str(e))
            return ToolOutput(success=False, error=str(e), data={})


class CalculateMarginTool(BaseTool):
    """Calculate profit margins for products."""

    name = "calculate_margin"
    description = "Calculate profit margins based on cost and selling price"

    def __init__(self):
        super().__init__(self.name, self.description)

    async def execute(
        self,
        product_id: UUID | None = None,
        proposed_price: Decimal | None = None,
        db: AsyncSession | None = None,
    ) -> ToolOutput:
        """Calculate profit margin.

        Args:
            product_id: Product to analyze
            proposed_price: Proposed selling price (None = use current price)
            db: Database session

        Returns:
            ToolOutput with margin calculations
        """
        if not db:
            return ToolOutput(success=False, error="Database session required", data={})

        try:
            # Query product(s)
            query = select(Product).where(Product.is_active == True)
            if product_id:
                query = query.where(Product.id == product_id)

            result = await db.execute(query)
            products = result.scalars().all()

            if not products:
                return ToolOutput(
                    success=False,
                    error="No products found for margin calculation",
                    data={},
                )

            margin_data = []
            for product in products:
                # Use proposed price or current price
                selling_price = proposed_price if proposed_price else product.price
                cost = product.cost or Decimal("0")

                # Calculate margins
                if selling_price > 0:
                    gross_profit = selling_price - cost
                    margin_percentage = (gross_profit / selling_price) * 100
                    markup_percentage = (
                        (gross_profit / cost) * 100 if cost > 0 else 0
                    )
                else:
                    gross_profit = Decimal("0")
                    margin_percentage = Decimal("0")
                    markup_percentage = Decimal("0")

                margin_data.append(
                    {
                        "product_id": str(product.id),
                        "sku": product.sku,
                        "name": product.name,
                        "cost": float(cost),
                        "current_price": float(product.price),
                        "proposed_price": float(selling_price),
                        "gross_profit": float(gross_profit),
                        "margin_percentage": float(margin_percentage),
                        "markup_percentage": float(markup_percentage),
                        "margin_rating": (
                            "excellent"
                            if margin_percentage >= 40
                            else "good"
                            if margin_percentage >= 30
                            else "fair"
                            if margin_percentage >= 20
                            else "low"
                        ),
                    }
                )

            return ToolOutput(
                success=True,
                data={"margins": margin_data, "products_analyzed": len(margin_data)},
            )

        except Exception as e:
            logger.error("Margin calculation failed", error=str(e))
            return ToolOutput(success=False, error=str(e), data={})


class RecommendPriceTool(BaseTool):
    """Recommend optimal pricing for products."""

    name = "recommend_price"
    description = "Recommend optimal pricing based on cost, market, and historical data"

    def __init__(self):
        super().__init__(self.name, self.description)

    async def execute(
        self,
        product_id: UUID,
        target_margin_percentage: Decimal = Decimal("30"),
        consider_history: bool = True,
        db: AsyncSession | None = None,
    ) -> ToolOutput:
        """Recommend optimal price.

        Args:
            product_id: Product to price
            target_margin_percentage: Desired profit margin (default 30%)
            consider_history: Whether to factor in historical pricing
            db: Database session

        Returns:
            ToolOutput with price recommendation
        """
        if not db:
            return ToolOutput(success=False, error="Database session required", data={})

        try:
            # Get product
            result = await db.execute(
                select(Product).where(Product.id == product_id)
            )
            product = result.scalar_one_or_none()

            if not product:
                return ToolOutput(
                    success=False, error=f"Product {product_id} not found", data={}
                )

            # Get cost
            cost = product.cost or Decimal("0")
            if cost <= 0:
                return ToolOutput(
                    success=False,
                    error="Product cost is zero or negative - cannot recommend price",
                    data={},
                )

            # Calculate target price based on desired margin
            # margin = (price - cost) / price
            # price * margin = price - cost
            # price * (1 - margin) = cost
            # price = cost / (1 - margin)
            margin_decimal = target_margin_percentage / 100
            target_price = cost / (1 - margin_decimal)

            # Get historical pricing if requested
            historical_avg = None
            historical_min = None
            historical_max = None

            if consider_history:
                # Use AnalyzePricingHistoryTool
                history_tool = AnalyzePricingHistoryTool()
                history_result = await history_tool.execute(
                    product_id=product_id, days=90, db=db
                )

                if history_result.success and history_result.data.get("analysis"):
                    analysis = history_result.data["analysis"][0]
                    if "avg_order_price" in analysis:
                        historical_avg = Decimal(str(analysis["avg_order_price"]))
                    if "min_order_price" in analysis:
                        historical_min = Decimal(str(analysis["min_order_price"]))
                    if "max_order_price" in analysis:
                        historical_max = Decimal(str(analysis["max_order_price"]))

            # Adjust recommendation based on historical data
            recommended_price = target_price
            reasoning = [f"Cost-based target price: ${target_price:.2f}"]

            if historical_avg:
                reasoning.append(f"Historical average: ${historical_avg:.2f}")
                # If historical average is within 10% of target, use it
                if abs(historical_avg - target_price) / target_price <= 0.1:
                    recommended_price = historical_avg
                    reasoning.append("Using historical average (within 10% of target)")
                elif historical_avg > target_price:
                    # Market can bear higher price
                    recommended_price = (target_price + historical_avg) / 2
                    reasoning.append("Market supports higher price - averaging with historical")
                else:
                    # Historical is lower - be conservative
                    recommended_price = target_price
                    reasoning.append("Historical is lower - sticking with target for margin")

            # Calculate final margin with recommended price
            final_margin = ((recommended_price - cost) / recommended_price) * 100

            # Get current margin for comparison
            current_margin = (
                ((product.price - cost) / product.price) * 100
                if product.price > 0
                else 0
            )

            recommendation = {
                "product_id": str(product.id),
                "sku": product.sku,
                "name": product.name,
                "cost": float(cost),
                "current_price": float(product.price),
                "current_margin_percentage": float(current_margin),
                "recommended_price": float(recommended_price),
                "recommended_margin_percentage": float(final_margin),
                "target_margin_percentage": float(target_margin_percentage),
                "price_change": float(recommended_price - product.price),
                "price_change_percentage": (
                    float(
                        ((recommended_price - product.price) / product.price) * 100
                    )
                    if product.price > 0
                    else 0
                ),
                "historical_average": float(historical_avg) if historical_avg else None,
                "historical_min": float(historical_min) if historical_min else None,
                "historical_max": float(historical_max) if historical_max else None,
                "reasoning": reasoning,
                "confidence": (
                    "high" if historical_avg else "medium"
                ),  # High if we have historical data
            }

            return ToolOutput(success=True, data={"recommendation": recommendation})

        except Exception as e:
            logger.error("Price recommendation failed", error=str(e))
            return ToolOutput(success=False, error=str(e), data={})
