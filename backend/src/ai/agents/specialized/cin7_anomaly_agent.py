"""Cin7 Anomaly Detection Agent.

Detects anomalies in Cin7 sync data — sync frequency spikes, price drift
between ERP and Cin7, stock mismatches, and mapping coverage gaps.
"""

import statistics
from datetime import datetime
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.base_agent import BaseAgent

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Pure functions — testable without DB or async
# ---------------------------------------------------------------------------


def detect_sync_frequency_anomaly(
    sync_times: list[datetime],
    expected_interval_seconds: int = 300,
) -> dict[str, Any]:
    """Detect anomalies in sync frequency.

    Checks for:
    - Gaps: interval > 3x expected → potential polling failure
    - Spikes: interval < 0.3x expected → unexpected rapid syncs

    Args:
        sync_times: List of sync timestamps (must have 2+ entries).
        expected_interval_seconds: Expected interval between syncs.

    Returns:
        Dict with ``is_anomaly``, ``severity``, ``description``,
        ``avg_interval_seconds``, ``gap_count``, ``spike_count``.
    """
    if len(sync_times) < 2:
        return {
            "is_anomaly": False,
            "severity": "low",
            "description": "Insufficient sync data for frequency analysis",
            "avg_interval_seconds": 0,
            "gap_count": 0,
            "spike_count": 0,
        }

    sorted_times = sorted(sync_times)
    intervals = [
        (sorted_times[i + 1] - sorted_times[i]).total_seconds()
        for i in range(len(sorted_times) - 1)
    ]

    avg_interval = statistics.mean(intervals)
    gap_threshold = expected_interval_seconds * 3
    spike_threshold = expected_interval_seconds * 0.3

    gap_count = sum(1 for i in intervals if i > gap_threshold)
    spike_count = sum(1 for i in intervals if i < spike_threshold)

    is_anomaly = gap_count > 0 or spike_count > 0

    if gap_count >= 3:
        severity = "high"
        description = f"Frequent sync gaps detected: {gap_count} intervals exceeded {gap_threshold}s"
    elif gap_count >= 1:
        severity = "medium"
        description = f"Sync gap detected: {gap_count} interval(s) exceeded {gap_threshold}s"
    elif spike_count >= 3:
        severity = "medium"
        description = f"Rapid sync spikes detected: {spike_count} intervals under {spike_threshold}s"
    elif spike_count >= 1:
        severity = "low"
        description = f"Minor sync spike: {spike_count} interval(s) under {spike_threshold}s"
    else:
        severity = "low"
        description = f"Sync frequency normal (avg {avg_interval:.0f}s)"

    return {
        "is_anomaly": is_anomaly,
        "severity": severity,
        "description": description,
        "avg_interval_seconds": round(avg_interval, 1),
        "gap_count": gap_count,
        "spike_count": spike_count,
    }


def detect_price_drift(
    erp_price: float,
    cin7_price: float,
    threshold_pct: float = 5.0,
) -> dict[str, Any]:
    """Detect price drift between ERP and Cin7.

    Args:
        erp_price: Price in ERP system.
        cin7_price: Price in Cin7.
        threshold_pct: Percentage drift threshold (default 5%).

    Returns:
        Dict with ``is_anomaly``, ``drift_pct``, ``direction``, ``severity``.
    """
    if erp_price == 0 and cin7_price == 0:
        return {
            "is_anomaly": False,
            "drift_pct": 0.0,
            "direction": "none",
            "severity": "low",
        }

    if erp_price == 0:
        return {
            "is_anomaly": True,
            "drift_pct": 100.0,
            "direction": "cin7_only",
            "severity": "high",
        }

    drift_pct = abs(cin7_price - erp_price) / erp_price * 100

    if cin7_price > erp_price:
        direction = "cin7_higher"
    elif cin7_price < erp_price:
        direction = "cin7_lower"
    else:
        direction = "none"

    is_anomaly = drift_pct > threshold_pct

    if drift_pct > threshold_pct * 5:
        severity = "critical"
    elif drift_pct > threshold_pct * 2:
        severity = "high"
    elif drift_pct > threshold_pct:
        severity = "medium"
    else:
        severity = "low"

    return {
        "is_anomaly": is_anomaly,
        "drift_pct": round(drift_pct, 2),
        "direction": direction,
        "severity": severity,
    }


