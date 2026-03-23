"""
Gap-to-Linear Sync API

Provides status checking and management for /sync-linear orchestration.

The actual orchestration is performed by the /sync-linear command skill.
This API provides programmatic access to sync state and progress.

Endpoints:
  GET /api/ai/gap-sync/status/{sync_id} - Get sync status
  GET /api/ai/gap-sync/list - List all syncs
  POST /api/ai/gap-sync/{sync_id}/cancel - Cancel a running sync
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Literal

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

router = APIRouter(
    prefix="/api/ai/gap-sync",
    tags=["Gap Sync"],
)

# Gap sync directory
# gap_sync.py is at: apps/backend/src/api/routes/ai/gap_sync.py
# parents[0] = ai/, parents[1] = routes/, parents[2] = api/
# parents[3] = src/, parents[4] = backend/, parents[5] = apps/, parents[6] = D:\\CCW-ERP-CRM
_REPO_ROOT = Path(__file__).resolve().parents[6]  # D:\\CCW-ERP-CRM
_GAP_SYNC_DIR = _REPO_ROOT / ".claude" / ".execution" / "gap-sync"
_GAP_SYNC_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class SyncStep(BaseModel):
    """Single step in gap sync workflow."""

    step_id: int = Field(ge=1, le=4, description="Step identifier (1-4)")
    name: str = Field(description="Step name (pi-cross-ref, pi-prioritize, pi-prd, pi-issues)")
    status: Literal["pending", "in_progress", "completed", "failed"] = Field(
        description="Step status"
    )
    started_at: str | None = Field(default=None, description="Step start timestamp")
    completed_at: str | None = Field(default=None, description="Step completion timestamp")
    output_path: str | None = Field(default=None, description="Path to step output file")
    error: str | None = Field(default=None, description="Error message if step failed")
    issues_created: int | None = Field(
        default=None,
        description="Number of Linear issues created (step 4 only)",
    )


class SyncState(BaseModel):
    """Complete gap sync state."""

    sync_id: str = Field(description="Unique sync identifier (sync_YYYYMMDD_HHMMSS)")
    created_at: str = Field(description="ISO 8601 timestamp")
    status: Literal["pending", "in_progress", "completed", "failed", "cancelled"] = Field(
        description="Overall sync status"
    )
    current_step: int = Field(ge=0, le=4, description="Current step number (0 = not started)")
    steps: list[SyncStep] = Field(description="All sync steps")
    total_issues_created: int = Field(default=0, description="Total Linear issues created")
    rollback_performed: bool = Field(
        default=False,
        description="Whether rollback was performed",
    )
    error: str | None = Field(default=None, description="Overall error message if sync failed")


class SyncStatusResponse(BaseModel):
    """Response from GET /status/{sync_id}."""

    sync_id: str
    exists: bool
    state: SyncState | None = None


class SyncListItem(BaseModel):
    """Single item in sync list."""

    sync_id: str
    created_at: str
    status: str
    current_step: int
    total_issues_created: int


class SyncListResponse(BaseModel):
    """Response from GET /list."""

    syncs: list[SyncListItem]
    total: int


class CancelSyncResponse(BaseModel):
    """Response from POST /{sync_id}/cancel."""

    sync_id: str
    message: str
    previous_status: str
    new_status: Literal["cancelled"]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/status/{sync_id}")
async def get_sync_status(sync_id: str) -> SyncStatusResponse:
    """
    Get the status of a gap sync operation.

    Reads state from .claude/.execution/gap-sync/{sync_id}/state.json.

    Example:
        GET /api/ai/gap-sync/status/sync_20260323_143000

    Returns:
        SyncStatusResponse with sync state

    Raises:
        HTTPException 404: If sync_id not found
        HTTPException 500: If state file is corrupted
    """
    sync_dir = _GAP_SYNC_DIR / sync_id
    state_path = sync_dir / "state.json"

    if not state_path.exists():
        logger.warning("Sync not found", sync_id=sync_id)
        return SyncStatusResponse(
            sync_id=sync_id,
            exists=False,
            state=None,
        )

    try:
        state_data = json.loads(state_path.read_text(encoding="utf-8"))
        sync_state = SyncState(**state_data)

        return SyncStatusResponse(
            sync_id=sync_id,
            exists=True,
            state=sync_state,
        )

    except json.JSONDecodeError as e:
        logger.error("Failed to parse sync state", sync_id=sync_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to parse sync state (corrupted JSON)",
        ) from e
    except Exception as e:
        logger.error("Failed to load sync state", sync_id=sync_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to load sync state",
        ) from e


@router.get("/list")
async def list_syncs() -> SyncListResponse:
    """
    List all gap sync operations.

    Scans .claude/.execution/gap-sync/ for all sync directories.

    Example:
        GET /api/ai/gap-sync/list

    Returns:
        SyncListResponse with all syncs (sorted by created_at descending)

    Raises:
        HTTPException 500: If failed to list syncs
    """
    try:
        syncs: list[SyncListItem] = []

        # Scan gap-sync directory for sync_* directories
        for sync_dir in _GAP_SYNC_DIR.iterdir():
            if not sync_dir.is_dir() or not sync_dir.name.startswith("sync_"):
                continue

            state_path = sync_dir / "state.json"
            if not state_path.exists():
                continue

            try:
                state_data = json.loads(state_path.read_text(encoding="utf-8"))
                syncs.append(
                    SyncListItem(
                        sync_id=state_data["sync_id"],
                        created_at=state_data["created_at"],
                        status=state_data["status"],
                        current_step=state_data["current_step"],
                        total_issues_created=state_data.get("total_issues_created", 0),
                    )
                )
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(
                    "Skipping corrupted sync state",
                    sync_id=sync_dir.name,
                    error=str(e),
                )
                continue

        # Sort by created_at descending (most recent first)
        syncs.sort(key=lambda s: s.created_at, reverse=True)

        return SyncListResponse(
            syncs=syncs,
            total=len(syncs),
        )

    except Exception as e:
        logger.error("Failed to list syncs", error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to list syncs",
        ) from e


@router.post("/{sync_id}/cancel")
async def cancel_sync(sync_id: str) -> CancelSyncResponse:
    """
    Cancel a running gap sync operation.

    Sets status to "cancelled" in state file. The /sync-linear command
    must check for cancellation and stop gracefully.

    Example:
        POST /api/ai/gap-sync/sync_20260323_143000/cancel

    Returns:
        CancelSyncResponse with cancellation confirmation

    Raises:
        HTTPException 404: If sync_id not found
        HTTPException 400: If sync is already completed/failed/cancelled
        HTTPException 500: If failed to update state
    """
    sync_dir = _GAP_SYNC_DIR / sync_id
    state_path = sync_dir / "state.json"

    if not state_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Sync '{sync_id}' not found",
        )

    logger.info("Cancelling sync", sync_id=sync_id)

    try:
        state_data = json.loads(state_path.read_text(encoding="utf-8"))

        previous_status = state_data["status"]

        # Check if sync is in a cancellable state
        if previous_status in ["completed", "failed", "cancelled"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot cancel sync with status '{previous_status}'",
            )

        # Update status to cancelled
        state_data["status"] = "cancelled"

        # Save updated state
        state_path.write_text(
            json.dumps(state_data, indent=2),
            encoding="utf-8",
        )

        logger.info(
            "Sync cancelled",
            sync_id=sync_id,
            previous_status=previous_status,
        )

        return CancelSyncResponse(
            sync_id=sync_id,
            message=f"Sync '{sync_id}' has been cancelled.",
            previous_status=previous_status,
            new_status="cancelled",
        )

    except HTTPException:
        raise  # Re-raise HTTPException as-is
    except json.JSONDecodeError as e:
        logger.error("Failed to parse sync state", sync_id=sync_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to parse sync state (corrupted JSON)",
        ) from e
    except Exception as e:
        logger.error("Failed to cancel sync", sync_id=sync_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to cancel sync",
        ) from e
