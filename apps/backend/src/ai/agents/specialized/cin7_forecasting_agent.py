"""Cin7 Forecasting Agent.

AI-powered demand prediction for Cin7-synced products using
sync history, velocity analysis, and seasonal pattern detection.
"""

import math
import statistics
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.base_agent import BaseAgent

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Pure functions — testable without DB or async
# ---------------------------------------------------------------------------


def calculate_sync_velocity(
    sync_logs: list[dict[str, Any]],
) -> dict[str, Any]:
    """Calculate sync velocity from a list of sync log entries.

    Each log entry should have at least ``synced_at`` (ISO string or datetime)
    and ``records_processed`` (int).

    Returns:
        Dict with ``syncs_per_day``, ``avg_changes``, ``trend``
        (``increasing``, ``decreasing``, ``stable``).
    """
    if not sync_logs:
        return {"syncs_per_day": 0.0, "avg_changes": 0.0, "trend": "stable"}

    if len(sync_logs) == 1:
        return {
            "syncs_per_day": 1.0,
            "avg_changes": float(sync_logs[0].get("records_processed", 0)),
            "trend": "stable",
        }

    # Parse timestamps
    timestamps: list[datetime] = []
    changes: list[float] = []
    for log in sync_logs:
        ts = log.get("synced_at")
        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except ValueError:
                continue
        if isinstance(ts, datetime):
            timestamps.append(ts)
            changes.append(float(log.get("records_processed", 0)))

    if len(timestamps) < 2:
        avg_c = changes[0] if changes else 0.0
        return {"syncs_per_day": 1.0, "avg_changes": avg_c, "trend": "stable"}

    # Sort by time
    paired = sorted(zip(timestamps, changes), key=lambda p: p[0])
    timestamps = [p[0] for p in paired]
    changes = [p[1] for p in paired]

    # Time span in days
    span_seconds = (timestamps[-1] - timestamps[0]).total_seconds()
    span_days = max(span_seconds / 86400, 0.01)

    syncs_per_day = len(timestamps) / span_days
    avg_changes = statistics.mean(changes) if changes else 0.0

    # Trend — compare first half average to second half average
    mid = len(changes) // 2
    first_half = statistics.mean(changes[:mid]) if mid > 0 else 0.0
    second_half = statistics.mean(changes[mid:]) if mid < len(changes) else 0.0

    if second_half > first_half * 1.2:
        trend = "increasing"
    elif second_half < first_half * 0.8:
        trend = "decreasing"
    else:
        trend = "stable"

    return {
        "syncs_per_day": round(syncs_per_day, 2),
        "avg_changes": round(avg_changes, 2),
        "trend": trend,
    }


def estimate_cin7_reorder_point(
    daily_velocity: float,
    lead_time_days: int = 14,
    safety_factor: float = 1.5,
) -> int:
    """Estimate reorder point based on sync velocity.

    Formula: ``(daily_velocity * lead_time * safety_factor)``

    Returns:
        Integer reorder point (rounded up).
    """
    if daily_velocity <= 0:
        return 0
    return math.ceil(daily_velocity * lead_time_days * safety_factor)


def detect_sync_seasonality(
    monthly_counts: dict[str, float],
) -> dict[str, Any]:
    """Detect seasonal patterns in monthly sync/change data.

    Args:
        monthly_counts: Mapping of month name → average changes.
            E.g. ``{"January": 12.5, "February": 8.0, ...}``

    Returns:
        Dict with ``pattern_detected``, ``peak_months``, ``trough_months``.
    """
    if not monthly_counts or len(monthly_counts) < 3:
        return {"pattern_detected": False, "peak_months": [], "trough_months": []}

    values = list(monthly_counts.values())
    avg = statistics.mean(values)
    if avg == 0:
        return {"pattern_detected": False, "peak_months": [], "trough_months": []}

    peak_months = [m for m, v in monthly_counts.items() if v > avg * 1.3]
    trough_months = [m for m, v in monthly_counts.items() if v < avg * 0.7]

    pattern_detected = len(peak_months) >= 1 and len(trough_months) >= 1

    return {
        "pattern_detected": pattern_detected,
        "peak_months": peak_months,
        "trough_months": trough_months,
    }


