"""Cin7 Forecasting API endpoints."""
from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.ai.agents.specialized.cin7_forecasting_agent import (
    Cin7ForecastingAgent,
    calculate_sync_velocity,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/ai/cin7-forecast", tags=["Cin7 AI Forecasting"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class Cin7ForecastRequest(BaseModel):
    """Request for Cin7 demand forecast."""

    product_id: str | None = Field(
        default=None,
        description="Optional product ID (if None, forecasts all mapped products)",
    )
    source: str = Field(
        default="core",
        description="Cin7 source: 'core' or 'omni'",
    )
    forecast_days: int = Field(
        default=30, ge=7, le=365, description="Days to forecast ahead"
    )
    include_sync_velocity: bool = Field(
        default=True, description="Include sync velocity metrics"
    )


class SyncVelocityResponse(BaseModel):
    """Sync velocity metrics."""

    syncs_per_day: float = Field(description="Average syncs per day")
    avg_changes: float = Field(description="Average records changed per sync")
    trend: str = Field(description="Trend direction: increasing, decreasing, stable")


class Cin7ForecastResponse(BaseModel):
    """Response from Cin7 demand forecast."""

    forecasts: list[dict] = Field(description="Product forecast list")
    reorder_recommendations: list[dict] = Field(
        default_factory=list, description="Products needing reorder"
    )
    total_products_analyzed: int = Field(description="Total products analyzed")
    confidence: float = Field(ge=0, le=1, description="Overall confidence")
    error: str | None = Field(default=None, description="Error message if any")


# ---------------------------------------------------------------------------
# Singleton agent
# ---------------------------------------------------------------------------

_cin7_forecast_agent: Cin7ForecastingAgent | None = None


def get_cin7_forecast_agent() -> Cin7ForecastingAgent:
    """Get or create Cin7 forecast agent singleton."""
    global _cin7_forecast_agent
    if _cin7_forecast_agent is None:
        _cin7_forecast_agent = Cin7ForecastingAgent()
        logger.info("Cin7 forecast agent initialized for API")
    return _cin7_forecast_agent


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=Cin7ForecastResponse)
async def forecast_cin7_demand(
    request: Cin7ForecastRequest,
) -> Cin7ForecastResponse:
    """Generate AI-powered demand forecasts for Cin7-synced products.

    Uses sync history from Cin7ProductMapping and Cin7SyncLog to predict
    demand trends, calculate reorder points, and identify urgency levels.
    """
    logger.info(
        "cin7_forecast_requested",
        product_id=request.product_id,
        source=request.source,
        forecast_days=request.forecast_days,
    )

    try:
        agent = get_cin7_forecast_agent()
        result = await agent.execute(
            task=f"Forecast Cin7 demand for {'product' if request.product_id else 'all products'}",
            context={
                "product_id": request.product_id,
                "source": request.source,
                "forecast_days": request.forecast_days,
                "include_sync_velocity": request.include_sync_velocity,
            },
        )

        if result.get("error"):
            error_msg = result["error"]
            if "not found" in error_msg.lower():
                raise HTTPException(status_code=404, detail=error_msg)
            raise HTTPException(status_code=500, detail=error_msg)

        return Cin7ForecastResponse(
            forecasts=result.get("forecasts", []),
            reorder_recommendations=result.get("reorder_recommendations", []),
            total_products_analyzed=result.get("total_products_analyzed", 0),
            confidence=result.get("confidence", 0.0),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("cin7_forecast_failed", error=str(e))
        raise HTTPException(
            status_code=500, detail=f"Cin7 forecast failed: {e}"
        ) from e


@router.get("/velocity", response_model=SyncVelocityResponse)
async def get_cin7_sync_velocity(
    source: str = Query("core", description="Cin7 source: core or omni"),
) -> SyncVelocityResponse:
    """Get current sync velocity metrics for Cin7.

    Returns the rate of sync operations and average records changed per sync.
    """
    try:
        agent = get_cin7_forecast_agent()
        result = await agent.execute(
            task="Get sync velocity",
            context={"source": source, "velocity_only": True},
        )

        velocity = result.get("velocity", result)
        return SyncVelocityResponse(
            syncs_per_day=velocity.get("syncs_per_day", 0.0),
            avg_changes=velocity.get("avg_changes", 0.0),
            trend=velocity.get("trend", "stable"),
        )

    except Exception as e:
        logger.error("cin7_velocity_failed", error=str(e))
        raise HTTPException(
            status_code=500, detail=f"Velocity check failed: {e}"
        ) from e


@router.get("/health")
async def get_cin7_forecast_health() -> dict:
    """Check Cin7 forecasting agent health."""
    agent = get_cin7_forecast_agent()
    report = await agent.health_check()
    return {
        "agent_id": report.agent_id,
        "status": report.status.value if hasattr(report.status, "value") else str(report.status),
        "checks_passed": report.checks_passed,
        "checks_failed": report.checks_failed,
        "response_time_ms": report.response_time_ms,
    }
