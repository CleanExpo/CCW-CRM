"""Agent monitoring API endpoints.

Provides read-only visibility into agent execution stats, task history,
performance trends, and learning insights for the Agents Dashboard.
Also exposes POST /execute for ad-hoc agent dispatch via ProtocolMixin.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from src.api.deps import get_current_user

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/agents", tags=["Agent Monitoring"])

# ---------------------------------------------------------------------------
# Agent class registry — maps lowercase agent name → importable class path.
# Agents are imported lazily inside the execute endpoint to avoid circular
# imports at module load time.
# ---------------------------------------------------------------------------
_AGENT_REGISTRY: dict[str, tuple[str, str]] = {
    # key: lowercased class name  →  (module_path, ClassName)
    "chatassistant":             ("src.ai.agents.chat_assistant", "ChatAssistant"),
    "contentgenerator":          ("src.ai.agents.content_generator", "ContentGenerator"),
    "insightsagent":             ("src.ai.agents.insights_agent", "InsightsAgent"),
    "anomalydetectionagent":     ("src.ai.agents.specialized.anomaly_detection_agent", "AnomalyDetectionAgent"),
    "autonomousopsagent":        ("src.ai.agents.specialized.autonomous_ops_agent", "AutonomousOpsAgent"),
    "cin7anomalyagent":          ("src.ai.agents.specialized.cin7_anomaly_agent", "Cin7AnomalyAgent"),
    "cin7forecastingagent":      ("src.ai.agents.specialized.cin7_forecasting_agent", "Cin7ForecastingAgent"),
    "cin7shadowagent":           ("src.ai.agents.specialized.cin7_shadow_agent", "Cin7ShadowAgent"),
    "developmentagent":          ("src.ai.agents.specialized.development_agent", "DevelopmentAgent"),
    "documentparseragent":       ("src.ai.agents.specialized.document_parser_agent", "DocumentParserAgent"),
    "formautofillagent":         ("src.ai.agents.specialized.form_autofill_agent", "FormAutoFillAgent"),
    "inventoryforecastingagent": ("src.ai.agents.specialized.inventory_forecasting_agent", "InventoryForecastingAgent"),
    "marketingagent":            ("src.ai.agents.specialized.marketing_agent", "MarketingAgent"),
    "pricingagent":              ("src.ai.agents.specialized.pricing_agent", "PricingAgent"),
    "procurementagent":          ("src.ai.agents.specialized.procurement_agent", "ProcurementAgent"),
    "projectintelligenceagent":  ("src.ai.agents.specialized.project_intelligence_agent", "ProjectIntelligenceAgent"),
    "queryagent":                ("src.ai.agents.specialized.query_agent", "QueryAgent"),
    "recommendationagent":       ("src.ai.agents.specialized.recommendation_agent", "RecommendationAgent"),
    "searchagent":               ("src.ai.agents.specialized.search_agent", "SearchAgent"),
    "staffcopilotagent":         ("src.ai.agents.specialized.staff_copilot_agent", "StaffCopilotAgent"),
    "taskexecutoragent":         ("src.ai.agents.specialized.task_executor_agent", "TaskExecutorAgent"),
    "testingagent":              ("src.ai.agents.specialized.testing_agent", "TestingAgent"),
}


def _get_collector():
    """Lazily import metrics collector (AI routes may be unavailable)."""
    try:
        from src.ai.monitoring import get_metrics_collector
        return get_metrics_collector()
    except ImportError:
        return None


# ─── Stats ───────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_agent_stats() -> dict:
    """Overall agent statistics for the dashboard header cards."""
    collector = _get_collector()

    if collector is None:
        return {
            "total_agents": 0,
            "active_agents": 0,
            "total_tasks": 0,
            "successful_tasks": 0,
            "failed_tasks": 0,
            "success_rate": 0.0,
            "avg_iterations": 0.0,
            "avg_duration_seconds": 0.0,
        }

    stats = collector.get_agent_statistics()
    total = stats["total_executions"]
    errors = stats["total_errors"]
    success = total - errors

    return {
        "total_agents": stats["total_agents"],
        "active_agents": stats["total_agents"],
        "total_tasks": total,
        "successful_tasks": success,
        "failed_tasks": errors,
        "success_rate": round(success / total, 3) if total > 0 else 0.0,
        "avg_iterations": 1.0,  # iterations tracking not yet wired in metrics
        "avg_duration_seconds": 0.0,
    }


# ─── Agent list ──────────────────────────────────────────────────────────────

@router.get("/list")
async def list_agents() -> list[dict]:
    """List of agents with per-agent stats."""
    collector = _get_collector()

    if collector is None:
        return []

    stats = collector.get_agent_statistics()
    agents_data = stats.get("agents", {})

    result = []
    for agent_id, agent_stats in agents_data.items():
        total = agent_stats["total_executions"]
        errors = agent_stats["total_errors"]
        success_rate = (total - errors) / total if total > 0 else 0.0

        result.append({
            "agent_id": agent_id,
            "agent_type": agent_id.replace("_", " ").title(),
            "status": "active",
            "task_count": total,
            "success_rate": round(success_rate, 3),
        })

    return sorted(result, key=lambda a: a["task_count"], reverse=True)


# ─── Recent tasks ────────────────────────────────────────────────────────────

@router.get("/tasks/recent")
async def get_recent_tasks(
    limit: int = Query(10, ge=1, le=100),
) -> list[dict]:
    """Recent task execution history."""
    collector = _get_collector()

    if collector is None:
        return []

    executions = collector.get_recent_executions(limit=limit)

    return [
        {
            "task_id": e.execution_id,
            "status": e.status,
            "description": e.task[:80] if e.task else None,
            "agent_type": e.agent_name,
            "verified": e.status == "completed",
            "iterations": 1,
            "duration_seconds": (e.duration_ms / 1000) if e.duration_ms else None,
            "created_at": e.started_at,
        }
        for e in executions
    ]


# ─── Performance trends ──────────────────────────────────────────────────────

@router.get("/performance/trends")
async def get_performance_trends(
    days: int = Query(7, ge=1, le=30),
) -> dict:
    """Daily task completion and success-rate trends."""
    collector = _get_collector()

    if collector is None:
        return {"data_points": []}

    # Build one bucket per day
    today = datetime.now(UTC).date()
    buckets: dict[str, dict] = {}

    for i in range(days):
        day = today - timedelta(days=i)
        buckets[str(day)] = {"date": str(day), "tasks_completed": 0, "tasks_failed": 0}

    executions = collector.get_recent_executions(limit=1000, since_minutes=days * 24 * 60)
    for e in executions:
        try:
            day = datetime.fromisoformat(e.started_at.replace("Z", "+00:00")).date()
            key = str(day)
            if key in buckets:
                if e.status == "completed":
                    buckets[key]["tasks_completed"] += 1
                elif e.status == "failed":
                    buckets[key]["tasks_failed"] += 1
        except (ValueError, AttributeError):
            continue

    data_points = []
    for bucket in buckets.values():
        completed = bucket["tasks_completed"]
        failed = bucket["tasks_failed"]
        total = completed + failed
        data_points.append({
            "date": bucket["date"],
            "tasks_completed": completed,
            "success_rate": round(completed / total, 3) if total > 0 else 1.0,
        })

    return {"data_points": data_points}


# ─── Insights ────────────────────────────────────────────────────────────────

@router.get("/insights")
async def get_agent_insights() -> dict:
    """Learning insights and optimization recommendations."""
    collector = _get_collector()

    if collector is None:
        return {"insights": []}

    # Derive insights from metrics
    stats = collector.get_agent_statistics()
    agents_data = stats.get("agents", {})
    insights = []

    for agent_id, agent_stats in agents_data.items():
        total = agent_stats["total_executions"]
        errors = agent_stats["total_errors"]
        error_rate = agent_stats["error_rate_percent"]

        if total < 1:
            continue

        if error_rate > 20:
            insights.append({
                "insight_id": f"high-error-{agent_id}",
                "insight_type": "error_prevention",
                "agent_id": agent_id,
                "priority": "high",
                "title": f"High error rate for {agent_id}",
                "description": f"{agent_id} has a {error_rate:.0f}% error rate over {total} executions.",
                "recommended_action": "Review agent task definitions and input validation.",
                "expected_improvement": min(int(error_rate * 0.7), 50),
                "supporting_patterns": [f"{errors} failures in {total} runs"],
                "created_at": datetime.now(UTC).isoformat(),
            })
        elif error_rate > 10:
            insights.append({
                "insight_id": f"moderate-error-{agent_id}",
                "insight_type": "process_optimization",
                "agent_id": agent_id,
                "priority": "medium",
                "title": f"Moderate error rate for {agent_id}",
                "description": f"{agent_id} has a {error_rate:.0f}% error rate — review edge cases.",
                "recommended_action": "Add retry logic for transient failures.",
                "expected_improvement": min(int(error_rate * 0.5), 30),
                "supporting_patterns": [f"{errors} failures in {total} runs"],
                "created_at": datetime.now(UTC).isoformat(),
            })

    return {"insights": insights}


# ─── Protocol execute ─────────────────────────────────────────────────────────

class AgentExecuteRequest(BaseModel):
    agent_name: str
    task: dict[str, Any]


@router.post("/execute", dependencies=[Depends(get_current_user)])
async def execute_agent(body: AgentExecuteRequest) -> dict:
    """Dispatch a task to any registered agent via ProtocolMixin.

    Body: {"agent_name": "AnomalyDetectionAgent", "task": {"action": "execute", "params": {...}}}
    The agent_name lookup is case-insensitive.
    """
    import importlib

    from src.ai.agents.protocol_mixin import ProtocolMixin

    key = body.agent_name.lower().replace(" ", "").replace("_", "")
    entry = _AGENT_REGISTRY.get(key)
    if entry is None:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{body.agent_name}' not found. "
                   f"Available: {sorted(_AGENT_REGISTRY.keys())}",
        )

    module_path, class_name = entry
    try:
        module = importlib.import_module(module_path)
        agent_cls = getattr(module, class_name)
    except (ImportError, AttributeError) as exc:
        logger.error("Failed to import agent", agent=body.agent_name, error=str(exc))
        raise HTTPException(status_code=500, detail=f"Could not load agent: {exc}") from exc

    # Dynamically mix in ProtocolMixin if the class doesn't already have it
    if not issubclass(agent_cls, ProtocolMixin):
        agent_cls = type(class_name, (ProtocolMixin, agent_cls), {})

    try:
        instance = agent_cls()
    except Exception as exc:
        logger.error("Failed to instantiate agent", agent=body.agent_name, error=str(exc))
        raise HTTPException(status_code=500, detail=f"Could not instantiate agent: {exc}") from exc

    result = await instance.protocol_execute(body.task)
    return result
