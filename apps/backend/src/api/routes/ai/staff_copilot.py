"""Staff Copilot AI API endpoints.

Provides 2 endpoints:
  POST /api/ai/copilot/query   — Main query endpoint
  GET  /api/ai/copilot/health  — Health / status check
"""

from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/ai/copilot", tags=["Staff Copilot"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class CopilotQueryRequest(BaseModel):
    """Request body for a staff copilot query."""

    query: str = Field(..., min_length=1, max_length=2000, description="Staff member's question")
    query_type: str = Field(
        default="general_query",
        description="general_query | summarise_order | summarise_customer | suggest_next_action",
    )
    module_context: str = Field(
        default="general",
        description="Current page context: orders | products | customers | inventory | general",
    )
    entity_id: str | None = Field(
        None,
        description="Entity ID if on a detail view (order_id, customer_id, product_id)",
    )
    conversation_history: list[dict[str, str]] = Field(
        default_factory=list,
        description="Prior messages in the session for multi-turn context",
    )


class CopilotQueryResponse(BaseModel):
    """Response from the staff copilot."""

    answer: str = Field(..., description="AI-generated answer")
    suggested_actions: list[str] = Field(
        default_factory=list,
        description="Contextual quick-action suggestions",
    )
    sources: list[str] = Field(
        default_factory=list,
        description="Data sources used to generate the answer",
    )
    demo_mode: bool = Field(..., description="True when no LLM key is configured")
    query_type: str = Field(..., description="Echo of the query_type received")


class CopilotHealthResponse(BaseModel):
    """Health / status response for the staff copilot."""

    status: str
    agent_id: str
    capabilities: list[str]


# ---------------------------------------------------------------------------
# Singleton factory
# ---------------------------------------------------------------------------


def get_staff_copilot() -> Any:
    """Return the singleton StaffCopilotAgent (lazy import to avoid circular deps)."""
    from src.ai.agents.specialized.staff_copilot_agent import get_staff_copilot_agent

    return get_staff_copilot_agent()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/query", response_model=CopilotQueryResponse)
async def copilot_query(
    request: CopilotQueryRequest,
    agent: Annotated[Any, Depends(get_staff_copilot)],
) -> CopilotQueryResponse:
    """Answer a staff member's operational query.

    Supports multi-turn conversation via conversation_history.
    Falls back to demo mode when no LLM key is configured.
    """
    logger.info(
        "copilot_query_request",
        query_type=request.query_type,
        module_context=request.module_context,
        has_entity=bool(request.entity_id),
        history_len=len(request.conversation_history),
    )

    result = await agent.execute(
        task=request.query,
        context={
            "user_query": request.query,
            "query_type": request.query_type,
            "module_context": request.module_context,
            "entity_id": request.entity_id,
            "conversation_history": request.conversation_history,
        },
    )

    return CopilotQueryResponse(
        answer=result.get("answer", "I was unable to process your query."),
        suggested_actions=result.get("suggested_actions", []),
        sources=result.get("sources", []),
        demo_mode=result.get("demo_mode", True),
        query_type=request.query_type,
    )


@router.get("/health", response_model=CopilotHealthResponse)
async def copilot_health(
    agent: Annotated[Any, Depends(get_staff_copilot)],
) -> CopilotHealthResponse:
    """Return the health and capability status of the staff copilot."""
    return CopilotHealthResponse(
        status="ok",
        agent_id=getattr(agent, "agent_id", "staff-copilot-agent"),
        capabilities=getattr(agent, "capabilities", []),
    )
