"""
Requirement Verification API

Provides endpoints for verifying that implementation satisfies requirements.
Uses RequirementTracer service to establish traceability.

Endpoints:
  POST /api/ai/autonomous/verify-requirements/{task_id} - Generate traceability matrix
  GET /api/ai/autonomous/verify-requirements/{task_id} - Get existing matrix
"""
from __future__ import annotations

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.services.requirement_tracer import TraceabilityMatrix, get_tracer

logger = structlog.get_logger(__name__)

router = APIRouter(
    prefix="/api/ai/autonomous/verify-requirements",
    tags=["Requirement Verification"],
)


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class VerifyRequirementsResponse(BaseModel):
    """Response from POST /verify-requirements/{task_id}."""

    task_id: str
    matrix: TraceabilityMatrix
    message: str


class GetMatrixResponse(BaseModel):
    """Response from GET /verify-requirements/{task_id}."""

    task_id: str
    exists: bool
    matrix: TraceabilityMatrix | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/{task_id}")
async def verify_requirements(task_id: str) -> VerifyRequirementsResponse:
    """
    Verify that implementation satisfies requirements.

    Generates a traceability matrix mapping SHOULD SEE items from the build spec
    to implementation files. Uses LLM-based analysis to match requirements to code.

    Example:
        POST /api/ai/autonomous/verify-requirements/build_20260323_143000

    Returns:
        VerifyRequirementsResponse with traceability matrix

    Raises:
        HTTPException 404: If build spec not found
        HTTPException 400: If build spec has no requirements
        HTTPException 500: If verification fails
    """
    logger.info("Verifying requirements", task_id=task_id)

    try:
        tracer = get_tracer()
        matrix = await tracer.trace_requirements(task_id)

        # Generate summary message
        if matrix.coverage_percentage == 100.0:
            message = f"All {matrix.total_requirements} requirements have been mapped to implementation files."
        else:
            message = (
                f"{matrix.verified_count}/{matrix.total_requirements} requirements verified "
                f"({matrix.coverage_percentage:.1f}% coverage)."
            )

        logger.info(
            "Requirements verified",
            task_id=task_id,
            total=matrix.total_requirements,
            verified=matrix.verified_count,
            coverage=matrix.coverage_percentage,
        )

        return VerifyRequirementsResponse(
            task_id=task_id,
            matrix=matrix,
            message=message,
        )

    except FileNotFoundError as e:
        logger.warning("Build spec not found", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=404,
            detail=f"Build spec not found for task '{task_id}'",
        ) from e
    except ValueError as e:
        logger.warning("Invalid build spec", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=400,
            detail=str(e),
        ) from e
    except Exception as e:
        logger.error("Failed to verify requirements", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to verify requirements",
        ) from e


@router.get("/{task_id}")
async def get_traceability_matrix(task_id: str) -> GetMatrixResponse:
    """
    Get existing traceability matrix for a build task.

    Reads the saved matrix from disk. If not found, returns exists=False.

    Example:
        GET /api/ai/autonomous/verify-requirements/build_20260323_143000

    Returns:
        GetMatrixResponse with matrix if it exists

    Raises:
        HTTPException 500: If failed to load matrix
    """
    try:
        import json
        from pathlib import Path

        # Matrix path
        # requirement_verification.py is at: apps/backend/src/api/routes/ai/requirement_verification.py
        _REPO_ROOT = Path(__file__).resolve().parents[6]
        _EXECUTION_DIR = _REPO_ROOT / ".claude" / ".execution"
        matrix_path = _EXECUTION_DIR / "build-specs" / f"{task_id}_trace_matrix.json"

        if not matrix_path.exists():
            logger.info("Matrix not found", task_id=task_id)
            return GetMatrixResponse(
                task_id=task_id,
                exists=False,
                matrix=None,
            )

        matrix_data = json.loads(matrix_path.read_text(encoding="utf-8"))
        matrix = TraceabilityMatrix(**matrix_data)

        logger.info("Matrix loaded", task_id=task_id)

        return GetMatrixResponse(
            task_id=task_id,
            exists=True,
            matrix=matrix,
        )

    except Exception as e:
        logger.error("Failed to load matrix", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to load traceability matrix",
        ) from e
