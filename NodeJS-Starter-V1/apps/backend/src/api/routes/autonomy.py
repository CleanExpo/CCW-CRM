"""Agent Autonomy API Endpoints.

Provides APIs for configuring and managing agent autonomy levels, including:
- GET /api/autonomy/agents - List all agents with their configurations
- GET /api/autonomy/config/{agent_id} - Get specific agent config
- PUT /api/autonomy/config/{agent_id} - Update agent config
- GET /api/autonomy/decisions - Query decisions with filters
- GET /api/autonomy/decisions/pending - Get pending approvals
- POST /api/autonomy/decisions/{decision_id}/approve - Approve decision
- POST /api/autonomy/decisions/{decision_id}/reject - Reject decision
- GET /api/autonomy/stats/{agent_id} - Get agent performance stats
"""

from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.ai.autonomy import get_autonomy_manager
from src.ai.autonomy.learning import get_learning_engine
from src.ai.autonomy.models import (
    AgentAutonomyConfig,
    AgentDecision,
    AutonomyLevel,
    AutonomyStats,
    DecisionFilter,
    DecisionStatus,
    RiskLevel,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/autonomy", tags=["Agent Autonomy"])


# Request/Response Models
class AgentSummary(BaseModel):
    """Summary of an agent with its autonomy configuration."""

    agent_id: str
    agent_name: str
    autonomy_level: AutonomyLevel
    enabled: bool
    max_auto_approval_amount: float
    max_actions_per_hour: int
    max_actions_per_day: int


class AgentListResponse(BaseModel):
    """List of agents with configurations."""

    agents: list[AgentSummary]
    total: int


class ConfigUpdateRequest(BaseModel):
    """Request to update agent autonomy configuration."""

    autonomy_level: AutonomyLevel | None = None
    min_confidence_low_risk: float | None = Field(None, ge=0.0, le=1.0)
    min_confidence_medium_risk: float | None = Field(None, ge=0.0, le=1.0)
    min_confidence_high_risk: float | None = Field(None, ge=0.0, le=1.0)
    max_auto_approval_amount: float | None = None
    max_auto_approval_quantity: int | None = None
    max_actions_per_hour: int | None = None
    max_actions_per_day: int | None = None
    learning_enabled: bool | None = None
    notify_on_execution: bool | None = None
    notify_on_pending: bool | None = None
    enabled: bool | None = None
    pause_until: str | None = None  # ISO datetime string


class DecisionApprovalRequest(BaseModel):
    """Request to approve a decision."""

    approved_by: UUID


class DecisionRejectionRequest(BaseModel):
    """Request to reject a decision."""

    rejected_by: UUID
    reason: str = Field(..., min_length=1, description="Reason for rejection")


class OutcomeRecordRequest(BaseModel):
    """Request to record decision outcome."""

    success: bool = Field(..., description="Was the outcome successful")
    metrics: dict[str, Any] | None = Field(None, description="Performance metrics")
    feedback: str | None = Field(None, description="Human feedback text")
    rating: int | None = Field(None, ge=1, le=5, description="1-5 star rating")


class DecisionListResponse(BaseModel):
    """List of agent decisions."""

    decisions: list[AgentDecision]
    total: int
    page: int
    page_size: int


# Known agents in the system
KNOWN_AGENTS = {
    "order_processing_agent": "Order Processing",
    "inventory_agent": "Inventory Management",
    "quote_agent": "Quote Generation",
    "forecasting_agent": "Demand Forecasting",
    "procurement_agent": "Procurement",
    "backorder_agent": "Backorder Management",
    "pricing_agent": "Pricing Optimization",
    "task_executor_agent": "Task Execution",
}


@router.get("/agents", response_model=AgentListResponse)
async def list_agents() -> AgentListResponse:
    """List all agents with their autonomy configurations.

    Returns:
        List of agents with their current autonomy settings
    """
    manager = get_autonomy_manager()
    agents = []

    for agent_id, agent_name in KNOWN_AGENTS.items():
        config = await manager.get_config(agent_id)
        agents.append(
            AgentSummary(
                agent_id=agent_id,
                agent_name=agent_name,
                autonomy_level=config.autonomy_level,
                enabled=config.enabled,
                max_auto_approval_amount=config.max_auto_approval_amount,
                max_actions_per_hour=config.max_actions_per_hour,
                max_actions_per_day=config.max_actions_per_day,
            )
        )

    logger.info("Listed agents", count=len(agents))
    return AgentListResponse(agents=agents, total=len(agents))


@router.get("/config/{agent_id}", response_model=AgentAutonomyConfig)
async def get_agent_config(agent_id: str) -> AgentAutonomyConfig:
    """Get autonomy configuration for a specific agent.

    Args:
        agent_id: Agent identifier

    Returns:
        Agent's autonomy configuration

    Raises:
        HTTPException: If agent not found
    """
    if agent_id not in KNOWN_AGENTS:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{agent_id}' not found. Known agents: {list(KNOWN_AGENTS.keys())}",
        )

    manager = get_autonomy_manager()
    config = await manager.get_config(agent_id)

    logger.info("Retrieved agent config", agent_id=agent_id)
    return config


