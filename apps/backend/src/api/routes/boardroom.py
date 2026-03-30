"""CCW Boardroom AI Session endpoint.

Called by the Vercel cron 4x daily. Orchestrates a board-level review
session where each board member (CEO/CTO/CSO/CMO/CFO/COO) evaluates
the system state and posts their verdict.

Each member maps to a gstack command and a Superpowers skill:
  CEO -> /ceo  + writing-plans + brainstorming
  CTO -> /cto  + subagent-driven-development + test-driven-development
  CSO -> /cso  + systematic-debugging + verification-before-completion
  CMO -> /cmo  + brainstorming + writing-skills
  CFO -> /cfo  + executing-plans + finishing-a-development-branch
  COO -> /coo  + dispatching-parallel-agents + using-git-worktrees
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from src.config import get_settings

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/boardroom", tags=["Boardroom"])

settings = get_settings()

BOARD_MEMBERS = [
    {"role": "CEO", "gstack_cmd": "/ceo", "superpowers": ["writing-plans", "brainstorming"], "focus": "Strategic direction, go/no-go on features"},
    {"role": "CTO", "gstack_cmd": "/cto", "superpowers": ["subagent-driven-development", "test-driven-development"], "focus": "Technical quality, architecture, test coverage"},
    {"role": "CSO", "gstack_cmd": "/cso", "superpowers": ["systematic-debugging", "verification-before-completion"], "focus": "Security, RLS policies, API auth, data integrity"},
    {"role": "CMO", "gstack_cmd": "/cmo", "superpowers": ["brainstorming", "writing-skills"], "focus": "Customer-facing copy, landing page, integrations UX"},
    {"role": "CFO", "gstack_cmd": "/cfo", "superpowers": ["executing-plans", "finishing-a-development-branch"], "focus": "Billing, Stripe, financial reports, BAS compliance"},
    {"role": "COO", "gstack_cmd": "/coo", "superpowers": ["dispatching-parallel-agents", "using-git-worktrees"], "focus": "Cron jobs, nightly sync, deployment health, integrations uptime"},
]


class BoardroomSessionResponse(BaseModel):
    sessionId: str
    buildStatus: str
    timestamp: str
    members: list[dict]
    pre_session: dict
    post_session: dict
    youtubeVideoId: str | None = None


def _check_cron_secret(authorization: str | None) -> None:
    """Validate the CRON_SECRET Bearer token."""
    cron_secret = settings.cron_secret if hasattr(settings, "cron_secret") else None
    if not cron_secret:
        return  # No secret configured — allow in dev
    expected = f"Bearer {cron_secret}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Invalid CRON_SECRET")


@router.post("/session", response_model=BoardroomSessionResponse)
async def boardroom_session(
    authorization: Annotated[str | None, Header()] = None,
) -> BoardroomSessionResponse:
    """Run a boardroom session.

    Pre-session: competitor research context (gstack /browse equivalent)
    Board review: each member evaluates via their gstack command + Superpowers skill
    Post-session: QA check (gstack /qa) + retro (gstack /retro)

    In production, this orchestrates Claude subagents. In MVP, it returns
    a structured session record that Claude Code sessions can act on.
    """
    _check_cron_secret(authorization)

    session_id = str(uuid.uuid4())
    now = datetime.now(UTC).isoformat()

    logger.info("Boardroom session started", session_id=session_id)

    # Pre-session context (gstack /browse equivalent)
    pre_session = {
        "gstack_cmd": "/browse",
        "purpose": "Competitive landscape + market intelligence before board review",
        "status": "queued",
        "skills": ["using-superpowers"],
    }

    # Board member review log
    member_results = []
    for member in BOARD_MEMBERS:
        member_results.append({
            "role": member["role"],
            "gstack_cmd": member["gstack_cmd"],
            "superpowers_skills": member["superpowers"],
            "focus": member["focus"],
            "status": "queued",
            "verdict": None,
        })

    # Post-session (gstack /qa + /retro)
    post_session = {
        "qa": {"gstack_cmd": "/qa", "status": "queued", "skills": ["verification-before-completion"]},
        "retro": {"gstack_cmd": "/retro", "status": "queued", "skills": ["finishing-a-development-branch"]},
    }

    logger.info(
        "Boardroom session queued",
        session_id=session_id,
        members=[m["role"] for m in BOARD_MEMBERS],
    )

    return BoardroomSessionResponse(
        sessionId=session_id,
        buildStatus="QUEUED",
        timestamp=now,
        members=member_results,
        pre_session=pre_session,
        post_session=post_session,
        youtubeVideoId=None,
    )


@router.get("/members")
async def list_board_members() -> dict:
    """Return the board member configuration with gstack + Superpowers bindings."""
    return {
        "members": BOARD_MEMBERS,
        "session_flow": [
            "1. Pre-session: /browse (competitive research)",
            "2. CEO review: /ceo + writing-plans",
            "3. CTO review: /cto + test-driven-development",
            "4. CSO review: /cso + verification-before-completion",
            "5. CMO review: /cmo + brainstorming",
            "6. CFO review: /cfo + executing-plans",
            "7. COO review: /coo + dispatching-parallel-agents",
            "8. Post-session QA: /qa + verification-before-completion",
            "9. Post-session retro: /retro + finishing-a-development-branch",
        ],
    }
