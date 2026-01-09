"""Learning engine API endpoints."""

from datetime import UTC, datetime, timedelta
import random
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.ai.learning import get_learning_engine
from src.ai.monitoring import get_metrics_collector

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/learning", tags=["AI Learning"])


# Response Models
class PatternResponse(BaseModel):
    """Response with learned patterns."""

    patterns: list[dict[str, Any]]
    total: int


class InsightResponse(BaseModel):
    """Response with learning insights."""

    insights: list[dict[str, Any]]
    total: int


class VariantResponse(BaseModel):
    """Response with prompt variants."""

    variants: list[dict[str, Any]]
    total: int


class LearningStatusResponse(BaseModel):
    """Response with learning engine status."""

    total_patterns: int
    pattern_breakdown: dict[str, int]
    total_insights: int
    insight_priorities: dict[str, int]
    total_variants: int
    agents_with_variants: int


class CreateVariantRequest(BaseModel):
    """Request to create a prompt variant."""

    agent_id: str
    prompt_template: str
    version: int


class RecordExecutionRequest(BaseModel):
    """Request to record variant execution."""

    variant_id: str
    success: bool
    duration_ms: float


@router.post("/extract-patterns", response_model=PatternResponse)
async def extract_patterns(
    agent_id: str | None = Query(None, description="Filter by specific agent"),
    lookback_hours: int = Query(24, ge=1, le=168, description="Hours to look back"),
    min_observations: int = Query(3, ge=2, le=20, description="Minimum observations for pattern"),
) -> PatternResponse:
    """
    Extract learning patterns from agent executions.

    Analyzes recent execution history to identify success/failure patterns,
    common conditions, and performance characteristics.

    Args:
        agent_id: Optional agent filter
        lookback_hours: Time window for analysis (1-168 hours)
        min_observations: Minimum executions needed to establish pattern

    Returns:
        PatternResponse: Extracted patterns with statistics
    """
    try:
        engine = get_learning_engine()
        patterns = await engine.extract_patterns(
            agent_id=agent_id,
            lookback_hours=lookback_hours,
            min_observations=min_observations,
        )

        pattern_dicts = [p.model_dump() for p in patterns]

        logger.info(
            "Patterns extracted",
            total=len(patterns),
            agent_id=agent_id,
        )

        return PatternResponse(patterns=pattern_dicts, total=len(patterns))

    except Exception as e:
        logger.error("Failed to extract patterns", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to extract patterns: {str(e)}",
        ) from e


@router.post("/generate-insights", response_model=InsightResponse)
async def generate_insights(
    agent_id: str | None = Query(None, description="Filter by specific agent"),
    min_confidence: float = Query(0.7, ge=0.0, le=1.0, description="Minimum pattern confidence"),
) -> InsightResponse:
    """
    Generate actionable insights from learned patterns.

    Analyzes patterns to identify optimization opportunities, error prevention
    strategies, and prompt improvements.

    Args:
        agent_id: Optional agent filter
        min_confidence: Minimum confidence threshold for patterns

    Returns:
        InsightResponse: Actionable insights with recommendations
    """
    try:
        engine = get_learning_engine()
        insights = await engine.generate_insights(
            agent_id=agent_id,
            min_confidence=min_confidence,
        )

        insight_dicts = [i.model_dump() for i in insights]

        logger.info(
            "Insights generated",
            total=len(insights),
            agent_id=agent_id,
        )

        return InsightResponse(insights=insight_dicts, total=len(insights))

    except Exception as e:
        logger.error("Failed to generate insights", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate insights: {str(e)}",
        ) from e


@router.get("/patterns", response_model=PatternResponse)
async def get_patterns(
    agent_id: str | None = Query(None, description="Filter by specific agent"),
) -> PatternResponse:
    """
    Get all stored learning patterns.

    Returns:
        PatternResponse: All learned patterns
    """
    try:
        engine = get_learning_engine()
        patterns = engine.get_patterns(agent_id=agent_id)

        pattern_dicts = [p.model_dump() for p in patterns]

        return PatternResponse(patterns=pattern_dicts, total=len(patterns))

    except Exception as e:
        logger.error("Failed to get patterns", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get patterns: {str(e)}",
        ) from e


# Removed duplicate endpoint - consolidated into /insights below


@router.get("/insights", response_model=InsightResponse)
async def get_insights(
    agent_id: str | None = Query(None, description="Filter by specific agent"),
    priority: str | None = Query(None, description="Filter by priority (high, medium, low)"),
) -> InsightResponse:
    """
    Get all stored insights from database.

    Args:
        agent_id: Optional agent filter
        priority: Optional priority filter

    Returns:
        InsightResponse: All insights matching filters
    """
    try:
        # Load insights from database with explicit session
        from src.ai.learning.learning_repository import LearningRepository
        from src.config.database import AsyncSessionLocal

        async with AsyncSessionLocal() as session:
            repository = LearningRepository(db_session=session)
            insights_data = await repository.load_insights(agent_id=agent_id, priority=priority)

        logger.info(
            "Insights loaded from database",
            total=len(insights_data),
            agent_id=agent_id,
            priority=priority,
        )

        return InsightResponse(insights=insights_data, total=len(insights_data))

    except Exception as e:
        logger.error("Failed to get insights", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get insights: {str(e)}",
        ) from e


