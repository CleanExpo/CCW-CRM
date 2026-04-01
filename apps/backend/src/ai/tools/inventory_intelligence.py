"""AI tools for inventory intelligence.

Provides intelligent tools for stock management, availability checking,
and product recommendations across multiple store locations.
"""

from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Product
from src.db.inventory_models import ProductStockByLocation, StockAdjustment

logger = structlog.get_logger(__name__)


class CheckStockAcrossLocations:
    """Tool to check stock availability across all store locations.

    Returns comprehensive stock information including:
    - Stock at each location
    - Total available across all locations
    - Reserved quantities
    - Locations with availability
    """

    name = "check_stock_across_locations"
    description = (
        "Check stock availability for a product across all store locations "
        "(Brisbane, Sydney, Melbourne). Returns detailed stock levels, "
        "reserved quantities, and which locations have stock available."
    )

    def __init__(self):
        """Initialize tool."""
        pass

    async def execute(
        self, product_id: str, db: AsyncSession | None = None, **kwargs
    ) -> dict[str, Any]:
        """Check stock across all locations.

        Args:
            product_id: Product UUID string
            db: Database session

        Returns:
            Dict with stock information by location
        """
        if not db:
            return {
                "success": False,
                "error": "Database session required",
            }

        try:
            product_uuid = UUID(product_id)

            # Get product details
            stmt = select(Product).where(Product.id == product_uuid)
            result = await db.execute(stmt)
            product = result.scalar_one_or_none()

            if not product:
                return {
                    "success": False,
                    "error": f"Product {product_id} not found",
                }

            # Get stock by location
            stmt = select(ProductStockByLocation).where(
                ProductStockByLocation.product_id == product_uuid
            )
            result = await db.execute(stmt)
            stock_records = result.scalars().all()

            locations = {}
            total_stock = 0
            total_reserved = 0
            total_available = 0
            available_locations = []

            for record in stock_records:
                locations[record.location] = {
                    "stock": record.stock,
                    "reserved": record.reserved,
                    "available": record.available,
                }
                total_stock += record.stock
                total_reserved += record.reserved
                total_available += record.available

                if record.available > 0:
                    available_locations.append(record.location)

            return {
                "success": True,
                "product_id": str(product_uuid),
                "product_name": product.name,
                "product_sku": product.sku,
                "total_stock": total_stock,
                "total_reserved": total_reserved,
                "total_available": total_available,
                "locations": locations,
                "available_at": available_locations,
                "in_stock": total_available > 0,
            }

        except ValueError as e:
            return {"success": False, "error": f"Invalid product_id: {str(e)}"}
        except Exception as e:
            logger.error("check_stock_across_locations_error", error=str(e))
            return {"success": False, "error": str(e)}


