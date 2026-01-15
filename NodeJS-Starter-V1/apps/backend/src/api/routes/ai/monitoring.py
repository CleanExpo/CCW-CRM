"""Agent monitoring API endpoints."""

from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.ai.monitoring import get_health_monitor, get_metrics_collector
from src.ai.orchestration import get_agent_registry

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/monitoring", tags=["AI Monitoring"])


# Response Models
class AgentListResponse(BaseModel):
    """Response listing all registered agents."""

    agents: list[dict[str, Any]]
    total: int


class SystemHealthResponse(BaseModel):
    """Response with system health metrics."""

    status: str = Field(description="healthy or degraded")
    recent_executions: int
    completed: int
    failed: int
    error_rate_percent: float
    avg_response_time_ms: float
    time_window_minutes: int


class ExecutionResponse(BaseModel):
    """Response with recent executions."""

    executions: list[dict[str, Any]]
    total: int


class AgentStatsResponse(BaseModel):
    """Response with agent statistics."""

    agent_id: str
    total_executions: int
    total_errors: int
    error_rate_percent: float
    avg_duration_ms: float
    total_duration_ms: int


class HealthCheckResponse(BaseModel):
    """Response with health monitor status."""

    monitor_status: dict[str, Any]
    system_health: dict[str, Any]


@router.get("/agents", response_model=AgentListResponse)
async def list_agents() -> AgentListResponse:
    """
    List all registered AI agents with their capabilities.

    Returns:
        AgentListResponse: List of agents with metadata
    """
    try:
        registry = get_agent_registry()
        all_agents = registry.get_all_agents()
        agent_ids = [agent_id for agent_id, _, _ in all_agents]

        agents = []
        for agent_id in agent_ids:
            metadata = registry.get_metadata(agent_id)
            if metadata:
                agents.append(
                    {
                        "agent_id": metadata.agent_id,
                        "name": metadata.name,
                        "description": metadata.description,
                        "capabilities": metadata.capabilities,
                        "requires_verification": metadata.requires_verification,
                    }
                )

        logger.info("Listed agents", total=len(agents))

        return AgentListResponse(agents=agents, total=len(agents))

    except Exception as e:
        logger.error("Failed to list agents", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to list agents: {str(e)}",
        ) from e


@router.get("/system", response_model=SystemHealthResponse)
async def get_system_health() -> SystemHealthResponse:
    """
    Get overall system health metrics.

    Returns:
        SystemHealthResponse: System health data including error rates and response times
    """
    try:
        collector = get_metrics_collector()
        health = collector.get_system_health()

        logger.info(
            "System health retrieved",
            status=health["status"],
            error_rate=health["error_rate_percent"],
        )

        return SystemHealthResponse(**health)

    except Exception as e:
        logger.error("Failed to get system health", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get system health: {str(e)}",
        ) from e


@router.get("/executions", response_model=ExecutionResponse)
async def get_recent_executions(
    limit: int = Query(50, ge=1, le=200, description="Maximum number of executions to return"),
    agent_id: str | None = Query(None, description="Filter by specific agent ID"),
    since_minutes: int | None = Query(None, ge=1, description="Only show executions from last N minutes"),
) -> ExecutionResponse:
    """
    Get recent agent executions with optional filtering.

    Args:
        limit: Maximum number of executions to return (1-200)
        agent_id: Optional filter for specific agent
        since_minutes: Optional time window in minutes

    Returns:
        ExecutionResponse: List of recent executions
    """
    try:
        collector = get_metrics_collector()
        executions = collector.get_recent_executions(
            limit=limit,
            agent_id=agent_id,
            since_minutes=since_minutes,
        )

        # Convert Pydantic models to dicts
        execution_dicts = [exec.model_dump() for exec in executions]

        logger.info(
            "Recent executions retrieved",
            count=len(execution_dicts),
            agent_id=agent_id,
        )

        return ExecutionResponse(
            executions=execution_dicts,
            total=len(execution_dicts),
        )

    except Exception as e:
        logger.error("Failed to get executions", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get executions: {str(e)}",
        ) from e


@router.get("/health", response_model=HealthCheckResponse)
async def health_check() -> HealthCheckResponse:
    """
    Check health monitor status and overall system health.

    Returns:
        HealthCheckResponse: Health monitor and system status
    """
    try:
        monitor = get_health_monitor()
        collector = get_metrics_collector()

        monitor_status = await monitor.get_status()
        system_health = collector.get_system_health()

        logger.info(
            "Health check completed",
            monitor_running=monitor_status["is_running"],
            system_status=system_health["status"],
        )

        return HealthCheckResponse(
            monitor_status=monitor_status,
            system_health=system_health,
        )

    except Exception as e:
        logger.error("Health check failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Health check failed: {str(e)}",
        ) from e


