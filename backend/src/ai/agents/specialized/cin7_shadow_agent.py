"""Cin7 Shadow Gap Analysis Agent.

Analyzes Cin7->ERP sync gaps, classifies severity, generates recommendations,
and auto-resolves stale conflicts.

UNI-1262: Shadow Transition System Phase C
"""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.base_agent import BaseAgent

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Pure helper functions — testable without DB or async
# ---------------------------------------------------------------------------


def _severity_rank(severity: str) -> int:
    """Return a numeric rank for severity (higher = more severe)."""
    return {"low": 1, "medium": 2, "high": 3, "critical": 4}.get(severity, 0)


def build_recommendations(
    entity_summary: list[dict[str, Any]],
    total_gaps: int,
) -> list[dict[str, Any]]:
    """Generate prioritised recommendations from a gap entity summary.

    Heuristics (pure function, no DB required):
      - critical gaps for "order" → priority 1
      - critical gaps for any entity → priority 1
      - > 5 gaps for any entity → priority 2
      - total_gaps == 0 → priority 0 (all clear)

    Args:
        entity_summary: List of {entity_type, severity, count} dicts.
        total_gaps: Total number of open gaps.

    Returns:
        Priority-sorted list of {entity_type, gap_count, priority, recommendation}.
    """
    if total_gaps == 0:
        return [
            {
                "entity_type": "all",
                "gap_count": 0,
                "priority": 0,
                "recommendation": "All entities are in sync — no action required",
            }
        ]

    # Aggregate per entity_type
    entity_counts: dict[str, int] = defaultdict(int)
    entity_critical: dict[str, int] = defaultdict(int)

    for item in entity_summary:
        entity_type = item["entity_type"]
        count = item["count"]
        severity = item.get("severity", "low")
        entity_counts[entity_type] += count
        if severity == "critical":
            entity_critical[entity_type] += count

    recommendations: list[dict[str, Any]] = []

    for entity_type, total in entity_counts.items():
        critical = entity_critical.get(entity_type, 0)
        if critical > 0:
            recommendations.append(
                {
                    "entity_type": entity_type,
                    "gap_count": total,
                    "priority": 1,
                    "recommendation": (
                        f"Immediately re-sync Cin7 {entity_type}s — "
                        f"{critical} critical discrepanc{'y' if critical == 1 else 'ies'} detected"
                    ),
                }
            )
        elif total > 5:
            recommendations.append(
                {
                    "entity_type": entity_type,
                    "gap_count": total,
                    "priority": 2,
                    "recommendation": (
                        f"High gap volume for {entity_type} — "
                        f"schedule bulk reconciliation ({total} open gaps)"
                    ),
                }
            )
        else:
            recommendations.append(
                {
                    "entity_type": entity_type,
                    "gap_count": total,
                    "priority": 3,
                    "recommendation": (
                        f"Review {total} open {entity_type} gap{'s' if total != 1 else ''} "
                        f"and resolve manually"
                    ),
                }
            )

    # Sort by priority ascending (lower number = more urgent)
    recommendations.sort(key=lambda r: r["priority"])
    return recommendations


# ---------------------------------------------------------------------------
# Demo fallback data
# ---------------------------------------------------------------------------

_DEMO_ENTITY_SUMMARY = [
    {"entity_type": "order", "severity": "critical", "count": 2},
    {"entity_type": "product", "severity": "high", "count": 3},
    {"entity_type": "customer", "severity": "medium", "count": 3},
]

_DEMO_TOTAL_GAPS = 8
_DEMO_CRITICAL_COUNT = 2


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------