class SuggestAlternativeProducts:
    """Tool to suggest alternative products when one is out of stock.

    Finds similar products based on:
    - Same category
    - Similar price range (±20%)
    - In stock at any location
    """

    name = "suggest_alternative_products"
    description = (
        "Suggest alternative products when a product is out of stock. "
        "Finds similar products in the same category with similar pricing "
        "that are currently available."
    )

    def __init__(self):
        """Initialize tool."""
        pass

    async def execute(
        self, product_id: str, max_results: int = 5, db: AsyncSession | None = None, **kwargs
    ) -> dict[str, Any]:
        """Find alternative products.

        Args:
            product_id: Product UUID string
            max_results: Maximum number of alternatives to return (default: 5)
            db: Database session

        Returns:
            Dict with list of alternative products
        """
        if not db:
            return {"success": False, "error": "Database session required"}

        try:
            product_uuid = UUID(product_id)

            # Get original product
            stmt = select(Product).where(Product.id == product_uuid)
            result = await db.execute(stmt)
            product = result.scalar_one_or_none()

            if not product:
                return {"success": False, "error": f"Product {product_id} not found"}

            # Calculate price range (±20%)
            price_min = float(product.price) * 0.8
            price_max = float(product.price) * 1.2

            # Find similar products with stock
            stmt = (
                select(Product, func.sum(ProductStockByLocation.stock).label("total_stock"))
                .join(ProductStockByLocation, Product.id == ProductStockByLocation.product_id)
                .where(
                    and_(
                        Product.id != product_uuid,  # Exclude original product
                        Product.category == product.category,  # Same category
                        Product.price >= price_min,
                        Product.price <= price_max,
                        Product.is_active,
                        ProductStockByLocation.stock > 0,  # Has stock
                    )
                )
                .group_by(Product.id)
                .having(func.sum(ProductStockByLocation.stock) > 0)
                .limit(max_results)
            )

            result = await db.execute(stmt)
            alternatives = result.all()

            alternative_list = []
            for alt_product, total_stock in alternatives:
                # Get locations with stock
                loc_stmt = select(ProductStockByLocation).where(
                    and_(
                        ProductStockByLocation.product_id == alt_product.id,
                        ProductStockByLocation.stock > 0,
                    )
                )
                loc_result = await db.execute(loc_stmt)
                locations = [loc.location for loc in loc_result.scalars().all()]

                alternative_list.append(
                    {
                        "product_id": str(alt_product.id),
                        "name": alt_product.name,
                        "sku": alt_product.sku,
                        "price": float(alt_product.price),
                        "price_difference": float(alt_product.price - product.price),
                        "total_stock": int(total_stock),
                        "available_at": locations,
                    }
                )

            return {
                "success": True,
                "original_product": {
                    "product_id": str(product_uuid),
                    "name": product.name,
                    "sku": product.sku,
                    "price": float(product.price),
                    "category": product.category,
                },
                "alternatives": alternative_list,
                "count": len(alternative_list),
            }

        except ValueError as e:
            return {"success": False, "error": f"Invalid product_id: {str(e)}"}
        except Exception as e:
            logger.error("suggest_alternative_products_error", error=str(e))
            return {"success": False, "error": str(e)}


class CalculateBackorderETA:
    """Tool to calculate estimated time of arrival for backordered items.

    Analyzes:
    - Historical restock patterns
    - Average lead time
    - Recent stock adjustments
    """

    name = "calculate_backorder_eta"
    description = (
        "Calculate estimated time of arrival (ETA) for out-of-stock products. "
        "Analyzes historical restock patterns and recent stock adjustments "
        "to provide an estimated date when the product will be available."
    )

    def __init__(self):
        """Initialize tool."""
        pass

    async def execute(
        self, product_id: str, quantity_needed: int = 1, db: AsyncSession | None = None, **kwargs
    ) -> dict[str, Any]:
        """Calculate backorder ETA.

        Args:
            product_id: Product UUID string
            quantity_needed: Quantity customer needs (default: 1)
            db: Database session

        Returns:
            Dict with ETA information
        """
        if not db:
            return {"success": False, "error": "Database session required"}

        try:
            product_uuid = UUID(product_id)

            # Get product
            stmt = select(Product).where(Product.id == product_uuid)
            result = await db.execute(stmt)
            product = result.scalar_one_or_none()

            if not product:
                return {"success": False, "error": f"Product {product_id} not found"}

            # Get recent stock adjustments (last 90 days)
            ninety_days_ago = datetime.now() - timedelta(days=90)
            stmt = (
                select(StockAdjustment)
                .where(
                    and_(
                        StockAdjustment.product_id == product_uuid,
                        StockAdjustment.adjustment_type.in_(["stock_count", "transfer"]),
                        StockAdjustment.quantity_change > 0,  # Positive changes (stock in)
                        StockAdjustment.adjusted_at >= ninety_days_ago,
                    )
                )
                .order_by(StockAdjustment.adjusted_at.desc())
            )

            result = await db.execute(stmt)
            adjustments = result.scalars().all()

            # Calculate average restock interval
            if len(adjustments) >= 2:
                intervals = []
                for i in range(len(adjustments) - 1):
                    delta = adjustments[i].adjusted_at - adjustments[i + 1].adjusted_at
                    intervals.append(delta.days)

                avg_interval_days = sum(intervals) / len(intervals)
                last_restock = adjustments[0].adjusted_at if adjustments else None

                if last_restock:
                    estimated_next_restock = last_restock + timedelta(days=avg_interval_days)
                    days_until_restock = (estimated_next_restock - datetime.now()).days
                else:
                    days_until_restock = int(avg_interval_days)
                    estimated_next_restock = datetime.now() + timedelta(days=days_until_restock)

                confidence = "medium" if len(adjustments) >= 3 else "low"
            else:
                # Default estimate if no historical data
                days_until_restock = 14  # 2 weeks default
                estimated_next_restock = datetime.now() + timedelta(days=days_until_restock)
                confidence = "low"

            return {
                "success": True,
                "product_id": str(product_uuid),
                "product_name": product.name,
                "quantity_needed": quantity_needed,
                "estimated_eta": estimated_next_restock.isoformat(),
                "days_until_available": max(0, days_until_restock),
                "confidence": confidence,
                "historical_restocks": len(adjustments),
                "recommendation": (
                    f"Expected to be back in stock in approximately {max(0, days_until_restock)} days"  # noqa: E501
                    if days_until_restock > 0
                    else "Should be available soon"
                ),
            }

        except ValueError as e:
            return {"success": False, "error": f"Invalid product_id: {str(e)}"}
        except Exception as e:
            logger.error("calculate_backorder_eta_error", error=str(e))
            return {"success": False, "error": str(e)}


