"""Inventory Forecasting API endpoints."""
from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.ai.agents.specialized import InventoryForecastingAgent

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/inventory-forecast", tags=["AI Inventory Forecasting"])


# Request Models
class InventoryForecastRequest(BaseModel):
    """Request for inventory forecast."""

    product_id: str | None = Field(
        default=None,
        description="Optional product ID (if None, forecasts all products)"
    )
    forecast_days: int = Field(
        default=30,
        ge=7,
        le=365,
        description="Days to forecast ahead (7-365)"
    )
    include_seasonal: bool = Field(
        default=True,
        description="Include seasonal pattern analysis"
    )


# Response Models
class SalesVelocity(BaseModel):
    """Sales velocity metrics."""

    avg_daily_sales: float = Field(description="Average daily sales rate")
    total_sold: int = Field(description="Total units sold in lookback period")
    order_count: int = Field(description="Number of orders")
    days_of_data: int = Field(description="Days of historical data")


class ForecastData(BaseModel):
    """Forecast predictions."""

    days_until_depletion: int | None = Field(description="Days until stock depletes")
    depletion_date: str | None = Field(description="ISO date when stock depletes")
    reorder_point: int = Field(description="Stock level to trigger reorder")
    safety_stock: int = Field(description="Safety stock buffer")


class RecommendationData(BaseModel):
    """Reorder recommendation."""

    needs_reorder: bool = Field(description="Whether reorder is needed")
    urgency: str = Field(description="critical, high, medium, or low")
    recommended_order_qty: int = Field(description="Recommended order quantity")
    estimated_cost: float | None = Field(description="Estimated cost of order")


class SeasonalPattern(BaseModel):
    """Seasonal sales pattern."""

    pattern_detected: bool = Field(description="Whether pattern found")
    peak_months: list[str] = Field(default_factory=list, description="High-demand months")
    trough_months: list[str] = Field(default_factory=list, description="Low-demand months")
    avg_monthly_sales: float = Field(description="Average monthly sales")


class ProductForecast(BaseModel):
    """Individual product forecast."""

    product_id: str
    product_name: str
    sku: str
    current_stock: int
    sales_velocity: SalesVelocity
    forecast: ForecastData
    recommendation: RecommendationData
    seasonal_pattern: SeasonalPattern | None
    confidence: float = Field(ge=0, le=1, description="Forecast confidence (0-1)")


class InventoryForecastResponse(BaseModel):
    """Response from inventory forecast."""

    forecasts: list[ProductForecast] = Field(
        description="List of product forecasts"
    )
    reorder_recommendations: list[ProductForecast] = Field(
        description="Products needing reorder"
    )
    total_products_analyzed: int = Field(
        description="Total number of products analyzed"
    )
    confidence: float = Field(
        ge=0,
        le=1,
        description="Overall forecast confidence"
    )
    error: str | None = Field(
        default=None,
        description="Error message if forecasting failed"
    )


# Singleton agent instance
_forecast_agent: InventoryForecastingAgent | None = None


def get_forecast_agent() -> InventoryForecastingAgent:
    """Get or create inventory forecast agent singleton."""
    global _forecast_agent
    if _forecast_agent is None:
        _forecast_agent = InventoryForecastingAgent()
        logger.info("Inventory forecast agent initialized for API")
    return _forecast_agent


