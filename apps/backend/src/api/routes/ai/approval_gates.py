"""
Approval Gates API

Manages approval gates for autonomous execution workflow.
Allows users to approve/reject phase transitions in manual approval mode.

Approval Gates:
  Gate 1 (after Phase 1 Discovery): Review codebase analysis
  Gate 2 (after Phase 2 Architecture): Review design before build
  Gate 3 (after Phase 4 Build Final): Review implementation before finalize

Endpoints:
  POST /api/ai/autonomous/gates/{task_id}/approve - Approve a gate
  POST /api/ai/autonomous/gates/{task_id}/reject  - Reject a gate with feedback
  GET  /api/ai/autonomous/gates/{task_id}         - List all gates for task
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = structlog.get_logger(__name__)

router = APIRouter(
    prefix="/api/ai/autonomous/gates",
    tags=["Approval Gates"],
)

# Execution directory
_REPO_ROOT = Path(__file__).resolve().parents[6]  # D:\CCW-ERP-CRM
_EXECUTION_DIR = _REPO_ROOT / ".claude" / ".execution"
_EXECUTION_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class ApprovalGate(BaseModel):
    """Single approval gate."""

    gate_id: int = Field(ge=1, le=3, description="Gate identifier (1, 2, or 3)")
    phase: int = Field(ge=1, le=5, description="Phase after which this gate is triggered")
    name: Literal["Discovery Review", "Design Approval", "Implementation Review"] = Field(
        description="Human-readable gate name"
    )
    status: Literal["pending", "approved", "rejected"] = Field(description="Current gate status")
    approved_at: str | None = Field(default=None, description="Approval/rejection timestamp")
    approved_by: str | None = Field(default=None, description="User who approved/rejected")
    feedback: str | None = Field(default=None, description="User feedback if rejected")


class ApproveGateRequest(BaseModel):
    """Request to approve a gate."""

    gate_id: int = Field(ge=1, le=3, description="Gate ID to approve")
    approved_by: str = Field(default="user", description="User approving the gate")


class RejectGateRequest(BaseModel):
    """Request to reject a gate."""

    gate_id: int = Field(ge=1, le=3, description="Gate ID to reject")
    feedback: str = Field(min_length=1, description="Reason for rejection")
    rejected_by: str = Field(default="user", description="User rejecting the gate")


class ApproveGateResponse(BaseModel):
    """Response from approving a gate."""

    task_id: str
    gate_id: int
    status: Literal["approved"]
    message: str
    next_action: str = Field(description="What happens next")


class RejectGateResponse(BaseModel):
    """Response from rejecting a gate."""

    task_id: str
    gate_id: int
    status: Literal["rejected"]
    message: str
    next_action: str = Field(description="What happens next")


class ListGatesResponse(BaseModel):
    """Response listing all gates for a task."""

    task_id: str
    gates: list[ApprovalGate]
    current_gate: int | None = Field(
        default=None,
        description="ID of current pending gate, or None if no gates pending",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/{task_id}/approve")
async def approve_gate(task_id: str, request: ApproveGateRequest) -> ApproveGateResponse:
    """
    Approve an approval gate.

    This allows the autonomous execution to proceed to the next phase.

    Example:
        POST /api/ai/autonomous/gates/task_20260323_143000/approve
        {
          "gate_id": 1,
          "approved_by": "user"
        }

    Returns:
        ApproveGateResponse with next action

    Raises:
        HTTPException 404: If task not found
        HTTPException 400: If gate not pending or already approved/rejected
    """
    current_task_path = _EXECUTION_DIR / "current-task.json"

    if not current_task_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Task '{task_id}' not found",
        )

    logger.info(
        "Approving gate",
        task_id=task_id,
        gate_id=request.gate_id,
        approved_by=request.approved_by,
    )

    try:
        # Load current task state
        task_data = json.loads(current_task_path.read_text(encoding="utf-8"))

        # Verify task_id matches
        if task_data.get("task_id") != task_id:
            raise HTTPException(
                status_code=404,
                detail=f"Task '{task_id}' not found (current task is '{task_data.get('task_id')}')",
            )

        # Find the gate
        gates = task_data.get("approval_gates", [])
        gate = next((g for g in gates if g["gate_id"] == request.gate_id), None)

        if not gate:
            raise HTTPException(
                status_code=400,
                detail=f"Gate {request.gate_id} not found for task '{task_id}'",
            )

        # Check gate status
        if gate["status"] != "pending":
            raise HTTPException(
                status_code=400,
                detail=f"Gate {request.gate_id} is not pending (current status: {gate['status']})",
            )

        # Approve the gate
        gate["status"] = "approved"
        gate["approved_at"] = datetime.now(timezone.utc).isoformat()
        gate["approved_by"] = request.approved_by

        # Save updated state
        current_task_path.write_text(
            json.dumps(task_data, indent=2),
            encoding="utf-8",
        )

        # Log to execution log
        _log_gate_event(task_id, "gate_approved", request.gate_id, request.approved_by)

        logger.info(
            "Gate approved",
            task_id=task_id,
            gate_id=request.gate_id,
            gate_name=gate["name"],
        )

        return ApproveGateResponse(
            task_id=task_id,
            gate_id=request.gate_id,
            status="approved",
            message=f"Gate {request.gate_id} ({gate['name']}) approved.",
            next_action=f"Autonomous execution will proceed to Phase {gate['phase'] + 1}.",
        )

    except HTTPException:
        raise  # Re-raise HTTPException as-is (400, 404, etc.)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse task state", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to parse task state",
        ) from e
    except Exception as e:
        logger.error("Failed to approve gate", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to approve gate",
        ) from e


@router.post("/{task_id}/reject")
async def reject_gate(task_id: str, request: RejectGateRequest) -> RejectGateResponse:
    """
    Reject an approval gate with feedback.

    This pauses autonomous execution and provides feedback to the agent.
    The agent can revise and re-present for approval.

    Example:
        POST /api/ai/autonomous/gates/task_20260323_143000/reject
        {
          "gate_id": 2,
          "feedback": "Design is too complex. Simplify the architecture.",
          "rejected_by": "user"
        }

    Returns:
        RejectGateResponse with next action

    Raises:
        HTTPException 404: If task not found
        HTTPException 400: If gate not pending or already approved/rejected
    """
    current_task_path = _EXECUTION_DIR / "current-task.json"

    if not current_task_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Task '{task_id}' not found",
        )

    logger.info(
        "Rejecting gate",
        task_id=task_id,
        gate_id=request.gate_id,
        rejected_by=request.rejected_by,
    )

    try:
        # Load current task state
        task_data = json.loads(current_task_path.read_text(encoding="utf-8"))

        # Verify task_id matches
        if task_data.get("task_id") != task_id:
            raise HTTPException(
                status_code=404,
                detail=f"Task '{task_id}' not found (current task is '{task_data.get('task_id')}')",
            )

        # Find the gate
        gates = task_data.get("approval_gates", [])
        gate = next((g for g in gates if g["gate_id"] == request.gate_id), None)

        if not gate:
            raise HTTPException(
                status_code=400,
                detail=f"Gate {request.gate_id} not found for task '{task_id}'",
            )

        # Check gate status
        if gate["status"] != "pending":
            raise HTTPException(
                status_code=400,
                detail=f"Gate {request.gate_id} is not pending (current status: {gate['status']})",
            )

        # Reject the gate
        gate["status"] = "rejected"
        gate["approved_at"] = datetime.now(timezone.utc).isoformat()
        gate["approved_by"] = request.rejected_by
        gate["feedback"] = request.feedback

        # Update task status to paused
        task_data["status"] = "paused"

        # Save updated state
        current_task_path.write_text(
            json.dumps(task_data, indent=2),
            encoding="utf-8",
        )

        # Log to execution log
        _log_gate_event(
            task_id,
            "gate_rejected",
            request.gate_id,
            request.rejected_by,
            request.feedback,
        )

        logger.info(
            "Gate rejected",
            task_id=task_id,
            gate_id=request.gate_id,
            gate_name=gate["name"],
            feedback=request.feedback,
        )

        return RejectGateResponse(
            task_id=task_id,
            gate_id=request.gate_id,
            status="rejected",
            message=f"Gate {request.gate_id} ({gate['name']}) rejected.",
            next_action=f"Agent will revise Phase {gate['phase']} work based on feedback and re-present.",
        )

    except HTTPException:
        raise  # Re-raise HTTPException as-is (400, 404, etc.)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse task state", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to parse task state",
        ) from e
    except Exception as e:
        logger.error("Failed to reject gate", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to reject gate",
        ) from e


@router.get("/{task_id}")
async def list_gates(task_id: str) -> ListGatesResponse:
    """
    List all approval gates for a task.

    Returns the status of all gates and identifies which gate (if any) is currently pending.

    Example:
        GET /api/ai/autonomous/gates/task_20260323_143000

    Returns:
        ListGatesResponse with all gates

    Raises:
        HTTPException 404: If task not found
    """
    current_task_path = _EXECUTION_DIR / "current-task.json"

    if not current_task_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Task '{task_id}' not found",
        )

    try:
        # Load current task state
        task_data = json.loads(current_task_path.read_text(encoding="utf-8"))

        # Verify task_id matches
        if task_data.get("task_id") != task_id:
            raise HTTPException(
                status_code=404,
                detail=f"Task '{task_id}' not found (current task is '{task_data.get('task_id')}')",
            )

        # Get gates
        gates_data = task_data.get("approval_gates", [])
        gates = [ApprovalGate(**gate) for gate in gates_data]

        # Find current pending gate
        current_gate = next((g.gate_id for g in gates if g.status == "pending"), None)

        return ListGatesResponse(
            task_id=task_id,
            gates=gates,
            current_gate=current_gate,
        )

    except json.JSONDecodeError as e:
        logger.error("Failed to parse task state", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to parse task state",
        ) from e
    except Exception as e:
        logger.error("Failed to list gates", task_id=task_id, error=str(e))
        raise HTTPException(
            status_code=500,
            detail="Failed to list gates",
        ) from e


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _log_gate_event(
    task_id: str,
    event: str,
    gate_id: int,
    user: str,
    feedback: str | None = None,
) -> None:
    """Log gate event to execution log (JSONL format)."""
    log_path = _EXECUTION_DIR / "execution-log.jsonl"

    event_data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": event,
        "task_id": task_id,
        "gate_id": gate_id,
        "user": user,
    }

    if feedback:
        event_data["feedback"] = feedback

    # Append to log file
    with log_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event_data) + "\n")