class RecommendNearestStore:
    """Tool to recommend the nearest store with stock available.

    For now, returns all stores with stock. In production, this would
    calculate distance based on customer location.
    """

    name = "recommend_nearest_store"
    description = (
        "Recommend the nearest store location that has a product in stock. "
        "Returns stores ranked by availability and proximity."
    )

    def __init__(self):
        """Initialize tool."""
        pass

    async def execute(
        self,
        product_id: str,
        customer_location: str | None = None,
        db: AsyncSession | None = None,
        **kwargs,
    ) -> dict[str, Any]:
        """Recommend nearest store with stock.

        Args:
            product_id: Product UUID string
            customer_location: Optional customer location for distance calculation
            db: Database session

        Returns:
            Dict with store recommendations
        """
        if not db:
            return {"success": False, "error": "Database session required"}

        try:
            product_uuid = UUID(product_id)

            # Get product
            stmt = select(Product).where(Product.id == product_uuid)
            result = await db.execute(stmt)
            product = result.scalar_one_or_none()

            if not product:
                return {"success": False, "error": f"Product {product_id} not found"}

            # Get stock by location (only locations with available stock)
            stmt = (
                select(ProductStockByLocation)
                .where(
                    and_(
                        ProductStockByLocation.product_id == product_uuid,
                        ProductStockByLocation.stock > ProductStockByLocation.reserved,
                    )
                )
                .order_by(ProductStockByLocation.stock.desc())
            )

            result = await db.execute(stmt)
            stock_records = result.scalars().all()

            if not stock_records:
                return {
                    "success": True,
                    "product_id": str(product_uuid),
                    "product_name": product.name,
                    "stores_with_stock": [],
                    "recommendation": "Product is currently out of stock at all locations",
                }

            # Build recommendations
            stores = []
            for record in stock_records:
                stores.append(
                    {
                        "location": record.location,
                        "stock": record.stock,
                        "available": record.available,
                        "reserved": record.reserved,
                    }
                )

            # Simple recommendation (highest stock first)
            recommended_store = stores[0]

            return {
                "success": True,
                "product_id": str(product_uuid),
                "product_name": product.name,
                "stores_with_stock": stores,
                "recommended_store": recommended_store["location"],
                "recommendation": (
                    f"Product available at {recommended_store['location']} "
                    f"({recommended_store['available']} units in stock)"
                ),
            }

        except ValueError as e:
            return {"success": False, "error": f"Invalid product_id: {str(e)}"}
        except Exception as e:
            logger.error("recommend_nearest_store_error", error=str(e))
            return {"success": False, "error": str(e)}