@router.get("/stats/{agent_id}", response_model=AgentStatsResponse)
async def get_agent_statistics(agent_id: str) -> AgentStatsResponse:
    """
    Get detailed statistics for a specific agent.

    Args:
        agent_id: Agent identifier

    Returns:
        AgentStatsResponse: Agent performance statistics

    Raises:
        HTTPException: If agent not found or stats unavailable
    """
    try:
        # Verify agent exists
        registry = get_agent_registry()
        all_agents = registry.get_all_agents()
        agent_ids = [aid for aid, _, _ in all_agents]
        if agent_id not in agent_ids:
            raise HTTPException(
                status_code=404,
                detail=f"Agent '{agent_id}' not found",
            )

        # Get statistics
        collector = get_metrics_collector()
        stats = collector.get_agent_statistics(agent_id)

        logger.info(
            "Agent statistics retrieved",
            agent_id=agent_id,
            executions=stats["total_executions"],
        )

        return AgentStatsResponse(**stats)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get agent statistics", agent_id=agent_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get agent statistics: {str(e)}",
        ) from e


@router.post("/test-data/generate")
async def generate_test_data_with_failures(count: int = Query(100, ge=1, le=500)) -> dict[str, Any]:
    """
    Generate realistic test data with failures for testing learning engine.

    This endpoint injects test executions directly into the running metrics collector.
    """
    from datetime import UTC, datetime, timedelta
    import random

    collector = get_metrics_collector()

    agents = [
        ("pricing_agent", "Pricing Agent"),
        ("procurement_agent", "Procurement Agent"),
        ("task_executor", "Task Executor"),
    ]

    # (task, success_rate, typical_duration_ms)
    tasks = {
        "pricing_agent": [
            ("Calculate optimal price", 0.85, 500),
            ("Analyze pricing history", 0.90, 3000),
            ("Recommend price adjustment", 0.25, 1000),  # FAILING
            ("Calculate margin", 0.95, 400),
            ("Price optimization strategy", 0.30, 2000),  # FAILING + SLOW
        ],
        "procurement_agent": [
            ("Check inventory levels", 0.95, 600),
            ("Calculate reorder quantity", 0.80, 1500),
            ("Suggest suppliers", 0.20, 1000),  # FAILING
            ("Analyze stock trends", 0.90, 4000),  # SLOW
            ("Validate supplier data", 0.35, 800),  # FAILING
        ],
        "task_executor": [
            ("Execute database update", 0.92, 700),
            ("Validate user action", 0.88, 500),
            ("Execute batch operation", 0.75, 5000),  # VERY SLOW
            ("Verify data integrity", 0.40, 1200),  # FAILING
        ],
    }

    error_messages = [
        "Database connection timeout",
        "Invalid input parameters",
        "External API rate limit exceeded",
        "Insufficient data for analysis",
        "Validation failed: missing required fields",
        "Network timeout after 30 seconds",
        "Authorization failed: invalid token",
    ]

    now = datetime.now(UTC)
    stats = {"total": 0, "succeeded": 0, "failed": 0, "by_agent": {}}

    for i in range(count):
        agent_id, agent_name = random.choice(agents)
        task, success_rate, typical_duration = random.choice(tasks[agent_id])

        minutes_ago = random.randint(0, 240)
        started_at = (now - timedelta(minutes=minutes_ago)).isoformat()

        duration_ms = int(typical_duration * random.uniform(0.7, 1.3))
        completed_at = (now - timedelta(minutes=minutes_ago) + timedelta(milliseconds=duration_ms)).isoformat()

        status = "completed" if random.random() < success_rate else "failed"

        collector.record_execution(
            execution_id=f"test-realistic-{i:03d}",
            agent_id=agent_id,
            agent_name=agent_name,
            task=task,
            status=status,
            started_at=started_at,
            completed_at=completed_at if status == "completed" else None,
            duration_ms=duration_ms if status == "completed" else None,
            error=random.choice(error_messages) if status == "failed" else None,
            metadata={
                "test_data": True,
                "iteration": i,
                "task_complexity": "high" if duration_ms > 3000 else "medium" if duration_ms > 1500 else "low",
            },
        )

        stats["total"] += 1
        if status == "completed":
            stats["succeeded"] += 1
        else:
            stats["failed"] += 1

        if agent_id not in stats["by_agent"]:
            stats["by_agent"][agent_id] = {"total": 0, "succeeded": 0, "failed": 0}

        stats["by_agent"][agent_id]["total"] += 1
        if status == "completed":
            stats["by_agent"][agent_id]["succeeded"] += 1
        else:
            stats["by_agent"][agent_id]["failed"] += 1

    logger.info("Test data generated", total=stats["total"], succeeded=stats["succeeded"], failed=stats["failed"])

    return {
        "message": f"Generated {count} test executions",
        "statistics": stats,
        "expected_patterns": {
            "success": "Fast tasks with >80% success rate",
            "failure": "Tasks with <30% success rate (will trigger HIGH priority insights)",
            "optimization": "Slow tasks (>3s) that succeed (will trigger MEDIUM priority insights)",
        },
        "next_steps": [
            "POST /api/ai/learning/extract-patterns?lookback_hours=5&min_observations=3",
            "POST /api/ai/learning/generate-insights?min_confidence=0.4",
        ],
    }
