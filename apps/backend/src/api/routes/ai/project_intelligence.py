"""
Project Intelligence Agent API Routes

Exposes the 10 PI agent skills as HTTP endpoints.
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.ai.agents.specialized.project_intelligence_agent import (
    ProjectIntelligenceAgent,
    ScanResult,
    PrioritizedGap,
)

logger = structlog.get_logger(__name__)

router = APIRouter(
    prefix="/api/ai/project-intelligence",
    tags=["Project Intelligence"],
)

# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_agent: ProjectIntelligenceAgent | None = None


def get_agent() -> ProjectIntelligenceAgent:
    """Get or create Project Intelligence agent singleton."""
    global _agent
    if _agent is None:
        _agent = ProjectIntelligenceAgent()
        logger.info("Project Intelligence agent initialized")
    return _agent


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class PrdGenerateRequest(BaseModel):
    title: str = Field(default="CCW Gap Resolution", description="PRD document title")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/health")
async def health() -> dict:
    """Skill 10: Agent health check — verifies catalogs and dependencies."""
    try:
        return await get_agent().health()
    except Exception as e:
        logger.error("pi_health_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Health check failed: {e}") from e


@router.post("/scan-routes", response_model=ScanResult)
async def scan_routes() -> ScanResult:
    """Skill 1: Scan backend route files and update ROUTES catalog."""
    try:
        return await get_agent().scan_routes()
    except Exception as e:
        logger.error("pi_scan_routes_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"scan_routes failed: {e}") from e


@router.post("/scan-pages", response_model=ScanResult)
async def scan_pages() -> ScanResult:
    """Skill 2: Scan frontend pages and update PAGES catalog."""
    try:
        return await get_agent().scan_pages()
    except Exception as e:
        logger.error("pi_scan_pages_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"scan_pages failed: {e}") from e


@router.post("/scan-agents", response_model=ScanResult)
async def scan_agents() -> ScanResult:
    """Skill 3: Scan AI agents and check 1:10 skill compliance."""
    try:
        return await get_agent().scan_agents()
    except Exception as e:
        logger.error("pi_scan_agents_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"scan_agents failed: {e}") from e


@router.post("/scan-packages", response_model=ScanResult)
async def scan_packages() -> ScanResult:
    """Skill 4: Audit package manifests and flag issues."""
    try:
        return await get_agent().scan_packages()
    except Exception as e:
        logger.error("pi_scan_packages_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"scan_packages failed: {e}") from e


@router.post("/cross-ref")
async def cross_ref() -> dict:
    """Skill 5: Cross-reference routes, pages, and API clients to find orphans."""
    try:
        return await get_agent().cross_ref()
    except Exception as e:
        logger.error("pi_cross_ref_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"cross_ref failed: {e}") from e


@router.post("/dep-graph")
async def dep_graph() -> dict:
    """Skill 6: Build text component dependency graph from catalogs."""
    try:
        return await get_agent().dep_graph()
    except Exception as e:
        logger.error("pi_dep_graph_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"dep_graph failed: {e}") from e


@router.post("/prioritize")
async def prioritize() -> list[dict]:
    """Skill 7: Score gaps by impact x effort and return priority matrix."""
    try:
        gaps = await get_agent().prioritize()
        return [g.model_dump() for g in gaps]
    except Exception as e:
        logger.error("pi_prioritize_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"prioritize failed: {e}") from e


@router.post("/prd-generate")
async def prd_generate(request: PrdGenerateRequest) -> dict:
    """Skill 8: Generate PRD from gap findings and write to docs/."""
    try:
        return await get_agent().prd_generate(title=request.title)
    except Exception as e:
        logger.error("pi_prd_generate_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"prd_generate failed: {e}") from e


@router.post("/issue-sync")
async def issue_sync() -> dict:
    """Skill 9: Prepare issues for Linear (structured data for browser automation)."""
    try:
        return await get_agent().issue_sync()
    except Exception as e:
        logger.error("pi_issue_sync_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"issue_sync failed: {e}") from e