@router.post("", response_model=InventoryForecastResponse)
async def forecast_inventory(
    request: InventoryForecastRequest,
) -> InventoryForecastResponse:
    """
    Generate AI-powered inventory forecasts and reorder recommendations.

    Uses historical sales data to predict:
    - **Stock depletion dates**: When products will run out
    - **Reorder points**: Optimal time to reorder
    - **Safety stock levels**: Buffer stock to prevent stockouts
    - **Seasonal patterns**: Monthly demand variations
    - **Order quantities**: Recommended reorder amounts

    ## Single Product Forecast

    **Request:**
    ```json
    {
      "product_id": "550e8400-e29b-41d4-a716-446655440000",
      "forecast_days": 30,
      "include_seasonal": true
    }
    ```

    **Response:**
    ```json
    {
      "forecasts": [
        {
          "product_id": "550e8400-e29b-41d4-a716-446655440000",
          "product_name": "Industrial Drill",
          "sku": "SKU-001",
          "current_stock": 50,
          "sales_velocity": {
            "avg_daily_sales": 2.5,
            "total_sold": 225,
            "order_count": 45,
            "days_of_data": 90
          },
          "forecast": {
            "days_until_depletion": 20,
            "depletion_date": "2024-02-23T00:00:00",
            "reorder_point": 60,
            "safety_stock": 18
          },
          "recommendation": {
            "needs_reorder": true,
            "urgency": "high",
            "recommended_order_qty": 70,
            "estimated_cost": 3500.00
          },
          "seasonal_pattern": {
            "pattern_detected": true,
            "peak_months": ["March", "April", "September"],
            "trough_months": ["December", "January"],
            "avg_monthly_sales": 75.0
          },
          "confidence": 0.85
        }
      ],
      "reorder_recommendations": [
        // Same as above (needs_reorder = true)
      ],
      "total_products_analyzed": 1,
      "confidence": 0.85
    }
    ```

    ## All Products Forecast

    **Request:**
    ```json
    {
      "product_id": null,
      "forecast_days": 60,
      "include_seasonal": false
    }
    ```

    **Response:**
    ```json
    {
      "forecasts": [
        // Array of all product forecasts
      ],
      "reorder_recommendations": [
        // Only products with needs_reorder = true
      ],
      "total_products_analyzed": 147,
      "confidence": 0.72
    }
    ```

    ## Forecasting Algorithm

    1. **Sales Velocity**: Calculate average daily sales from last 90 days of confirmed orders
    2. **Stock Depletion**: `current_stock / avg_daily_sales = days_until_depletion`
    3. **Reorder Point**: `(avg_daily_sales × lead_time) + safety_stock`
    4. **Safety Stock**: `avg_daily_sales × lead_time × (safety_factor - 1)` (default safety_factor = 1.5)
    5. **Order Quantity**: `avg_daily_sales × lead_time × 2` (simplified EOQ)
    6. **Seasonal Patterns**: Group sales by month, identify peaks (>130% of average) and troughs (<70% of average)

    ## Confidence Scoring

    - **High (0.8-1.0)**: 30+ orders, 90 days of data
    - **Medium (0.5-0.8)**: 10-30 orders, 30-90 days of data
    - **Low (0.3-0.5)**: 3-10 orders, <30 days of data
    - **Very Low (<0.3)**: <3 orders (insufficient data)

    ## Urgency Levels

    - **Critical**: <7 days until stockout (reorder immediately)
    - **High**: 7-14 days until stockout (reorder soon)
    - **Medium**: 14-30 days until stockout (plan reorder)
    - **Low**: >30 days until stockout (monitor)

    ## Notes

    - Default lead time: 14 days
    - Default safety stock factor: 1.5 (50% buffer)
    - Lookback period: 90 days
    - Only includes confirmed/processing/shipped/delivered orders
    - Seasonal analysis requires 6+ months of data
    - Confidence based on order count and data recency

    ## Error Handling

    - Returns `error` field if forecasting fails
    - Skips products with insufficient data (continues with others)
    - Returns empty forecasts if no products found
    """
    logger.info(
        "Inventory forecast requested",
        product_id=request.product_id,
        forecast_days=request.forecast_days,
        include_seasonal=request.include_seasonal,
    )

    try:
        # Build context
        context = {
            "product_id": request.product_id,
            "forecast_days": request.forecast_days,
            "include_seasonal": request.include_seasonal,
        }

        # Execute agent
        agent = get_forecast_agent()
        result = await agent.execute(
            task=f"Forecast inventory for {'product' if request.product_id else 'all products'}",
            context=context
        )

        # Check for errors
        if result.get("error"):
            error_msg = result["error"]
            if "not found" in error_msg.lower():
                raise HTTPException(status_code=404, detail=error_msg)
            raise HTTPException(status_code=500, detail=error_msg)

        logger.info(
            "Inventory forecast completed",
            total_products=result.get("total_products_analyzed"),
            reorder_count=len(result.get("reorder_recommendations", [])),
            confidence=result.get("confidence"),
        )

        return InventoryForecastResponse(
            forecasts=result.get("forecasts", []),
            reorder_recommendations=result.get("reorder_recommendations", []),
            total_products_analyzed=result.get("total_products_analyzed", 0),
            confidence=result.get("confidence", 0.0),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Inventory forecast failed",
            product_id=request.product_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Inventory forecast failed: {str(e)}",
        ) from e


@router.get("/low-stock", response_model=InventoryForecastResponse)
async def forecast_low_stock_products(
    threshold_days: int = Query(30, ge=1, le=90, description="Days until stockout threshold"),
    forecast_days: int = Query(30, ge=7, le=365, description="Days to forecast ahead"),
) -> InventoryForecastResponse:
    """
    Forecast only low-stock products (those approaching stockout).

    Returns products with `days_until_depletion <= threshold_days`.

    **Example:**
    ```
    GET /api/ai/inventory-forecast/low-stock?threshold_days=14&forecast_days=60
    ```

    Returns products that will run out within 14 days, with 60-day forecasts.
    """
    logger.info("Low-stock forecast requested", threshold_days=threshold_days)

    try:
        # Forecast all products
        context = {
            "product_id": None,
            "forecast_days": forecast_days,
            "include_seasonal": False,  # Skip seasonal for performance
        }

        agent = get_forecast_agent()
        result = await agent.execute(
            task="Forecast low-stock products",
            context=context
        )

        # Filter to low-stock products
        all_forecasts = result.get("forecasts", [])
        low_stock_forecasts = [
            f for f in all_forecasts
            if f.get("forecast", {}).get("days_until_depletion") is not None
            and f["forecast"]["days_until_depletion"] <= threshold_days
        ]

        logger.info(
            "Low-stock forecast completed",
            total_products=len(all_forecasts),
            low_stock_count=len(low_stock_forecasts),
        )

        return InventoryForecastResponse(
            forecasts=low_stock_forecasts,
            reorder_recommendations=[f for f in low_stock_forecasts if f.get("recommendation", {}).get("needs_reorder")],
            total_products_analyzed=len(low_stock_forecasts),
            confidence=result.get("confidence", 0.0),
        )

    except Exception as e:
        logger.error("Low-stock forecast failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Low-stock forecast failed: {str(e)}",
        ) from e