class Cin7ShadowAgent(BaseAgent):
    """AI agent for Cin7 shadow gap analysis and auto-resolution.

    Reads the Cin7SyncGap table, classifies patterns, generates prioritised
    recommendations, and can auto-resolve stale (old open) gaps.
    """

    name = "cin7_shadow_agent"
    version = "1.0.0"

    def __init__(self) -> None:
        super().__init__(name=self.name, auto_register=True)
        self.logger = structlog.get_logger(__name__)
        self.capabilities = [
            "cin7_shadow_gap_analysis",
            "cin7_auto_resolve",
            "cin7_sync_recommendations",
        ]
        self.description = (
            "Analyzes Cin7->ERP sync gaps, classifies severity, "
            "generates recommendations, and auto-resolves stale conflicts"
        )
        self.requires_verification = False
        self.estimated_execution_time = 5

    # ------------------------------------------------------------------
    # BaseAgent abstract method implementations
    # ------------------------------------------------------------------

    async def execute(
        self, task: str, context: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Execute a shadow gap analysis task.

        Context keys:
            action: "analyze" | "auto_resolve" (default: "analyze")
            days_old: int — days threshold for auto-resolve (default: 7)
        """
        self._log_execution_start(task, context)
        ctx = context or {}
        action = ctx.get("action", "analyze")

        try:
            async with self.get_db_session() as db:
                if action == "auto_resolve":
                    days_old = int(ctx.get("days_old", 7))
                    count = await self.auto_resolve_stale(db, days_old)
                    result: dict[str, Any] = {
                        "action": "auto_resolve",
                        "resolved_count": count,
                        "days_old": days_old,
                    }
                else:
                    analysis = await self.analyze_gaps(db)
                    recommendations = await self.generate_recommendations(analysis)
                    result = {
                        "action": "analyze",
                        "analysis": analysis,
                        "recommendations": recommendations,
                    }

            self._log_execution_complete(True)
            return result

        except Exception as e:
            self.logger.error("cin7_shadow_agent_failed", action=action, error=str(e))
            self._log_execution_complete(False, str(e))
            return {"error": str(e)}

    async def stream(
        self, task: str, context: dict[str, Any] | None = None
    ):
        """Streaming not supported — yields a single status string."""
        yield "Cin7 shadow gap analysis does not support streaming"

    # ------------------------------------------------------------------
    # Domain methods
    # ------------------------------------------------------------------

    async def analyze_gaps(self, db: AsyncSession) -> dict[str, Any]:
        """Query the Cin7SyncGap table and return a structured summary.

        Returns:
            {
                entity_summary: [{entity_type, severity, count}],
                total_gaps: int,
                critical_count: int,
                analyzed_at: str (ISO-8601),
            }

        Falls back to demo data when the table is empty.
        """
        from src.db.cin7_shadow_models import Cin7SyncGap

        stmt = (
            select(
                Cin7SyncGap.entity_type,
                Cin7SyncGap.severity,
                func.count(Cin7SyncGap.id).label("cnt"),
            )
            .where(Cin7SyncGap.status.in_(["open", "investigating"]))
            .group_by(Cin7SyncGap.entity_type, Cin7SyncGap.severity)
            .order_by(Cin7SyncGap.entity_type, Cin7SyncGap.severity)
        )

        result = await db.execute(stmt)
        rows = result.all()

        if not rows:
            # Demo fallback
            self.logger.info("cin7_shadow_agent_demo_fallback", reason="no_rows")
            return {
                "entity_summary": _DEMO_ENTITY_SUMMARY,
                "total_gaps": _DEMO_TOTAL_GAPS,
                "critical_count": _DEMO_CRITICAL_COUNT,
                "analyzed_at": datetime.now(UTC).isoformat(),
                "demo": True,
            }

        entity_summary = [
            {"entity_type": row.entity_type, "severity": row.severity, "count": row.cnt}
            for row in rows
        ]

        total_gaps = sum(r["count"] for r in entity_summary)
        critical_count = sum(
            r["count"] for r in entity_summary if r["severity"] == "critical"
        )

        self.logger.info(
            "cin7_shadow_agent_analysis_complete",
            total_gaps=total_gaps,
            critical_count=critical_count,
        )

        return {
            "entity_summary": entity_summary,
            "total_gaps": total_gaps,
            "critical_count": critical_count,
            "analyzed_at": datetime.now(UTC).isoformat(),
            "demo": False,
        }

    async def generate_recommendations(
        self, analysis: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """Generate recommendations from gap analysis output.

        Pure logic — no DB access required.

        Args:
            analysis: Output dict from ``analyze_gaps()``.

        Returns:
            Priority-sorted list of recommendation dicts.
        """
        entity_summary = analysis.get("entity_summary", [])
        total_gaps = analysis.get("total_gaps", 0)
        return build_recommendations(entity_summary, total_gaps)

    async def auto_resolve_stale(
        self, db: AsyncSession, days_old: int = 7
    ) -> int:
        """Mark stale open gaps as resolved.

        Finds all Cin7SyncGap rows with status='open' whose detected_at
        is older than ``days_old`` days and marks them resolved.

        Args:
            db: Async SQLAlchemy session.
            days_old: Age threshold in days (default 7).

        Returns:
            Number of gaps resolved.
        """
        from src.db.cin7_shadow_models import Cin7SyncGap

        cutoff = datetime.now(UTC) - timedelta(days=days_old)
        notes = f"Auto-resolved: no changes detected after {days_old} days"
        now = datetime.now(UTC)

        stmt = (
            update(Cin7SyncGap)
            .where(
                Cin7SyncGap.status == "open",
                Cin7SyncGap.detected_at < cutoff,
            )
            .values(
                status="resolved",
                resolved_at=now,
                resolution_notes=notes,
            )
        )

        result = await db.execute(stmt)
        await db.commit()

        resolved_count: int = result.rowcount or 0
        self.logger.info(
            "cin7_shadow_agent_auto_resolved",
            resolved_count=resolved_count,
            days_old=days_old,
            cutoff=cutoff.isoformat(),
        )
        return resolved_count