def detect_stock_mismatch(
    erp_stock: int,
    cin7_stock: int,
    tolerance: int = 5,
) -> dict[str, Any]:
    """Detect stock level mismatch between ERP and Cin7.

    Args:
        erp_stock: Stock count in ERP.
        cin7_stock: Stock count in Cin7.
        tolerance: Acceptable difference (default 5 units).

    Returns:
        Dict with ``is_anomaly``, ``difference``, ``severity``.
    """
    difference = abs(erp_stock - cin7_stock)
    is_anomaly = difference > tolerance

    if difference > tolerance * 10:
        severity = "critical"
    elif difference > tolerance * 3:
        severity = "high"
    elif difference > tolerance:
        severity = "medium"
    else:
        severity = "low"

    return {
        "is_anomaly": is_anomaly,
        "difference": difference,
        "erp_stock": erp_stock,
        "cin7_stock": cin7_stock,
        "severity": severity,
    }


def calculate_sync_health_score(
    success_count: int,
    failure_count: int,
    avg_duration_ms: float,
) -> dict[str, Any]:
    """Calculate overall sync health score (0-100).

    Scoring:
    - Success rate: 60% weight (100 if 100%, 0 if <50%)
    - Duration: 20% weight (100 if <1000ms, 0 if >10000ms)
    - Volume: 20% weight (100 if 10+ syncs, 0 if 0)

    Returns:
        Dict with ``score``, ``grade``, ``details``.
    """
    total = success_count + failure_count

    # Success rate component (60% weight)
    if total > 0:
        success_rate = success_count / total
        success_score = max(0, min(100, (success_rate - 0.5) * 200))
    else:
        success_rate = 0.0
        success_score = 0

    # Duration component (20% weight)
    if avg_duration_ms <= 1000:
        duration_score = 100
    elif avg_duration_ms >= 10000:
        duration_score = 0
    else:
        duration_score = max(0, 100 - ((avg_duration_ms - 1000) / 90))

    # Volume component (20% weight)
    if total >= 10:
        volume_score = 100
    else:
        volume_score = total * 10

    score = round(
        success_score * 0.6 + duration_score * 0.2 + volume_score * 0.2
    )
    score = max(0, min(100, score))

    if score >= 90:
        grade = "A"
    elif score >= 75:
        grade = "B"
    elif score >= 60:
        grade = "C"
    elif score >= 40:
        grade = "D"
    else:
        grade = "F"

    return {
        "score": score,
        "grade": grade,
        "details": {
            "success_rate": round(success_rate * 100, 1) if total > 0 else 0,
            "success_score": round(success_score, 1),
            "duration_score": round(duration_score, 1),
            "volume_score": round(volume_score, 1),
            "total_syncs": total,
            "avg_duration_ms": round(avg_duration_ms, 1),
        },
    }


