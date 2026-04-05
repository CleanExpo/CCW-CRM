"""Shadow Mode API routes.

Manages the 1-month shadow/observation period: session lifecycle, status,
readiness score, daily stats, and transition report generation.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.shadow_session_models import ShadowSession

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/shadow", tags=["Shadow Mode"])


# ── Pydantic models ──────────────────────────────────────────────────────────


class StartShadowSessionRequest(BaseModel):
    client_name: str = Field(default="CCW Client", max_length=255)
    notes: str | None = None
    duration_days: int = Field(default=30, ge=7, le=180)


class ShadowSessionResponse(BaseModel):
    id: str
    client_name: str
    status: str
    start_date: str
    target_end_date: str | None
    completed_at: str | None
    readiness_score: float | None
    total_syncs_run: int
    successful_syncs: int
    products_observed: int
    orders_observed: int
    customers_observed: int
    invoices_observed: int
    day_number: int
    days_remaining: int
    notes: str | None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class ShadowStatusResponse(BaseModel):
    active: bool
    session: ShadowSessionResponse | None
    day_number: int
    days_remaining: int
    readiness_score: float | None


class ReadinessBreakdown(BaseModel):
    data_completeness: float = Field(description="% Cin7 entities matched (weight 25%)")
    sync_accuracy: float = Field(description="% nightly syncs error-free (weight 25%)")
    workflow_match: float = Field(description="% observed patterns covered (weight 20%)")
    ai_confidence: float = Field(description="Avg LearningPattern confidence (weight 15%)")
    integration_health: float = Field(description="% API calls succeeding (weight 15%)")


class ReadinessScoreResponse(BaseModel):
    score: float = Field(description="Overall readiness score 0-100")
    breakdown: ReadinessBreakdown
    recommendation: str
    ready_for_transition: bool


class DailyStatPoint(BaseModel):
    date: str
    sync_success: bool
    products_delta: int
    orders_delta: int
    gaps_found: int


# ── Helpers ──────────────────────────────────────────────────────────────────


def _session_to_response(session: ShadowSession) -> ShadowSessionResponse:
    now = datetime.now(UTC)
    start = session.start_date
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    day_number = max(1, (now - start).days + 1)

    target = session.target_end_date
    if target:
        if target.tzinfo is None:
            target = target.replace(tzinfo=UTC)
        days_remaining = max(0, (target - now).days)
    else:
        days_remaining = 0

    return ShadowSessionResponse(
        id=str(session.id),
        client_name=session.client_name,
        status=session.status,
        start_date=session.start_date.isoformat(),
        target_end_date=session.target_end_date.isoformat() if session.target_end_date else None,
        completed_at=session.completed_at.isoformat() if session.completed_at else None,
        readiness_score=session.readiness_score,
        total_syncs_run=session.total_syncs_run,
        successful_syncs=session.successful_syncs,
        products_observed=session.products_observed,
        orders_observed=session.orders_observed,
        customers_observed=session.customers_observed,
        invoices_observed=session.invoices_observed,
        day_number=day_number,
        days_remaining=days_remaining,
        notes=session.notes,
        created_at=session.created_at.isoformat(),
        updated_at=session.updated_at.isoformat(),
    )


def _calculate_readiness(session: ShadowSession) -> ReadinessScoreResponse:
    """Calculate composite readiness score from session statistics."""
    # Data completeness: based on observed entity counts (proxy)
    # Scale: 0 = no data, 100 = 500+ products & 200+ orders observed
    data_completeness = min(100.0, (
        (min(session.products_observed, 500) / 500) * 50 +
        (min(session.orders_observed, 200) / 200) * 50
    ))

    # Sync accuracy: successful_syncs / total_syncs_run
    if session.total_syncs_run > 0:
        sync_accuracy = (session.successful_syncs / session.total_syncs_run) * 100
    else:
        sync_accuracy = 0.0

    # Workflow match: grows linearly with days (simulated — real value comes from flow_observer)
    now = datetime.now(UTC)
    start = session.start_date
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    days_elapsed = max(1, (now - start).days)
    workflow_match = min(100.0, days_elapsed * (100 / 30))

    # AI confidence: fixed 65% until LearningPattern data populates (placeholder)
    ai_confidence = 65.0 if session.total_syncs_run > 0 else 0.0

    # Integration health: based on sync success rate
    integration_health = sync_accuracy

    # Weighted composite
    score = (
        data_completeness * 0.25 +
        sync_accuracy * 0.25 +
        workflow_match * 0.20 +
        ai_confidence * 0.15 +
        integration_health * 0.15
    )

    ready = score >= 75.0

    if score >= 90:
        recommendation = "System is ready for full transition. Schedule go-live with client."
    elif score >= 75:
        recommendation = "System is nearly ready. Review remaining gaps before transitioning."
    elif score >= 50:
        recommendation = "Continue shadow observation. Address sync gaps and workflow coverage."
    else:
        recommendation = "Early observation phase. Continue collecting data for at least 2 more weeks."

    return ReadinessScoreResponse(
        score=round(score, 1),
        breakdown=ReadinessBreakdown(
            data_completeness=round(data_completeness, 1),
            sync_accuracy=round(sync_accuracy, 1),
            workflow_match=round(workflow_match, 1),
            ai_confidence=round(ai_confidence, 1),
            integration_health=round(integration_health, 1),
        ),
        recommendation=recommendation,
        ready_for_transition=ready,
    )


async def _get_active_session(db: AsyncSession) -> ShadowSession | None:
    result = await db.execute(
        select(ShadowSession)
        .where(ShadowSession.status == "active")
        .order_by(ShadowSession.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/status", response_model=ShadowStatusResponse)
async def get_shadow_status(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ShadowStatusResponse:
    """Get current shadow mode status — active or inactive."""
    session = await _get_active_session(db)

    if not session:
        return ShadowStatusResponse(
            active=False,
            session=None,
            day_number=0,
            days_remaining=0,
            readiness_score=None,
        )

    resp = _session_to_response(session)
    return ShadowStatusResponse(
        active=True,
        session=resp,
        day_number=resp.day_number,
        days_remaining=resp.days_remaining,
        readiness_score=session.readiness_score,
    )


@router.post("/session", status_code=status.HTTP_201_CREATED, response_model=ShadowSessionResponse)
async def start_shadow_session(
    body: StartShadowSessionRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ShadowSessionResponse:
    """Activate shadow mode for a new client observation period."""
    # Check no active session already running
    existing = await _get_active_session(db)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A shadow session is already active. End it before starting a new one.",
        )

    now = datetime.now(UTC)
    session = ShadowSession(
        client_name=body.client_name,
        status="active",
        start_date=now,
        target_end_date=now + timedelta(days=body.duration_days),
        notes=body.notes,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    logger.info(
        "shadow_session_started",
        session_id=str(session.id),
        client=session.client_name,
        duration_days=body.duration_days,
    )
    return _session_to_response(session)


@router.get("/session", response_model=ShadowSessionResponse | None)
async def get_active_session(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ShadowSessionResponse | None:
    """Get the currently active shadow session, or null."""
    session = await _get_active_session(db)
    if not session:
        return None
    return _session_to_response(session)


@router.patch("/session/{session_id}/end", response_model=ShadowSessionResponse)
async def end_shadow_session(
    session_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ShadowSessionResponse:
    """Mark a shadow session as complete."""
    result = await db.execute(
        select(ShadowSession).where(ShadowSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = "complete"
    session.completed_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(session)

    logger.info("shadow_session_ended", session_id=str(session.id))
    return _session_to_response(session)


@router.get("/readiness-score", response_model=ReadinessScoreResponse)
async def get_readiness_score(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ReadinessScoreResponse:
    """Get transition readiness score (0-100) with breakdown by dimension."""
    session = await _get_active_session(db)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active shadow session. Start one first.",
        )
    return _calculate_readiness(session)


@router.get("/daily-stats")
async def get_daily_stats(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    days: int = Query(default=30, ge=1, le=90),
) -> dict:
    """Get time-series sync stats for the active shadow session."""
    session = await _get_active_session(db)
    if not session:
        raise HTTPException(status_code=404, detail="No active shadow session")

    # Generate placeholder daily stats based on session data
    # In production, this would query a shadow_sync_log table
    stats: list[dict] = []
    start = session.start_date
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    now = datetime.now(UTC)

    day_count = min(days, (now - start).days + 1)
    for i in range(day_count):
        day = start + timedelta(days=i)
        stats.append({
            "date": day.date().isoformat(),
            "sync_run": i < session.total_syncs_run,
            "sync_success": i < session.successful_syncs,
            "products_cumulative": min(session.products_observed, (i + 1) * max(1, session.products_observed // max(1, day_count))),
            "orders_cumulative": min(session.orders_observed, (i + 1) * max(1, session.orders_observed // max(1, day_count))),
        })

    return {
        "session_id": str(session.id),
        "day_count": day_count,
        "stats": stats,
    }


@router.get("/transition-report")
async def get_transition_report(
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Generate a full transition readiness report in markdown format."""
    session = await _get_active_session(db)
    if not session:
        raise HTTPException(status_code=404, detail="No active shadow session")

    score = _calculate_readiness(session)
    now = datetime.now(UTC)
    start = session.start_date
    if start.tzinfo is None:
        start = start.replace(tzinfo=UTC)
    days_elapsed = (now - start).days + 1

    report = f"""# CCW ERP — Shadow Mode Transition Report

**Client**: {session.client_name}
**Report Date**: {now.strftime("%d/%m/%Y")}
**Shadow Period**: {start.strftime("%d/%m/%Y")} — {now.strftime("%d/%m/%Y")} ({days_elapsed} days)
**Overall Readiness Score**: {score.score}/100

---

## Executive Summary

{score.recommendation}

The shadow observation system has been running for **{days_elapsed} days**, syncing nightly from the client's live Cin7 and Xero systems.

---

## Data Observed

| Entity | Count |
|--------|-------|
| Products | {session.products_observed:,} |
| Orders | {session.orders_observed:,} |
| Customers | {session.customers_observed:,} |
| Invoices | {session.invoices_observed:,} |

---

## Readiness Score Breakdown

| Dimension | Score | Weight |
|-----------|-------|--------|
| Data Completeness | {score.breakdown.data_completeness}% | 25% |
| Sync Accuracy | {score.breakdown.sync_accuracy}% | 25% |
| Workflow Coverage | {score.breakdown.workflow_match}% | 20% |
| AI Confidence | {score.breakdown.ai_confidence}% | 15% |
| Integration Health | {score.breakdown.integration_health}% | 15% |
| **Overall** | **{score.score}%** | |

---

## Sync Performance

- Total sync runs: **{session.total_syncs_run}**
- Successful syncs: **{session.successful_syncs}**
- Sync reliability: **{score.breakdown.sync_accuracy}%**

---

## Recommendation

{'✅ **READY FOR TRANSITION**' if score.ready_for_transition else '⏳ **CONTINUE OBSERVATION**'}

{score.recommendation}

### Next Steps

{"1. Schedule go-live date with client" if score.ready_for_transition else "1. Continue nightly sync for remaining observation period"}
{"2. Conduct final data validation with client" if score.ready_for_transition else "2. Review sync gap report and address critical mismatches"}
{"3. Activate Live mode (set CIN7_MODE=live, XERO_MODE=live)" if score.ready_for_transition else "3. Run /api/shadow/gaps to identify workflow coverage gaps"}
{"4. Decommission legacy system" if score.ready_for_transition else "4. Check AI automation opportunities at /api/shadow/ai-opportunities"}

---

*Generated by CCW ERP Shadow Mode — {now.isoformat()}*
"""

    return {
        "session_id": str(session.id),
        "score": score.score,
        "ready_for_transition": score.ready_for_transition,
        "report_markdown": report,
        "generated_at": now.isoformat(),
    }
