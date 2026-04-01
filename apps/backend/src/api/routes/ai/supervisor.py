"""Supervisor agent API endpoints."""

from typing import Any

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.ai.orchestration.supervisor_agent import get_supervisor_agent

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/supervisor", tags=["AI Supervisor"])


# Request/Response Models
class RouteTaskRequest(BaseModel):
    """Request to route a task through the supervisor."""

    task: str = Field(description="Task description", min_length=1, max_length=2000)
    context: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional context for task execution",
    )


class RouteTaskResponse(BaseModel):
    """Response from task routing."""

    execution_id: str
    selected_agent: str
    status: str
    final_result: dict[str, Any]
    metadata: dict[str, Any] = Field(default_factory=dict)


class AnalyzeTaskRequest(BaseModel):
    """Request to analyze task intent without execution."""

    task: str = Field(description="Task description to analyze", min_length=1, max_length=2000)


class AnalyzeTaskResponse(BaseModel):
    """Response from task analysis."""

    task: str
    intent_classification: dict[str, Any]
    recommended_agent: str
    confidence: float
    reasoning: str


@router.post("/route", response_model=RouteTaskResponse)
async def route_task(request: RouteTaskRequest) -> RouteTaskResponse:
    """
    Route a task to the appropriate specialized agent via the supervisor.

    The supervisor will:
    1. Classify the task intent
    2. Select the best agent based on capabilities
    3. Execute the task through the selected agent
    4. Return results with metadata

    Args:
        request: Task routing request with task description and context

    Returns:
        RouteTaskResponse: Execution results including selected agent and output

    Raises:
        HTTPException: If routing fails or task execution encounters errors
    """
    logger.info(
        "Routing task through supervisor",
        task_preview=request.task[:100],
        has_context=bool(request.context),
    )

    try:
        supervisor = get_supervisor_agent()

        # Execute task through supervisor
        result = await supervisor.execute(
            task=request.task,
            context=request.context,
        )

        # Check for execution errors
        if result.get("status") == "failed":
            error_msg = result.get("error", "Task execution failed")
            logger.error(
                "Task execution failed",
                task=request.task[:100],
                error=error_msg,
            )
            raise HTTPException(
                status_code=500,
                detail=f"Task execution failed: {error_msg}",
            )

        logger.info(
            "Task routed successfully",
            selected_agent=result.get("selected_agent"),
            status=result.get("status"),
        )

        return RouteTaskResponse(
            execution_id=result.get("execution_id", "unknown"),
            selected_agent=result.get("selected_agent", "unknown"),
            status=result.get("status", "completed"),
            final_result=result.get("final_result", {}),
            metadata={
                "intent": result.get("intent", {}),
                "execution_time_ms": result.get("execution_time_ms"),
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Supervisor routing failed",
            task=request.task[:100],
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to route task: {str(e)}",
        ) from e


@router.post("/analyze", response_model=AnalyzeTaskResponse)
async def analyze_task(request: AnalyzeTaskRequest) -> AnalyzeTaskResponse:
    """
    Analyze task intent without executing it.

    This endpoint classifies the task and recommends an agent,
    but does NOT execute the task. Useful for:
    - Understanding which agent would handle a task
    - Debugging routing logic
    - Validating task descriptions before execution

    Args:
        request: Task analysis request with task description

    Returns:
        AnalyzeTaskResponse: Intent classification and agent recommendation

    Raises:
        HTTPException: If analysis fails
    """
    logger.info("Analyzing task intent", task_preview=request.task[:100])

    try:
        supervisor = get_supervisor_agent()

        # Classify intent (without execution)
        intent = await supervisor.classify_intent(request.task)

        # Find recommended agent based on intent
        recommended_agent = "unknown"
        confidence = 0.0
        reasoning = "No agent found matching intent"

        if intent.get("primary_capability"):
            from src.ai.orchestration import get_agent_registry

            registry = get_agent_registry()
            capability = intent["primary_capability"]

            # Find agent with this capability
            all_agents = registry.get_all_agents()
            agent_ids = [agent_id for agent_id, _, _ in all_agents]
            for agent_id in agent_ids:
                metadata = registry.get_metadata(agent_id)
                if metadata and capability in metadata.capabilities:
                    recommended_agent = agent_id
                    confidence = intent.get("confidence", 0.0)
                    reasoning = f"Agent '{agent_id}' has capability '{capability}'"
                    break

        logger.info(
            "Task analyzed",
            recommended_agent=recommended_agent,
            confidence=confidence,
        )

        return AnalyzeTaskResponse(
            task=request.task,
            intent_classification=intent,
            recommended_agent=recommended_agent,
            confidence=confidence,
            reasoning=reasoning,
        )

    except Exception as e:
        logger.error(
            "Task analysis failed",
            task=request.task[:100],
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze task: {str(e)}",
        ) from e