def detect_mapping_gaps(
    total_products: int,
    mapped_products: int,
) -> dict[str, Any]:
    """Detect gaps in product mapping coverage.

    Args:
        total_products: Total products in ERP.
        mapped_products: Products mapped to Cin7.

    Returns:
        Dict with ``coverage_pct``, ``unmapped_count``, ``severity``.
    """
    if total_products == 0:
        return {
            "coverage_pct": 0.0,
            "unmapped_count": 0,
            "severity": "low",
            "is_anomaly": False,
        }

    coverage_pct = (mapped_products / total_products) * 100
    unmapped_count = total_products - mapped_products

    if coverage_pct >= 90:
        severity = "low"
    elif coverage_pct >= 70:
        severity = "medium"
    elif coverage_pct >= 50:
        severity = "high"
    else:
        severity = "critical"

    is_anomaly = coverage_pct < 70

    return {
        "coverage_pct": round(coverage_pct, 1),
        "unmapped_count": unmapped_count,
        "severity": severity,
        "is_anomaly": is_anomaly,
    }


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class Cin7AnomalyAgent(BaseAgent):
    """Detects anomalies in Cin7 sync data.

    Uses statistical analysis to identify sync frequency spikes, price
    drift, stock mismatches, and mapping coverage gaps.
    """

    def __init__(self) -> None:
        super().__init__(name="Cin7AnomalyAgent", auto_register=True)
        self.capabilities = [
            "cin7_anomaly_detection",
            "sync_failure_detection",
            "cin7_data_quality",
        ]
        self.description = "Detects anomalies in Cin7 sync data and data quality"
        self.requires_verification = False
        self.estimated_execution_time = 3

    async def execute(
        self, task: str, context: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Run anomaly detection on Cin7 sync data.

        Context keys:
            detection_type: "sync_anomalies", "data_quality", "mapping_coverage", "all"
            source: "core" or "omni"
        """
        self._log_execution_start(task, context)
        ctx = context or {}

        detection_type = ctx.get("detection_type", "all")

        try:
            async with self.get_db_session() as db:
                results: dict[str, Any] = {}

                if detection_type in ("sync_anomalies", "all"):
                    results["sync_anomalies"] = await self._check_sync_anomalies(
                        db, ctx
                    )
                if detection_type in ("data_quality", "all"):
                    results["data_quality"] = await self._check_data_quality(db, ctx)
                if detection_type in ("mapping_coverage", "all"):
                    results["mapping_coverage"] = await self._check_mapping_coverage(
                        db, ctx
                    )

                # Overall anomaly flag
                any_anomaly = any(
                    r.get("is_anomaly", False)
                    for r in results.values()
                    if isinstance(r, dict)
                )
                results["has_anomalies"] = any_anomaly

            self._log_execution_complete(True)
            return results

        except Exception as e:
            logger.error("cin7_anomaly_detection_failed", error=str(e))
            self._log_execution_complete(False, str(e))
            return {"error": str(e)}

    async def stream(self, task: str, context: dict[str, Any] | None = None):
        """Not implemented for this agent."""
        yield "Cin7 anomaly detection does not support streaming"

    async def _check_sync_anomalies(
        self, db: AsyncSession, context: dict[str, Any]
    ) -> dict[str, Any]:
        """Check sync log patterns for anomalies."""
        from src.db.cin7_models import Cin7SyncLog

        logs_q = (
            select(Cin7SyncLog)
            .order_by(Cin7SyncLog.synced_at.desc())
            .limit(100)
        )
        logs_result = await db.execute(logs_q)
        logs = logs_result.scalars().all()

        if not logs:
            return {
                "is_anomaly": False,
                "description": "No sync logs found",
                "severity": "low",
            }

        sync_times = [log.synced_at for log in logs if log.synced_at]
        return detect_sync_frequency_anomaly(sync_times)

    async def _check_data_quality(
        self, db: AsyncSession, context: dict[str, Any]
    ) -> dict[str, Any]:
        """Check price/stock consistency between ERP and Cin7."""
        from src.db.cin7_models import Cin7SyncLog

        # Check sync health via success/failure counts
        success_q = select(func.count()).select_from(Cin7SyncLog).where(
            Cin7SyncLog.status == "completed"
        )
        failure_q = select(func.count()).select_from(Cin7SyncLog).where(
            Cin7SyncLog.status == "failed"
        )

        success_result = await db.execute(success_q)
        failure_result = await db.execute(failure_q)

        success_count = success_result.scalar() or 0
        failure_count = failure_result.scalar() or 0

        return calculate_sync_health_score(success_count, failure_count, 500.0)

    async def _check_mapping_coverage(
        self, db: AsyncSession, context: dict[str, Any]
    ) -> dict[str, Any]:
        """Check product mapping completeness."""
        from src.db.cin7_models import Cin7ProductMapping
        from src.db.demo_models import Product

        total_q = select(func.count()).select_from(Product)
        mapped_q = select(func.count()).select_from(Cin7ProductMapping)

        total_result = await db.execute(total_q)
        mapped_result = await db.execute(mapped_q)

        total = total_result.scalar() or 0
        mapped = mapped_result.scalar() or 0

        return detect_mapping_gaps(total, mapped)