class PredictStockout:
    """Tool to predict when a product will run out of stock.

    Analyzes sales velocity from recent stock adjustments to estimate
    when current stock will be depleted.
    """

    name = "predict_stockout"
    description = (
        "Predict when a product will run out of stock based on recent sales velocity. "
        "Analyzes stock changes over time to estimate days until stockout."
    )

    def __init__(self):
        """Initialize tool."""
        pass

    async def execute(
        self,
        product_id: str,
        location: str | None = None,
        lookback_days: int = 30,
        db: AsyncSession | None = None,
        **kwargs,
    ) -> dict[str, Any]:
        """Predict stockout date.

        Args:
            product_id: Product UUID string
            location: Optional specific location (default: all locations)
            lookback_days: Days to analyze for velocity (default: 30)
            db: Database session

        Returns:
            Dict with stockout prediction
        """
        if not db:
            return {"success": False, "error": "Database session required"}

        try:
            product_uuid = UUID(product_id)

            # Get product
            stmt = select(Product).where(Product.id == product_uuid)
            result = await db.execute(stmt)
            product = result.scalar_one_or_none()

            if not product:
                return {"success": False, "error": f"Product {product_id} not found"}

            # Get current stock
            stock_stmt = select(ProductStockByLocation).where(
                ProductStockByLocation.product_id == product_uuid
            )
            if location:
                stock_stmt = stock_stmt.where(ProductStockByLocation.location == location)

            result = await db.execute(stock_stmt)
            stock_records = result.scalars().all()

            if not stock_records:
                return {
                    "success": True,
                    "product_id": str(product_uuid),
                    "product_name": product.name,
                    "prediction": "No stock data available",
                }

            current_stock = sum(record.available for record in stock_records)

            # Get recent negative adjustments (sales, damages, etc.)
            lookback_date = datetime.now() - timedelta(days=lookback_days)
            adj_stmt = (
                select(StockAdjustment)
                .where(
                    and_(
                        StockAdjustment.product_id == product_uuid,
                        StockAdjustment.quantity_change < 0,  # Negative changes (stock out)
                        StockAdjustment.adjusted_at >= lookback_date,
                    )
                )
                .order_by(StockAdjustment.adjusted_at.desc())
            )

            if location:
                adj_stmt = adj_stmt.where(StockAdjustment.location == location)

            result = await db.execute(adj_stmt)
            adjustments = result.scalars().all()

            if not adjustments:
                return {
                    "success": True,
                    "product_id": str(product_uuid),
                    "product_name": product.name,
                    "current_stock": current_stock,
                    "prediction": "Insufficient data to predict stockout (no recent sales)",
                    "recommendation": "Monitor stock levels",
                }

            # Calculate daily velocity (units sold per day)
            total_sold = abs(sum(adj.quantity_change for adj in adjustments))
            days_analyzed = (datetime.now() - adjustments[-1].adjusted_at).days or 1
            daily_velocity = total_sold / days_analyzed

            if daily_velocity == 0:
                return {
                    "success": True,
                    "product_id": str(product_uuid),
                    "product_name": product.name,
                    "current_stock": current_stock,
                    "prediction": "No sales velocity detected",
                }

            # Calculate days until stockout
            days_until_stockout = int(current_stock / daily_velocity)
            predicted_stockout_date = datetime.now() + timedelta(days=days_until_stockout)

            # Determine urgency
            if days_until_stockout <= 7:
                urgency = "critical"
                action = "Place urgent reorder immediately"
            elif days_until_stockout <= 14:
                urgency = "high"
                action = "Place reorder soon"
            elif days_until_stockout <= 30:
                urgency = "medium"
                action = "Monitor and plan reorder"
            else:
                urgency = "low"
                action = "Stock levels healthy"

            return {
                "success": True,
                "product_id": str(product_uuid),
                "product_name": product.name,
                "current_stock": current_stock,
                "daily_velocity": round(daily_velocity, 2),
                "days_until_stockout": days_until_stockout,
                "predicted_stockout_date": predicted_stockout_date.isoformat(),
                "urgency": urgency,
                "recommendation": action,
                "analysis_period_days": lookback_days,
                "total_sold_in_period": int(total_sold),
            }

        except ValueError as e:
            return {"success": False, "error": f"Invalid product_id: {str(e)}"}
        except Exception as e:
            logger.error("predict_stockout_error", error=str(e))
            return {"success": False, "error": str(e)}


# Tool registry for easy access
INVENTORY_INTELLIGENCE_TOOLS = [
    CheckStockAcrossLocations,
    SuggestAlternativeProducts,
    CalculateBackorderETA,
    RecommendNearestStore,
    PredictStockout,
]
