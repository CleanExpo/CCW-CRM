"""Cin7 Shadow AI endpoints.

Exposes the Cin7ShadowAgent for gap analysis and auto-resolution.

UNI-1262: Shadow Transition System Phase C
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.agents.specialized.cin7_shadow_agent import Cin7ShadowAgent
from src.config.database import get_async_db

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/ai/shadow", tags=["Cin7 Shadow AI"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class EntitySummaryItem(BaseModel):
    """A single row from the gap entity+severity breakdown."""

    entity_type: str
    severity: str
    count: int


class RecommendationItem(BaseModel):
    """A single AI-generated recommendation."""

    entity_type: str
    gap_count: int
    priority: int = Field(description="0=ok, 1=critical, 2=high, 3=normal")
    recommendation: str


class ShadowAiAnalysisResponse(BaseModel):
    """Full analysis response from GET /api/ai/shadow/analyze."""

    entity_summary: list[EntitySummaryItem]
    total_gaps: int
    critical_count: int
    recommendations: list[RecommendationItem]
    analyzed_at: str


class AutoResolveRequest(BaseModel):
    """Body for POST /api/ai/shadow/auto-resolve."""

    days_old: int = Field(default=7, ge=1, le=365)


class AutoResolveResponse(BaseModel):
    """Response from POST /api/ai/shadow/auto-resolve."""

    resolved_count: int
    message: str
    resolved_at: str


# ---------------------------------------------------------------------------
# Singleton agent
# ---------------------------------------------------------------------------

_cin7_shadow_agent: Cin7ShadowAgent | None = None


def get_cin7_shadow_agent() -> Cin7ShadowAgent:
    """Get or create the Cin7ShadowAgent singleton."""
    global _cin7_shadow_agent
    if _cin7_shadow_agent is None:
        _cin7_shadow_agent = Cin7ShadowAgent()
        logger.info("cin7_shadow_agent_initialized")
    return _cin7_shadow_agent


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/analyze", response_model=ShadowAiAnalysisResponse)
async def analyze_shadow_gaps(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ShadowAiAnalysisResponse:
    """Analyse current Cin7 sync gaps and return prioritised recommendations.

    Queries the Cin7SyncGap table, groups results by entity type + severity,
    and applies heuristics to generate actionable recommendations.

    Falls back to realistic demo data when the database contains no open gaps.
    """
    logger.info("cin7_shadow_ai_analyze_requested")

    try:
        agent = get_cin7_shadow_agent()
        analysis = await agent.analyze_gaps(db)
        recommendations = await agent.generate_recommendations(analysis)

        return ShadowAiAnalysisResponse(
            entity_summary=[
                EntitySummaryItem(
                    entity_type=item["entity_type"],
                    severity=item["severity"],
                    count=item["count"],
                )
                for item in analysis.get("entity_summary", [])
            ],
            total_gaps=analysis.get("total_gaps", 0),
            critical_count=analysis.get("critical_count", 0),
            recommendations=[
                RecommendationItem(
                    entity_type=rec["entity_type"],
                    gap_count=rec["gap_count"],
                    priority=rec["priority"],
                    recommendation=rec["recommendation"],
                )
                for rec in recommendations
            ],
            analyzed_at=analysis.get("analyzed_at", datetime.now(UTC).isoformat()),
        )

    except Exception as e:
        logger.error("cin7_shadow_ai_analyze_failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Gap analysis failed: {e}",
        ) from e


@router.post("/auto-resolve", response_model=AutoResolveResponse)
async def auto_resolve_stale_gaps(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    body: AutoResolveRequest = AutoResolveRequest(),  # noqa: B008
) -> AutoResolveResponse:
    """Auto-resolve open gaps that have been stale for longer than `days_old` days.

    Marks matching Cin7SyncGap rows as 'resolved' with a standard
    resolution note. Returns the number of gaps resolved.
    """
    logger.info(
        "cin7_shadow_ai_auto_resolve_requested",
        days_old=body.days_old,
    )

    try:
        agent = get_cin7_shadow_agent()
        resolved_count = await agent.auto_resolve_stale(db, body.days_old)

        noun = "gap" if resolved_count == 1 else "gaps"
        message = (
            f"Auto-resolved {resolved_count} stale {noun} "
            f"(open with no changes for >{body.days_old} days)"
            if resolved_count > 0
            else f"No stale gaps found older than {body.days_old} days"
        )

        return AutoResolveResponse(
            resolved_count=resolved_count,
            message=message,
            resolved_at=datetime.now(UTC).isoformat(),
        )

    except Exception as e:
        logger.error("cin7_shadow_ai_auto_resolve_failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Auto-resolve failed: {e}",
        ) from e


@router.get("/health")
async def get_shadow_ai_health() -> dict[str, str]:
    """Return health status for the Cin7 Shadow AI agent."""
    agent = get_cin7_shadow_agent()
    return {
        "status": "healthy",
        "agent": agent.name,
        "version": Cin7ShadowAgent.version,
    }
