"""Metrics collection for agent executions."""

from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any

from pydantic import BaseModel

from src.utils import get_logger

logger = get_logger(__name__)


class AgentExecutionMetric(BaseModel):
    """Single agent execution metric."""

    execution_id: str
    agent_id: str
    agent_name: str
    task: str
    status: str
    started_at: str
    completed_at: str | None = None
    duration_ms: int | None = None
    error: str | None = None
    metadata: dict[str, Any] = {}


class MetricsCollector:
    """Collects and aggregates agent execution metrics."""

    def __init__(self):
        self._metrics: list[AgentExecutionMetric] = []
        self._agent_counts: dict[str, int] = defaultdict(int)
        self._agent_errors: dict[str, int] = defaultdict(int)
        self._agent_total_duration: dict[str, int] = defaultdict(int)
        logger.info("Metrics collector initialized")

    def record_execution(
        self,
        execution_id: str,
        agent_id: str,
        agent_name: str,
        task: str,
        status: str,
        started_at: str,
        completed_at: str | None = None,
        duration_ms: int | None = None,
        error: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Record a single agent execution."""
        metric = AgentExecutionMetric(
            execution_id=execution_id,
            agent_id=agent_id,
            agent_name=agent_name,
            task=task,
            status=status,
            started_at=started_at,
            completed_at=completed_at,
            duration_ms=duration_ms,
            error=error,
            metadata=metadata or {},
        )

        self._metrics.append(metric)
        self._agent_counts[agent_id] += 1
        if status == "failed":
            self._agent_errors[agent_id] += 1
        if duration_ms is not None:
            self._agent_total_duration[agent_id] += duration_ms

    def get_recent_executions(
        self,
        limit: int = 50,
        agent_id: str | None = None,
        since_minutes: int | None = None,
    ) -> list[AgentExecutionMetric]:
        """Get recent agent executions."""
        filtered = self._metrics

        if agent_id:
            filtered = [m for m in filtered if m.agent_id == agent_id]

        if since_minutes:
            cutoff = datetime.now(UTC) - timedelta(minutes=since_minutes)
            filtered = [
                m
                for m in filtered
                if datetime.fromisoformat(m.started_at.replace("Z", "+00:00")) >= cutoff
            ]

        return sorted(filtered, key=lambda m: m.started_at, reverse=True)[:limit]

    def get_agent_statistics(self, agent_id: str | None = None) -> dict[str, Any]:
        """Get aggregated statistics for agents."""
        if agent_id:
            total_executions = self._agent_counts.get(agent_id, 0)
            total_errors = self._agent_errors.get(agent_id, 0)
            total_duration = self._agent_total_duration.get(agent_id, 0)

            avg_duration_ms = (
                total_duration / total_executions if total_executions > 0 else 0
            )
            error_rate = (
                (total_errors / total_executions) * 100 if total_executions > 0 else 0
            )

            return {
                "agent_id": agent_id,
                "total_executions": total_executions,
                "total_errors": total_errors,
                "error_rate_percent": round(error_rate, 2),
                "avg_duration_ms": round(avg_duration_ms, 2),
                "total_duration_ms": total_duration,
            }
        else:
            all_stats = {}
            for aid in self._agent_counts.keys():
                all_stats[aid] = self.get_agent_statistics(aid)

            return {
                "total_agents": len(self._agent_counts),
                "total_executions": sum(self._agent_counts.values()),
                "total_errors": sum(self._agent_errors.values()),
                "agents": all_stats,
            }

    def get_system_health(self) -> dict[str, Any]:
        """Get overall system health metrics."""
        recent_executions = self.get_recent_executions(limit=100, since_minutes=60)

        total_recent = len(recent_executions)
        failed_recent = sum(1 for m in recent_executions if m.status == "failed")
        completed_recent = sum(1 for m in recent_executions if m.status == "completed")

        recent_error_rate = (
            (failed_recent / total_recent) * 100 if total_recent > 0 else 0
        )

        completed_with_duration = [
            m for m in recent_executions if m.duration_ms is not None and m.status == "completed"
        ]
        avg_response_time = (
            sum(m.duration_ms for m in completed_with_duration) / len(completed_with_duration)
            if completed_with_duration
            else 0
        )

        return {
            "status": "healthy" if recent_error_rate < 10 else "degraded",
            "recent_executions": total_recent,
            "completed": completed_recent,
            "failed": failed_recent,
            "error_rate_percent": round(recent_error_rate, 2),
            "avg_response_time_ms": round(avg_response_time, 2),
            "time_window_minutes": 60,
        }


_metrics_collector: MetricsCollector | None = None


def get_metrics_collector() -> MetricsCollector:
    """Get or create metrics collector singleton."""
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = MetricsCollector()
    return _metrics_collector
