"""
Build Command Handler

Implements the /build command workflow: EXTRACT → APPROVE → EXECUTE

3-stage workflow:
  Stage 1: Parse natural language → extract structured spec → save to disk
  Stage 2: Return spec to user → wait for approval
  Stage 3: Trigger /autonomous workflow with spec context

Endpoints:
  POST /api/ai/build/start    - Initiate build (Stage 1)
  POST /api/ai/build/approve  - Approve spec (Stage 2 → 3)
  GET  /api/ai/build/status/{task_id} - Check status
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.services.requirement_extractor import ExtractedSpec, get_extractor

logger = structlog.get_logger(__name__)

router = APIRouter(
    prefix="/api/ai/build",
    tags=["Build Command"],
)

# Build specs storage directory
# build_command.py is at: apps/backend/src/api/routes/ai/build_command.py
# parents[0] = ai/, parents[1] = routes/, parents[2] = api/
# parents[3] = src/, parents[4] = backend/, parents[5] = apps/, parents[6] = D:\CCW-ERP-CRM
_REPO_ROOT = Path(__file__).resolve().parents[6]  # D:\CCW-ERP-CRM
_BUILD_SPECS_DIR = _REPO_ROOT / ".claude" / ".execution" / "build-specs"
_BUILD_SPECS_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class BuildStartRequest(BaseModel):
    """Request to start a new build."""

    description: str = Field(
        description="Natural language description of what to build",
        min_length=10,
        max_length=2000,
    )
    context: dict[str, str] = Field(
        default_factory=dict,
        description="Optional context (current page, user role, etc.)",
    )


class BuildSpec(BaseModel):
    """Complete build specification including metadata."""

    task_id: str = Field(description="Unique task identifier (build_YYYYMMDD_HHMMSS)")
    created_at: str = Field(description="ISO 8601 timestamp")
    stage: Literal["awaiting_approval", "executing", "completed", "failed"] = Field(
        description="Current stage of the build"
    )
    spec: ExtractedSpec = Field(description="Extracted structured specification")
    confidence: float = Field(description="Confidence score (0.0-1.0)")
    warnings: list[str] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    approved: bool = Field(default=False, description="Whether spec has been approved by user")
    approved_at: str | None = Field(default=None, description="Approval timestamp")
    autonomous_task_id: str | None = Field(default=None, description="ID of autonomous execution task")
    error: str | None = Field(default=None, description="Error message if stage failed")


class BuildStartResponse(BaseModel):
    """Response from starting a build."""

    task_id: str
    spec: BuildSpec
    message: str = "Build spec extracted. Review and approve to proceed."


class BuildApproveRequest(BaseModel):
    """Request to approve a build spec."""

    task_id: str = Field(description="Task ID to approve")
    approved: bool = Field(description="Whether to approve (true) or reject (false)")
    feedback: str | None = Field(
        default=None,
        description="Optional feedback if rejecting",
    )


class BuildApproveResponse(BaseModel):
    """Response from approving/rejecting a build."""

    task_id: str
    approved: bool
    autonomous_task_id: str | None = None
    message: str


class BuildStatusResponse(BaseModel):
    """Response with current build status."""

    task_id: str
    spec: BuildSpec
    exists: bool


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/start")
async def start_build(request: BuildStartRequest) -> BuildStartResponse:
    """
    Start a new build by extracting structured requirements from natural language.

    This is Stage 1 of the /build workflow:
    1. Parse natural language using LLM
    2. Extract 7-field specification
    3. Calculate confidence score
    4. Generate warnings/suggestions
    5. Save spec to disk
    6. Return spec for user review

    Example:
        POST /api/ai/build/start
        {
          "description": "Add a logout button to the sidebar"
        }

    Returns:
        BuildStartResponse with task_id and extracted spec

    Raises:
        HTTPException 400: If description is invalid or extraction fails
        HTTPException 500: If unexpected error occurs
    """
    description = request.description.strip()

    # Generate task ID
    task_id = f"build_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"

    logger.info(
        "Starting build",
        task_id=task_id,
        description_length=len(description),
    )

    try:
        # Stage 1: Extract structured spec
        extractor = get_extractor()

        # Enhance description with context if provided
        enhanced_description = description
        if request.context:
            context_str = " ".join([f"{k}: {v}" for k, v in request.context.items()])
            enhanced_description = f"{description}\n\nContext: {context_str}"

        spec = await extractor.extract(enhanced_description)

        # Calculate confidence (from command_parser logic)
        confidence = _calculate_confidence(spec, description)

        # Generate warnings and suggestions
        warnings = _generate_warnings(spec)
        suggestions = _generate_suggestions(spec, description)

        # Create build spec
        build_spec = BuildSpec(
            task_id=task_id,
            created_at=datetime.now(timezone.utc).isoformat(),
            stage="awaiting_approval",
            spec=spec,
            confidence=confidence,
            warnings=warnings,
            suggestions=suggestions,
            approved=False,
        )

        # Save to disk
        spec_path = _BUILD_SPECS_DIR / f"{task_id}.json"
        spec_path.write_text(
            build_spec.model_dump_json(indent=2),
            encoding="utf-8",
        )

        logger.info(
            "Build spec extracted and saved",
            task_id=task_id,
            confidence=confidence,
            spec_path=str(spec_path),
        )

        return BuildStartResponse(
            task_id=task_id,
            spec=build_spec,
            message="Build spec extracted. Review and approve to proceed.",
        )

    except ValueError as e:
        logger.warning("Build start failed", task_id=task_id, error=str(e))
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error("Unexpected build start error", task_id=task_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to start build") from e


@router.post("/approve")
async def approve_build(request: BuildApproveRequest) -> BuildApproveResponse:
    """
    Approve or reject a build specification.

    This is Stage 2 → 3 of the /build workflow:
    - If approved: Update spec, trigger /autonomous execution
    - If rejected: Update spec with feedback, user can modify and resubmit

    Example (approve):
        POST /api/ai/build/approve
        {
          "task_id": "build_20260323_143000",
          "approved": true
        }

    Example (reject):
        POST /api/ai/build/approve
        {
          "task_id": "build_20260323_143000",
          "approved": false,
          "feedback": "Too vague, please specify exact page"
        }

    Returns:
        BuildApproveResponse with approval status

    Raises:
        HTTPException 404: If task_id not found
        HTTPException 400: If task already approved/executed
        HTTPException 500: If autonomous trigger fails
    """
    task_id = request.task_id
    spec_path = _BUILD_SPECS_DIR / f"{task_id}.json"

    logger.info(
        "Processing build approval",
        task_id=task_id,
        approved=request.approved,
    )

    # Load existing spec
    if not spec_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Build task '{task_id}' not found",
        )

    try:
        build_spec = BuildSpec.model_validate_json(spec_path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error("Failed to load build spec", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to load build spec",
        ) from e

    # Check if already approved
    if build_spec.approved:
        raise HTTPException(
            status_code=400,
            detail=f"Build task '{task_id}' already approved",
        )

    # Check if already executing/completed
    if build_spec.stage in ["executing", "completed"]:
        raise HTTPException(
            status_code=400,
            detail=f"Build task '{task_id}' already in stage '{build_spec.stage}'",
        )

    if request.approved:
        # APPROVED: Trigger /autonomous execution
        build_spec.approved = True
        build_spec.approved_at = datetime.now(timezone.utc).isoformat()
        build_spec.stage = "executing"

        # TODO: Trigger /autonomous workflow here
        # For now, just set a placeholder autonomous_task_id
        # In Phase 3, this will actually call the autonomous execution API
        autonomous_task_id = f"auto_{task_id}"
        build_spec.autonomous_task_id = autonomous_task_id

        # Save updated spec
        spec_path.write_text(
            build_spec.model_dump_json(indent=2),
            encoding="utf-8",
        )

        logger.info(
            "Build approved, autonomous execution triggered",
            task_id=task_id,
            autonomous_task_id=autonomous_task_id,
        )

        return BuildApproveResponse(
            task_id=task_id,
            approved=True,
            autonomous_task_id=autonomous_task_id,
            message="Build approved. Autonomous execution started.",
        )
    else:
        # REJECTED: Save feedback, user can modify and resubmit
        build_spec.stage = "failed"
        build_spec.error = f"Rejected by user: {request.feedback or 'No feedback provided'}"

        # Save updated spec
        spec_path.write_text(
            build_spec.model_dump_json(indent=2),
            encoding="utf-8",
        )

        logger.info(
            "Build rejected by user",
            task_id=task_id,
            feedback=request.feedback,
        )

        return BuildApproveResponse(
            task_id=task_id,
            approved=False,
            message=f"Build rejected. Feedback: {request.feedback or 'None'}",
        )


@router.get("/status/{task_id}")
async def get_build_status(task_id: str) -> BuildStatusResponse:
    """
    Get current status of a build task.

    Returns the build spec and current stage (awaiting_approval, executing, completed, failed).

    Example:
        GET /api/ai/build/status/build_20260323_143000

    Returns:
        BuildStatusResponse with current status

    Raises:
        HTTPException 404: If task_id not found
    """
    spec_path = _BUILD_SPECS_DIR / f"{task_id}.json"

    if not spec_path.exists():
        # Return a minimal valid spec for not found case
        return BuildStatusResponse(
            task_id=task_id,
            spec=BuildSpec(
                task_id=task_id,
                created_at="",
                stage="failed",
                spec=ExtractedSpec(
                    what="Task not found",
                    where="N/A",
                    who="N/A",
                    when="N/A",
                    should_see=["N/A"],
                ),
                confidence=0.0,
                error="Task not found",
            ),
            exists=False,
        )

    try:
        build_spec = BuildSpec.model_validate_json(spec_path.read_text(encoding="utf-8"))
        return BuildStatusResponse(
            task_id=task_id,
            spec=build_spec,
            exists=True,
        )
    except Exception as e:
        logger.error("Failed to load build spec", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to load build status",
        ) from e


# ---------------------------------------------------------------------------
# Helpers (from command_parser.py)
# ---------------------------------------------------------------------------


def _calculate_confidence(spec: ExtractedSpec, original_description: str) -> float:
    """Calculate confidence score for the extracted spec."""
    score = 0.5

    # Factor 1: WHAT field length
    what_len = len(spec.what)
    if 30 <= what_len <= 150:
        score += 0.15
    elif what_len < 15:
        score -= 0.1

    # Factor 2: SHOULD SEE count
    should_see_count = len(spec.should_see)
    if 2 <= should_see_count <= 4:
        score += 0.15
    elif should_see_count == 1:
        score -= 0.05
    elif should_see_count > 6:
        score -= 0.1

    # Factor 3: Optional fields presence
    if spec.dont_do and len(spec.dont_do) > 0:
        score += 0.1
    if spec.success and len(spec.success) > 0:
        score += 0.1

    # Factor 4: WHERE specificity
    where_lower = spec.where.lower()
    if "/" in spec.where or "page" in where_lower:
        score += 0.1
    elif "sidebar" in where_lower or "dashboard" in where_lower:
        score += 0.05

    # Factor 5: Description length
    desc_len = len(original_description)
    if desc_len < 20:
        score -= 0.15
    elif desc_len > 100:
        score += 0.05

    return max(0.0, min(1.0, score))


def _generate_warnings(spec: ExtractedSpec) -> list[str]:
    """Generate warnings about potential issues."""
    warnings = []

    if len(spec.should_see) == 1:
        warnings.append("Only 1 observable outcome specified. Consider adding more specific behaviors.")

    where_lower = spec.where.lower()
    if "somewhere" in where_lower or "the app" in where_lower:
        warnings.append("WHERE field is vague. Specify the exact page or component.")

    if len(spec.what) < 20:
        warnings.append("WHAT field is very brief. Consider adding more detail.")

    if spec.who.lower() in ["user", "users", "someone"]:
        warnings.append("WHO field is generic. Specify the exact user role.")

    if not spec.success or len(spec.success) == 0:
        warnings.append("No success criteria specified. Consider adding measurable outcomes.")

    return warnings


def _generate_suggestions(spec: ExtractedSpec, original_description: str) -> list[str]:
    """Generate suggestions for improving the specification."""
    suggestions = []

    if not spec.dont_do or len(spec.dont_do) == 0:
        suggestions.append("Consider adding constraints (DON'T DO) to avoid common pitfalls.")

    if "/" not in spec.where:
        suggestions.append(f"Specify exact URL path in WHERE field (e.g., '/products' instead of '{spec.where}').")

    if spec.success and not any(char in " ".join(spec.success) for char in ["<", ">", "=", "%", "ms", "sec"]):
        suggestions.append("Add quantitative success criteria (e.g., 'Page loads in < 2 seconds').")

    if len(original_description) < 30:
        suggestions.append("Provide more detail in your description. Include context about why this change is needed.")

    return suggestions
