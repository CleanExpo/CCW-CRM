"""Cin7 Anomaly Detection API endpoints."""
from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.ai.agents.specialized.cin7_anomaly_agent import (
    Cin7AnomalyAgent,
    calculate_sync_health_score,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/ai/cin7-anomaly", tags=["Cin7 AI Anomaly Detection"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class Cin7AnomalyRequest(BaseModel):
    """Request for Cin7 anomaly detection."""

    detection_type: str = Field(
        default="all",
        description="Type: 'sync_anomalies', 'data_quality', 'mapping_coverage', 'all'",
    )
    source: str = Field(
        default="core",
        description="Cin7 source: 'core' or 'omni'",
    )


class SyncHealthResponse(BaseModel):
    """Sync health score response."""

    score: int = Field(ge=0, le=100, description="Health score 0-100")
    grade: str = Field(description="Letter grade: A, B, C, D, F")
    details: dict = Field(description="Breakdown of score components")


class Cin7AnomalyResponse(BaseModel):
    """Response from Cin7 anomaly detection."""

    has_anomalies: bool = Field(description="Whether any anomalies detected")
    sync_anomalies: dict | None = Field(default=None, description="Sync frequency anomalies")
    data_quality: dict | None = Field(default=None, description="Data quality results")
    mapping_coverage: dict | None = Field(default=None, description="Mapping coverage results")
    error: str | None = Field(default=None, description="Error message if any")


# ---------------------------------------------------------------------------
# Singleton agent
# ---------------------------------------------------------------------------

_cin7_anomaly_agent: Cin7AnomalyAgent | None = None


def get_cin7_anomaly_agent() -> Cin7AnomalyAgent:
    """Get or create Cin7 anomaly agent singleton."""
    global _cin7_anomaly_agent
    if _cin7_anomaly_agent is None:
        _cin7_anomaly_agent = Cin7AnomalyAgent()
        logger.info("Cin7 anomaly agent initialized for API")
    return _cin7_anomaly_agent


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=Cin7AnomalyResponse)
async def detect_cin7_anomalies(
    request: Cin7AnomalyRequest,
) -> Cin7AnomalyResponse:
    """Run anomaly detection on Cin7 sync data.

    Checks for sync frequency spikes/gaps, data quality issues,
    and mapping coverage gaps.
    """
    logger.info(
        "cin7_anomaly_detection_requested",
        detection_type=request.detection_type,
        source=request.source,
    )

    try:
        agent = get_cin7_anomaly_agent()
        result = await agent.execute(
            task=f"Detect Cin7 anomalies ({request.detection_type})",
            context={
                "detection_type": request.detection_type,
                "source": request.source,
            },
        )

        if result.get("error"):
            raise HTTPException(status_code=500, detail=result["error"])

        return Cin7AnomalyResponse(
            has_anomalies=result.get("has_anomalies", False),
            sync_anomalies=result.get("sync_anomalies"),
            data_quality=result.get("data_quality"),
            mapping_coverage=result.get("mapping_coverage"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("cin7_anomaly_detection_failed", error=str(e))
        raise HTTPException(
            status_code=500, detail=f"Anomaly detection failed: {e}"
        ) from e


@router.get("/sync-health", response_model=SyncHealthResponse)
async def get_cin7_sync_health() -> SyncHealthResponse:
    """Get overall Cin7 sync health score.

    Returns a 0-100 score with letter grade based on success rate,
    sync duration, and volume.
    """
    try:
        agent = get_cin7_anomaly_agent()
        result = await agent.execute(
            task="Check sync health",
            context={"detection_type": "data_quality"},
        )

        health = result.get("data_quality", {})
        return SyncHealthResponse(
            score=health.get("score", 0),
            grade=health.get("grade", "F"),
            details=health.get("details", {}),
        )

    except Exception as e:
        logger.error("cin7_sync_health_failed", error=str(e))
        raise HTTPException(
            status_code=500, detail=f"Health check failed: {e}"
        ) from e


@router.get("/health")
async def get_cin7_anomaly_health() -> dict:
    """Check Cin7 anomaly detection agent health."""
    agent = get_cin7_anomaly_agent()
    report = await agent.health_check()
    return {
        "agent_id": report.agent_id,
        "status": report.status.value if hasattr(report.status, "value") else str(report.status),
        "checks_passed": report.checks_passed,
        "checks_failed": report.checks_failed,
        "response_time_ms": report.response_time_ms,
    }