def build_cin7_forecast(
    product_data: dict[str, Any],
    velocity: dict[str, Any],
    seasonality: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a standardized Cin7 forecast dict.

    Args:
        product_data: Must have ``product_id``, ``product_name``, ``sku``,
            ``current_stock``.
        velocity: Output from ``calculate_sync_velocity``.
        seasonality: Output from ``detect_sync_seasonality`` (optional).

    Returns:
        Standardized forecast dict.
    """
    current_stock = product_data.get("current_stock", 0)
    avg_daily = velocity.get("avg_changes", 0.0)

    # Days until depletion
    if avg_daily > 0 and current_stock > 0:
        days_until_depletion = int(current_stock / avg_daily)
        depletion_date = (
            datetime.now(UTC) + timedelta(days=days_until_depletion)
        ).isoformat()
    else:
        days_until_depletion = None
        depletion_date = None

    reorder_point = estimate_cin7_reorder_point(avg_daily)
    needs_reorder = current_stock <= reorder_point and reorder_point > 0

    # Urgency
    if days_until_depletion is not None:
        if days_until_depletion < 7:
            urgency = "critical"
        elif days_until_depletion < 14:
            urgency = "high"
        elif days_until_depletion < 30:
            urgency = "medium"
        else:
            urgency = "low"
    else:
        urgency = "low"

    # Confidence based on velocity data quality
    syncs_per_day = velocity.get("syncs_per_day", 0)
    if syncs_per_day >= 1.0:
        confidence = 0.85
    elif syncs_per_day >= 0.5:
        confidence = 0.65
    elif syncs_per_day > 0:
        confidence = 0.45
    else:
        confidence = 0.2

    return {
        "product_id": product_data.get("product_id", "unknown"),
        "product_name": product_data.get("product_name", ""),
        "sku": product_data.get("sku", ""),
        "current_stock": current_stock,
        "velocity": velocity,
        "forecast": {
            "days_until_depletion": days_until_depletion,
            "depletion_date": depletion_date,
            "reorder_point": reorder_point,
        },
        "recommendation": {
            "needs_reorder": needs_reorder,
            "urgency": urgency,
        },
        "seasonal_pattern": seasonality,
        "confidence": confidence,
        "trend": velocity.get("trend", "stable"),
        "generated_at": datetime.now(UTC).isoformat(),
    }


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class Cin7ForecastingAgent(BaseAgent):
    """Forecasts demand for Cin7-synced products.

    Uses sync history from Cin7ProductMapping and Cin7SyncLog to predict
    demand trends, calculate reorder points, and detect seasonal patterns.
    """

    def __init__(self) -> None:
        super().__init__(name="Cin7ForecastingAgent", auto_register=True)
        self.capabilities = [
            "cin7_forecasting",
            "sync_demand_prediction",
            "cin7_reorder_recommendations",
        ]
        self.description = "AI-powered demand forecasting for Cin7-synced products"
        self.requires_verification = False
        self.estimated_execution_time = 5

        # Protocol v1.0: Agent Card
        self._protocol_card = self._build_agent_card()
        self._register_protocol_card()

    @staticmethod
    def _build_agent_card() -> Any:
        """Build protocol AgentCard for this agent."""
        try:
            from src.ai.protocol.models import AgentCard, PermissionTier

            return AgentCard(
                agent_id="cin7_forecasting_agent",
                name="Cin7 Forecasting Agent",
                version="1.0.0",
                description="AI-powered demand forecasting for Cin7-synced products",
                capabilities=[
                    "cin7_forecasting",
                    "sync_demand_prediction",
                    "cin7_reorder_recommendations",
                ],
                boundaries=[
                    "Read-only: cannot modify product data",
                    "Cannot place orders or trigger syncs",
                    "Forecasts are advisory only",
                ],
                inputs={
                    "product_id": "Optional specific product UUID",
                    "forecast_days": "Days to forecast (default 30)",
                    "source": "Cin7 source: core or omni",
                },
                outputs={
                    "forecast": "Demand forecast with daily predictions",
                    "velocity": "Sync velocity metrics",
                    "seasonality": "Seasonal pattern analysis",
                    "reorder_point": "Recommended reorder point",
                },
                permission_tier=PermissionTier.READ_ONLY,
                max_concurrent=10,
                timeout_seconds=30,
            )
        except ImportError:
            return None

    def _register_protocol_card(self) -> None:
        """Register protocol card with agent registry."""
        if not hasattr(self, "_protocol_card") or self._protocol_card is None:
            return
        try:
            from src.ai.orchestration import get_agent_registry

            registry = get_agent_registry()
            registry.register_agent_card(self.agent_id, self._protocol_card)
        except Exception as e:
            logger.debug("Could not register protocol card", error=str(e))

    async def execute(
        self, task: str, context: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Generate forecasts for Cin7-synced products.

        Context keys:
            source: "core" or "omni" (default "core")
            product_id: Optional specific product ID
            forecast_days: Days to forecast (default 30)
            include_sync_velocity: Include velocity metrics (default True)
        """
        self._log_execution_start(task, context)
        ctx = context or {}

        try:
            async with self.get_db_session() as db:
                product_id = ctx.get("product_id")
                if product_id:
                    result = await self._forecast_cin7_product(db, ctx)
                else:
                    result = await self._forecast_all_cin7_products(db, ctx)

            self._log_execution_complete(True)
            return result

        except Exception as e:
            logger.error("cin7_forecast_failed", error=str(e))
            self._log_execution_complete(False, str(e))
            return {"error": str(e)}

    async def stream(self, task: str, context: dict[str, Any] | None = None):
        """Not implemented for this agent."""
        yield "Cin7 forecasting does not support streaming"

    async def _forecast_cin7_product(
        self, db: AsyncSession, context: dict[str, Any]
    ) -> dict[str, Any]:
        """Forecast a single Cin7-synced product."""
        from src.db.cin7_models import Cin7ProductMapping, Cin7SyncLog

        product_id = context.get("product_id")

        # Look up mapping
        mapping_q = select(Cin7ProductMapping).where(
            Cin7ProductMapping.erp_product_id == product_id
        )
        mapping_result = await db.execute(mapping_q)
        mapping = mapping_result.scalar_one_or_none()

        if not mapping:
            return {"error": f"No Cin7 mapping found for product {product_id}"}

        # Get sync logs for this entity type
        logs_q = (
            select(Cin7SyncLog)
            .where(Cin7SyncLog.entity_type == "product")
            .order_by(Cin7SyncLog.synced_at.desc())
            .limit(50)
        )
        logs_result = await db.execute(logs_q)
        logs = logs_result.scalars().all()

        sync_log_data = [
            {
                "synced_at": log.synced_at.isoformat() if log.synced_at else None,
                "records_processed": log.records_processed or 0,
            }
            for log in logs
        ]

        velocity = calculate_sync_velocity(sync_log_data)
        seasonality = None  # Would need 6+ months of data

        product_data = {
            "product_id": product_id,
            "product_name": mapping.erp_product_name or "",
            "sku": mapping.cin7_sku or "",
            "current_stock": 0,  # Would need product lookup
        }

        forecast = build_cin7_forecast(product_data, velocity, seasonality)

        return {
            "forecasts": [forecast],
            "total_products_analyzed": 1,
            "confidence": forecast["confidence"],
        }

    async def _forecast_all_cin7_products(
        self, db: AsyncSession, context: dict[str, Any]
    ) -> dict[str, Any]:
        """Forecast all Cin7-synced products."""
        from src.db.cin7_models import Cin7ProductMapping, Cin7SyncLog

        # Get all product mappings
        mappings_q = select(Cin7ProductMapping).limit(100)
        mappings_result = await db.execute(mappings_q)
        mappings = mappings_result.scalars().all()

        if not mappings:
            return {
                "forecasts": [],
                "total_products_analyzed": 0,
                "confidence": 0.0,
                "message": "No Cin7 product mappings found",
            }

        # Get recent sync logs
        logs_q = (
            select(Cin7SyncLog)
            .where(Cin7SyncLog.entity_type == "product")
            .order_by(Cin7SyncLog.synced_at.desc())
            .limit(50)
        )
        logs_result = await db.execute(logs_q)
        logs = logs_result.scalars().all()

        sync_log_data = [
            {
                "synced_at": log.synced_at.isoformat() if log.synced_at else None,
                "records_processed": log.records_processed or 0,
            }
            for log in logs
        ]

        velocity = calculate_sync_velocity(sync_log_data)

        forecasts = []
        for mapping in mappings:
            product_data = {
                "product_id": str(mapping.erp_product_id) if mapping.erp_product_id else "unknown",
                "product_name": mapping.erp_product_name or "",
                "sku": mapping.cin7_sku or "",
                "current_stock": 0,
            }
            forecast = build_cin7_forecast(product_data, velocity, None)
            forecasts.append(forecast)

        avg_confidence = (
            statistics.mean(f["confidence"] for f in forecasts)
            if forecasts
            else 0.0
        )

        return {
            "forecasts": forecasts,
            "reorder_recommendations": [
                f for f in forecasts if f["recommendation"]["needs_reorder"]
            ],
            "total_products_analyzed": len(forecasts),
            "confidence": round(avg_confidence, 2),
        }