@router.put("/config/{agent_id}", response_model=AgentAutonomyConfig)
async def update_agent_config(
    agent_id: str,
    request: ConfigUpdateRequest,
    updated_by: UUID | None = None,
) -> AgentAutonomyConfig:
    """Update autonomy configuration for an agent.

    Args:
        agent_id: Agent identifier
        request: Configuration updates
        updated_by: User ID making the update (optional)

    Returns:
        Updated configuration

    Raises:
        HTTPException: If agent not found or update invalid
    """
    if agent_id not in KNOWN_AGENTS:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{agent_id}' not found",
        )

    manager = get_autonomy_manager()

    # Convert request to dict, excluding None values
    updates = request.model_dump(exclude_none=True)

    try:
        config = await manager.update_config(
            agent_id=agent_id,
            updates=updates,
            updated_by=updated_by,
        )

        logger.info(
            "Updated agent config",
            agent_id=agent_id,
            updates=list(updates.keys()),
            updated_by=str(updated_by) if updated_by else None,
        )

        return config

    except Exception as e:
        logger.error("Failed to update agent config", agent_id=agent_id, error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/decisions", response_model=DecisionListResponse)
async def query_decisions(
    agent_id: str | None = Query(None, description="Filter by agent ID"),
    status: DecisionStatus | None = Query(None, description="Filter by status"),
    risk_level: RiskLevel | None = Query(None, description="Filter by risk level"),
    decision_type: str | None = Query(None, description="Filter by decision type"),
    min_confidence: float | None = Query(None, ge=0.0, le=1.0),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> DecisionListResponse:
    """Query agent decisions with filters.

    Args:
        agent_id: Filter by agent ID
        status: Filter by decision status
        risk_level: Filter by risk level
        decision_type: Filter by decision type
        min_confidence: Minimum confidence threshold
        page: Page number (1-indexed)
        page_size: Items per page (max 100)

    Returns:
        Paginated list of decisions
    """
    manager = get_autonomy_manager()

    # Build filter
    filter_obj = DecisionFilter(
        agent_ids=[agent_id] if agent_id else None,
        statuses=[status] if status else None,
        risk_levels=[risk_level] if risk_level else None,
        decision_types=[decision_type] if decision_type else None,
        min_confidence=min_confidence,
        limit=page_size,
        offset=(page - 1) * page_size,
    )

    decisions = await manager.storage.query_decisions(filter_obj)

    # Get total count (for this, we'd need to query again without pagination)
    # For now, return the filtered count
    total = len(decisions)

    logger.info(
        "Queried decisions",
        filters={
            "agent_id": agent_id,
            "status": status,
            "risk_level": risk_level,
        },
        count=len(decisions),
    )

    return DecisionListResponse(
        decisions=decisions,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/decisions/pending", response_model=list[AgentDecision])
async def get_pending_decisions(
    agent_id: str | None = Query(None, description="Filter by agent ID"),
    limit: int = Query(100, ge=1, le=1000),
) -> list[AgentDecision]:
    """Get decisions pending approval.

    Args:
        agent_id: Filter by agent ID (optional)
        limit: Maximum number of decisions to return

    Returns:
        List of pending decisions
    """
    manager = get_autonomy_manager()
    decisions = await manager.get_pending_decisions(agent_id=agent_id, limit=limit)

    logger.info(
        "Retrieved pending decisions",
        agent_id=agent_id,
        count=len(decisions),
    )

    return decisions


@router.post("/decisions/{decision_id}/approve", response_model=AgentDecision)
async def approve_decision(
    decision_id: str,
    request: DecisionApprovalRequest,
) -> AgentDecision:
    """Approve a pending decision.

    Args:
        decision_id: Decision identifier
        request: Approval request with user ID

    Returns:
        Updated decision

    Raises:
        HTTPException: If decision not found or not pending
    """
    manager = get_autonomy_manager()

    try:
        decision = await manager.approve_decision(
            decision_id=decision_id,
            approved_by=request.approved_by,
        )

        logger.info(
            "Decision approved",
            decision_id=decision_id,
            agent_id=decision.agent_id,
            approved_by=str(request.approved_by),
        )

        return decision

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Failed to approve decision", decision_id=decision_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/decisions/{decision_id}/reject", response_model=AgentDecision)
async def reject_decision(
    decision_id: str,
    request: DecisionRejectionRequest,
) -> AgentDecision:
    """Reject a pending decision.

    Args:
        decision_id: Decision identifier
        request: Rejection request with user ID and reason

    Returns:
        Updated decision

    Raises:
        HTTPException: If decision not found or not pending
    """
    manager = get_autonomy_manager()

    try:
        decision = await manager.reject_decision(
            decision_id=decision_id,
            rejected_by=request.rejected_by,
            reason=request.reason,
        )

        logger.info(
            "Decision rejected",
            decision_id=decision_id,
            agent_id=decision.agent_id,
            rejected_by=str(request.rejected_by),
            reason=request.reason,
        )

        return decision

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Failed to reject decision", decision_id=decision_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/{agent_id}", response_model=AutonomyStats)
async def get_agent_stats(
    agent_id: str,
    time_period: str = Query(
        "last_7d",
        description="Time period: last_24h, last_7d, last_30d",
    ),
) -> AutonomyStats:
    """Get performance statistics for an agent.

    Args:
        agent_id: Agent identifier
        time_period: Time period for stats (last_24h, last_7d, last_30d)

    Returns:
        Agent performance statistics

    Raises:
        HTTPException: If agent not found
    """
    if agent_id not in KNOWN_AGENTS:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{agent_id}' not found",
        )

    manager = get_autonomy_manager()

    try:
        stats = await manager.get_stats(agent_id=agent_id, time_period=time_period)

        logger.info(
            "Retrieved agent stats",
            agent_id=agent_id,
            time_period=time_period,
            total_decisions=stats.total_decisions,
        )

        return stats

    except Exception as e:
        logger.error("Failed to get agent stats", agent_id=agent_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/decisions/{decision_id}/outcome", response_model=AgentDecision)
async def record_decision_outcome(
    decision_id: str,
    request: OutcomeRecordRequest,
) -> AgentDecision:
    """Record outcome and feedback for a decision.

    Used after a decision is executed to record whether it was successful,
    along with metrics and human feedback for learning purposes.

    Args:
        decision_id: Decision identifier
        request: Outcome data (success, metrics, feedback, rating)

    Returns:
        Updated decision with outcome data

    Raises:
        HTTPException: If decision not found
    """
    manager = get_autonomy_manager()

    try:
        decision = await manager.record_outcome(
            decision_id=decision_id,
            success=request.success,
            metrics=request.metrics,
            feedback=request.feedback,
            rating=request.rating,
        )

        logger.info(
            "Decision outcome recorded",
            decision_id=decision_id,
            agent_id=decision.agent_id,
            success=request.success,
            rating=request.rating,
        )

        return decision

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Failed to record outcome", decision_id=decision_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/learning/analysis/{agent_id}")
async def get_learning_analysis(
    agent_id: str,
    days: int = Query(30, ge=1, le=90, description="Days of data to analyze"),
) -> dict[str, Any]:
    """Get learning analysis for an agent.

    Analyzes decision outcomes and provides insights into agent performance,
    including confidence accuracy, risk assessment accuracy, and human override patterns.

    Args:
        agent_id: Agent identifier
        days: Number of days to analyze (1-90)

    Returns:
        dict with performance analysis

    Raises:
        HTTPException: If agent not found
    """
    if agent_id not in KNOWN_AGENTS:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{agent_id}' not found",
        )

    learning_engine = get_learning_engine()

    try:
        analysis = await learning_engine.analyze_agent_performance(
            agent_id=agent_id,
            days=days,
        )

        logger.info(
            "Learning analysis complete",
            agent_id=agent_id,
            days=days,
            total_decisions=analysis.get("total_decisions", 0),
        )

        return analysis

    except Exception as e:
        logger.error("Failed to generate learning analysis", agent_id=agent_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/learning/recommendations/{agent_id}")
async def get_threshold_recommendations(
    agent_id: str,
    days: int = Query(30, ge=7, le=90, description="Days of data to analyze"),
) -> dict[str, Any]:
    """Get threshold adjustment recommendations for an agent.

    Analyzes agent performance and recommends adjustments to:
    - Confidence thresholds
    - Autonomy level
    - Rate limits

    Based on success rates, approval rates, and outcome patterns.

    Args:
        agent_id: Agent identifier
        days: Number of days to analyze (7-90)

    Returns:
        dict with current config and recommendations

    Raises:
        HTTPException: If agent not found
    """
    if agent_id not in KNOWN_AGENTS:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{agent_id}' not found",
        )

    manager = get_autonomy_manager()
    learning_engine = get_learning_engine()

    try:
        # Get current config
        config = await manager.get_config(agent_id)

        # Get recommendations
        recommendations = await learning_engine.recommend_threshold_adjustments(
            agent_id=agent_id,
            config=config,
            days=days,
        )

        logger.info(
            "Generated recommendations",
            agent_id=agent_id,
            recommendation_count=len(recommendations.get("recommendations", [])),
        )

        return recommendations

    except Exception as e:
        logger.error("Failed to generate recommendations", agent_id=agent_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
