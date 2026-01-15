"""Approval workflow routes (placeholder)."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/approvals")


@router.get("/")
async def list_approvals() -> dict:
    """List approval requests."""
    return {"approvals": [], "message": "Approvals feature coming soon"}


@router.get("/{approval_id}")
async def get_approval(approval_id: int) -> dict:
    """Get a specific approval request."""
    return {"approval_id": approval_id, "message": "Approval not found"}


@router.post("/{approval_id}/approve")
async def approve_request(approval_id: int) -> dict:
    """Approve a request."""
    return {"approval_id": approval_id, "status": "approved"}


@router.post("/{approval_id}/reject")
async def reject_request(approval_id: int) -> dict:
    """Reject a request."""
    return {"approval_id": approval_id, "status": "rejected"}
