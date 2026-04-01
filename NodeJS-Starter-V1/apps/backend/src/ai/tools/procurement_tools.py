"""Procurement and inventory management tools."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Order, OrderItem, Product, ProductCategory
from src.utils import get_logger

from .base import BaseTool, ToolOutput

logger = get_logger(__name__)


class AnalyzeInventoryTool(BaseTool):
    """Analyze inventory levels and identify restock needs."""

    name = "analyze_inventory"
    description = "Analyze current inventory levels, sales velocity, and restock recommendations"

    def __init__(self):
        super().__init__(self.name, self.description)

    async def execute(
        self,
        category: ProductCategory | None = None,
        low_stock_threshold: int = 50,
        days_lookback: int = 90,
        db: AsyncSession | None = None,
    ) -> ToolOutput:
        """Analyze inventory status.

        Args:
            category: Filter by product category (None = all categories)
            low_stock_threshold: Threshold for low stock warning
            days_lookback: Days to analyze for sales velocity
            db: Database session

        Returns:
            ToolOutput with inventory analysis
        """
        if not db:
            return ToolOutput(success=False, error="Database session required", data={})

        try:
            since_date = datetime.now(UTC) - timedelta(days=days_lookback)

            # Get products with current stock
            products_query = select(Product).where(Product.is_active == True)
            if category:
                products_query = products_query.where(Product.category == category)

            products_result = await db.execute(products_query)
            products = products_result.scalars().all()

            if not products:
                return ToolOutput(
                    success=False,
                    error="No products found for inventory analysis",
                    data={},
                )

            inventory_analysis = []

            for product in products:
                # Calculate sales velocity (units sold in lookback period)
                sales_query = (
                    select(func.sum(OrderItem.quantity))
                    .join(Order, OrderItem.order_id == Order.id)
                    .where(OrderItem.product_id == product.id)
                    .where(Order.order_date >= since_date)
                    .where(Order.status.in_(["confirmed", "processing", "shipped", "delivered"]))
                )

                sales_result = await db.execute(sales_query)
                units_sold = sales_result.scalar() or 0

                # Calculate daily velocity
                daily_velocity = units_sold / days_lookback if days_lookback > 0 else 0

                # Estimate days until stockout
                days_until_stockout = (
                    int(product.stock / daily_velocity) if daily_velocity > 0 else 999
                )

                # Determine stock status
                if product.stock <= 0:
                    stock_status = "out_of_stock"
                    urgency = "critical"
                elif product.stock <= low_stock_threshold:
                    stock_status = "low_stock"
                    urgency = "high" if days_until_stockout < 30 else "medium"
                elif days_until_stockout < 60:
                    stock_status = "approaching_low"
                    urgency = "medium"
                else:
                    stock_status = "adequate"
                    urgency = "low"

                # Calculate value of inventory
                inventory_value = Decimal(str(product.stock)) * (product.cost or Decimal("0"))

                inventory_analysis.append(
                    {
                        "product_id": str(product.id),
                        "sku": product.sku,
                        "name": product.name,
                        "category": product.category.value,
                        "current_stock": product.stock,
                        "stock_status": stock_status,
                        "units_sold_period": int(units_sold),
                        "daily_velocity": round(daily_velocity, 2),
                        "days_until_stockout": days_until_stockout,
                        "urgency": urgency,
                        "unit_cost": float(product.cost or 0),
                        "inventory_value": float(inventory_value),
                        "warehouse_location": product.warehouse_location,
                    }
                )

            # Sort by urgency and days until stockout
            urgency_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
            inventory_analysis.sort(
                key=lambda x: (urgency_order.get(x["urgency"], 4), x["days_until_stockout"])
            )

            # Calculate summary statistics
            total_products = len(inventory_analysis)
            out_of_stock = sum(1 for item in inventory_analysis if item["stock_status"] == "out_of_stock")
            low_stock = sum(1 for item in inventory_analysis if item["stock_status"] == "low_stock")
            total_inventory_value = sum(item["inventory_value"] for item in inventory_analysis)

            return ToolOutput(
                success=True,
                data={
                    "inventory": inventory_analysis,
                    "summary": {
                        "total_products": total_products,
                        "out_of_stock_count": out_of_stock,
                        "low_stock_count": low_stock,
                        "total_inventory_value": round(total_inventory_value, 2),
                        "analysis_period_days": days_lookback,
                    },
                },
            )

        except Exception as e:
            logger.error("Inventory analysis failed", error=str(e))
            return ToolOutput(success=False, error=str(e), data={})


class CalculateReorderQuantityTool(BaseTool):
    """Calculate optimal reorder quantities using EOQ and safety stock."""

    name = "calculate_reorder_quantity"
    description = "Calculate optimal reorder quantities based on sales velocity and lead time"

    def __init__(self):
        super().__init__(self.name, self.description)

    async def execute(
        self,
        product_id: UUID,
        lead_time_days: int = 14,
        safety_stock_days: int = 7,
        db: AsyncSession | None = None,
    ) -> ToolOutput:
        """Calculate reorder quantity.

        Args:
            product_id: Product to calculate for
            lead_time_days: Supplier lead time in days
            safety_stock_days: Safety stock buffer in days
            db: Database session

        Returns:
            ToolOutput with reorder calculations
        """
        if not db:
            return ToolOutput(success=False, error="Database session required", data={})

        try:
            # Get product
            product_result = await db.execute(
                select(Product).where(Product.id == product_id)
            )
            product = product_result.scalar_one_or_none()

            if not product:
                return ToolOutput(
                    success=False, error=f"Product {product_id} not found", data={}
                )

            # Calculate sales velocity (last 90 days)
            since_date = datetime.now(UTC) - timedelta(days=90)

            sales_query = (
                select(func.sum(OrderItem.quantity))
                .join(Order, OrderItem.order_id == Order.id)
                .where(OrderItem.product_id == product_id)
                .where(Order.order_date >= since_date)
                .where(Order.status.in_(["confirmed", "processing", "shipped", "delivered"]))
            )

            sales_result = await db.execute(sales_query)
            units_sold_90_days = sales_result.scalar() or 0

            # Calculate daily demand
            daily_demand = units_sold_90_days / 90.0

            # Calculate reorder point (demand during lead time + safety stock)
            lead_time_demand = daily_demand * lead_time_days
            safety_stock = daily_demand * safety_stock_days
            reorder_point = lead_time_demand + safety_stock

            # Calculate Economic Order Quantity (EOQ)
            # Simplified EOQ without holding/ordering costs (use 30-day supply as heuristic)
            eoq = daily_demand * 30

            # Round to reasonable order quantities
            if eoq < 10:
                recommended_order_qty = max(10, int(eoq))
            elif eoq < 100:
                recommended_order_qty = int((eoq + 9) // 10) * 10  # Round to nearest 10
            else:
                recommended_order_qty = int((eoq + 49) // 50) * 50  # Round to nearest 50

            # Calculate metrics
            current_stock = product.stock
            shortfall = max(0, int(reorder_point - current_stock))
            should_reorder = current_stock <= reorder_point

            # Estimate days of supply
            days_of_supply_current = (
                int(current_stock / daily_demand) if daily_demand > 0 else 999
            )
            days_of_supply_after_order = (
                int((current_stock + recommended_order_qty) / daily_demand)
                if daily_demand > 0
                else 999
            )

            # Calculate costs
            unit_cost = product.cost or Decimal("0")
            order_value = Decimal(str(recommended_order_qty)) * unit_cost

            return ToolOutput(
                success=True,
                data={
                    "product": {
                        "product_id": str(product.id),
                        "sku": product.sku,
                        "name": product.name,
                        "current_stock": current_stock,
                        "unit_cost": float(unit_cost),
                    },
                    "demand_analysis": {
                        "units_sold_90_days": int(units_sold_90_days),
                        "daily_demand": round(daily_demand, 2),
                        "days_of_supply_current": days_of_supply_current,
                    },
                    "reorder_calculation": {
                        "reorder_point": int(reorder_point),
                        "lead_time_demand": int(lead_time_demand),
                        "safety_stock": int(safety_stock),
                        "recommended_order_qty": recommended_order_qty,
                        "should_reorder_now": should_reorder,
                        "shortfall": shortfall,
                    },
                    "after_order": {
                        "new_stock_level": current_stock + recommended_order_qty,
                        "days_of_supply": days_of_supply_after_order,
                        "order_value": float(order_value),
                    },
                    "parameters": {
                        "lead_time_days": lead_time_days,
                        "safety_stock_days": safety_stock_days,
                    },
                },
            )

        except Exception as e:
            logger.error("Reorder quantity calculation failed", error=str(e))
            return ToolOutput(success=False, error=str(e), data={})


class SuggestSuppliersTool(BaseTool):
    """Suggest suppliers for products (mock implementation)."""

    name = "suggest_suppliers"
    description = "Suggest suppliers for products based on category and requirements"

    def __init__(self):
        super().__init__(self.name, self.description)

    async def execute(
        self,
        product_id: UUID,
        quantity: int,
        db: AsyncSession | None = None,
    ) -> ToolOutput:
        """Suggest suppliers for a product.

        Note: This is a mock implementation. In a real system, this would query
        a suppliers database with pricing, lead times, and ratings.

        Args:
            product_id: Product to source
            quantity: Quantity needed
            db: Database session

        Returns:
            ToolOutput with supplier suggestions
        """
        if not db:
            return ToolOutput(success=False, error="Database session required", data={})

        try:
            # Get product
            product_result = await db.execute(
                select(Product).where(Product.id == product_id)
            )
            product = product_result.scalar_one_or_none()

            if not product:
                return ToolOutput(
                    success=False, error=f"Product {product_id} not found", data={}
                )

            # Mock supplier data based on product category
            category = product.category.value
            unit_cost = product.cost or Decimal("0")

            # Generate mock suppliers with different characteristics
            suppliers = []

            # Supplier 1: Lowest price, longer lead time
            suppliers.append(
                {
                    "supplier_id": "SUP-001",
                    "supplier_name": f"{category.replace('_', ' ').title()} Wholesale Co",
                    "unit_price": float(unit_cost * Decimal("0.95")),  # 5% cheaper
                    "lead_time_days": 21,
                    "minimum_order_qty": max(50, quantity),
                    "rating": 4.2,
                    "reliability_score": 85,
                    "total_cost": float(unit_cost * Decimal("0.95") * Decimal(str(quantity))),
                    "pros": ["Lowest price", "High volume capacity"],
                    "cons": ["Longer lead time", "Higher minimum order"],
                }
            )

            # Supplier 2: Balanced option
            suppliers.append(
                {
                    "supplier_id": "SUP-002",
                    "supplier_name": f"Premier {category.replace('_', ' ').title()} Supply",
                    "unit_price": float(unit_cost),  # Standard price
                    "lead_time_days": 14,
                    "minimum_order_qty": max(25, quantity),
                    "rating": 4.6,
                    "reliability_score": 92,
                    "total_cost": float(unit_cost * Decimal(str(quantity))),
                    "pros": ["Reliable delivery", "Flexible ordering"],
                    "cons": ["Mid-range pricing"],
                }
            )

            # Supplier 3: Premium/Fast option
            suppliers.append(
                {
                    "supplier_id": "SUP-003",
                    "supplier_name": f"Express {category.replace('_', ' ').title()} Partners",
                    "unit_price": float(unit_cost * Decimal("1.10")),  # 10% more expensive
                    "lead_time_days": 7,
                    "minimum_order_qty": quantity,
                    "rating": 4.8,
                    "reliability_score": 96,
                    "total_cost": float(unit_cost * Decimal("1.10") * Decimal(str(quantity))),
                    "pros": ["Fast delivery", "No minimum beyond order", "Excellent reliability"],
                    "cons": ["Higher price"],
                }
            )

            # Rank suppliers by composite score (price 40%, reliability 30%, lead time 30%)
            for supplier in suppliers:
                price_score = 1.0 - (
                    (supplier["unit_price"] - float(unit_cost * Decimal("0.95")))
                    / (float(unit_cost * Decimal("0.15")))
                )
                reliability_score = supplier["reliability_score"] / 100
                lead_time_score = 1.0 - ((supplier["lead_time_days"] - 7) / 14)

                supplier["composite_score"] = (
                    price_score * 0.4 + reliability_score * 0.3 + lead_time_score * 0.3
                )

            # Sort by composite score
            suppliers.sort(key=lambda x: x["composite_score"], reverse=True)

            # Add rank
            for idx, supplier in enumerate(suppliers, 1):
                supplier["rank"] = idx

            return ToolOutput(
                success=True,
                data={
                    "product": {
                        "product_id": str(product.id),
                        "sku": product.sku,
                        "name": product.name,
                        "category": category,
                    },
                    "quantity_requested": quantity,
                    "suppliers": suppliers,
                    "recommendation": suppliers[0]["supplier_id"],
                    "note": "Supplier data is illustrative. Verify availability and pricing before ordering.",
                },
            )

        except Exception as e:
            logger.error("Supplier suggestion failed", error=str(e))
            return ToolOutput(success=False, error=str(e), data={})