@router.post("/variants", response_model=dict[str, Any])
async def create_variant(request: CreateVariantRequest) -> dict[str, Any]:
    """
    Create a new prompt variant for A/B testing.

    Args:
        request: Variant creation parameters

    Returns:
        Created variant details
    """
    try:
        engine = get_learning_engine()
        variant = await engine.create_prompt_variant(
            agent_id=request.agent_id,
            prompt_template=request.prompt_template,
            version=request.version,
        )

        logger.info(
            "Variant created",
            variant_id=variant.variant_id,
            agent_id=request.agent_id,
        )

        return variant.model_dump()

    except Exception as e:
        logger.error("Failed to create variant", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create variant: {str(e)}",
        ) from e


@router.post("/variants/record")
async def record_variant_execution(request: RecordExecutionRequest) -> dict[str, str]:
    """
    Record the outcome of using a prompt variant.

    Args:
        request: Execution outcome details

    Returns:
        Success message
    """
    try:
        engine = get_learning_engine()
        await engine.record_variant_execution(
            variant_id=request.variant_id,
            success=request.success,
            duration_ms=request.duration_ms,
        )

        logger.info(
            "Variant execution recorded",
            variant_id=request.variant_id,
            success=request.success,
        )

        return {"status": "success", "message": "Variant execution recorded"}

    except Exception as e:
        logger.error("Failed to record variant execution", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to record execution: {str(e)}",
        ) from e


@router.get("/variants/{agent_id}", response_model=VariantResponse)
async def get_agent_variants(agent_id: str) -> VariantResponse:
    """
    Get all prompt variants for a specific agent.

    Args:
        agent_id: Agent identifier

    Returns:
        VariantResponse: All variants for the agent
    """
    try:
        engine = get_learning_engine()
        variants = engine.get_variants(agent_id=agent_id)

        variant_dicts = [v.model_dump() for v in variants]

        return VariantResponse(variants=variant_dicts, total=len(variants))

    except Exception as e:
        logger.error("Failed to get variants", agent_id=agent_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get variants: {str(e)}",
        ) from e


@router.post("/variants/{agent_id}/select-best", response_model=dict[str, Any] | None)
async def select_best_variant(
    agent_id: str,
    min_executions: int = Query(10, ge=5, le=50, description="Minimum executions to consider"),
) -> dict[str, Any] | None:
    """
    Select the best performing variant for an agent.

    Args:
        agent_id: Agent identifier
        min_executions: Minimum executions before considering variant

    Returns:
        Best variant or None if insufficient data
    """
    try:
        engine = get_learning_engine()
        best = await engine.select_best_variant(
            agent_id=agent_id,
            min_executions=min_executions,
        )

        if best is None:
            return None

        logger.info(
            "Best variant selected",
            agent_id=agent_id,
            variant_id=best.variant_id,
        )

        return best.model_dump()

    except Exception as e:
        logger.error("Failed to select best variant", agent_id=agent_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to select best variant: {str(e)}",
        ) from e


@router.get("/status", response_model=LearningStatusResponse)
async def get_learning_status() -> LearningStatusResponse:
    """
    Get learning engine status and statistics.

    Returns:
        LearningStatusResponse: Current state of learning system
    """
    try:
        engine = get_learning_engine()
        status = await engine.get_status()

        logger.info("Learning status retrieved", **status)

        return LearningStatusResponse(**status)

    except Exception as e:
        logger.error("Failed to get learning status", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get status: {str(e)}",
        ) from e


@router.post("/load-from-db")
async def load_patterns_from_database(agent_id: str | None = None) -> dict[str, Any]:
    """
    Load patterns from database into learning engine memory.

    This is useful after patterns have been directly inserted into the database
    (e.g., via inject_failure_patterns.py script).

    Args:
        agent_id: Optional agent ID to filter patterns

    Returns:
        dict: Number of patterns and insights loaded
    """
    try:
        engine = get_learning_engine()

        # Load patterns from database
        patterns_loaded = await engine.load_patterns_from_db(agent_id=agent_id)

        logger.info(
            "Loaded patterns from database",
            patterns_loaded=patterns_loaded,
            agent_id=agent_id,
        )

        return {
            "status": "success",
            "patterns_loaded": patterns_loaded,
            "message": f"Loaded {patterns_loaded} patterns from database",
        }

    except Exception as e:
        logger.error("Failed to load patterns from database", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load patterns: {str(e)}",
        ) from e


@router.post("/test-data/generate")
async def generate_test_data_with_failures(count: int = Query(100, ge=1, le=500)) -> dict[str, Any]:
    """
    Generate realistic test data with failures and performance issues for testing learning engine.

    This endpoint injects test executions directly into the running metrics collector
    so the data is immediately available for pattern extraction and insights.

    Args:
        count: Number of test executions to generate (default: 100, max: 500)

    Returns:
        Summary of generated data with expected patterns
    """
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
        # Random agent
        agent_id, agent_name = random.choice(agents)

        # Random task with its characteristics
        task, success_rate, typical_duration = random.choice(tasks[agent_id])

        # Random time in past 4 hours
        minutes_ago = random.randint(0, 240)
        started_at = (now - timedelta(minutes=minutes_ago)).isoformat()

        # Duration varies ±30%
        duration_ms = int(typical_duration * random.uniform(0.7, 1.3))
        completed_at = (now - timedelta(minutes=minutes_ago) + timedelta(milliseconds=duration_ms)).isoformat()

        # Success based on task's success rate
        status = "completed" if random.random() < success_rate else "failed"

        # Record execution
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

        # Update stats
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

    logger.info(
        "Test data generated",
        total=stats["total"],
        succeeded=stats["succeeded"],
        failed=stats["failed"],
    )

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


# Removed duplicate endpoint - use /insights instead
