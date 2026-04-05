"""Autonomous ERP Operations API endpoints.

Provides Claude Sonnet 4.6-powered autonomous decision-making for:
  • Low-stock → draft purchase orders
  • Overdue invoices → payment reminders / escalation
  • Unmatched bank transactions → flagging
  • SLA breaches → manager notifications

POST /api/ai/autonomous/run   — trigger a manual autonomous ops run
GET  /api/ai/autonomous/log   — retrieve decision audit trail
GET  /api/ai/autonomous/health — agent health check
"""

from __future__ import annotations

from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.ai.agents.specialized.autonomous_ops_agent import (
    AutonomousOpsAgent,
    get_audit_log,
)
from src.config.database import get_async_db

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/ai/autonomous", tags=["Autonomous Ops"])

# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_agent: AutonomousOpsAgent | None = None


def _get_agent() -> AutonomousOpsAgent:
    global _agent
    if _agent is None:
        _agent = AutonomousOpsAgent()
    return _agent


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class RunRequest(BaseModel):
    trigger: str = Field(
        default="manual",
        description="manual | scheduled_hourly | scheduled_6h | low_stock_alert",
    )
    dry_run: bool = Field(
        default=True,
        description="If True, actions are recommended only — not executed",
    )


class ActionRecord(BaseModel):
    action_id: str
    action_type: str
    entity_type: str
    entity_id: str
    description: str
    confidence: float
    status: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str


class RunResponse(BaseModel):
    run_id: str
    trigger: str
    model: str
    started_at: str
    completed_at: str
    actions_evaluated: int
    actions_taken: int
    actions: list[ActionRecord]
    summary: str


class AuditLogResponse(BaseModel):
    total: int
    runs: list[dict[str, Any]]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/run", response_model=RunResponse)
async def run_autonomous_ops(
    payload: RunRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> RunResponse:
    """
    Trigger a manual autonomous ops evaluation.

    The agent reviews ERP state (inventory, invoices, bank feeds, SLA) and
    returns a set of recommended or executed actions with confidence scores.

    In demo mode (no ANTHROPIC_API_KEY), returns realistic mock data.
    """
    agent = _get_agent()
    result = await agent.execute(
        task="run",
        context={"trigger": payload.trigger, "dry_run": payload.dry_run, "db": db},
    )
    logger.info("Autonomous ops run completed", run_id=result.get("run_id"), actions=result.get("actions_taken"))
    return RunResponse(**result)


@router.get("/log", response_model=AuditLogResponse)
async def get_autonomous_log(
    limit: int = Query(50, ge=1, le=200, description="Max log entries to return"),
) -> AuditLogResponse:
    """
    Retrieve the autonomous ops decision audit trail.

    Returns the most recent runs with all actions, confidence scores,
    and execution status.
    """
    log = get_audit_log()[:limit]
    return AuditLogResponse(total=len(log), runs=log)


@router.get("/health")
async def autonomous_ops_health() -> dict[str, Any]:
    """Return health/status of the autonomous ops agent."""
    import os

    return {
        "status": "healthy",
        "agent": "AutonomousOpsAgent",
        "model": "claude-sonnet-4-6",
        "mode": "production" if os.getenv("ANTHROPIC_API_KEY") else "demo",
        "capabilities": [
            "create_draft_purchase_order",
            "send_payment_reminder",
            "escalate_to_collections",
            "flag_unmatched_transaction",
            "notify_manager_sla_breach",
        ],
    }
