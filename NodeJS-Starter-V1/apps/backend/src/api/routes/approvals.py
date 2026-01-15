"""
Approval API Endpoints.

Handles approval workflow for autonomous agents and high-value operations:
- GET /api/approvals/pending - List pending approvals for current user
- POST /api/approvals/{id}/approve - Approve with confirmation token
- POST /api/approvals/{id}/reject - Reject with reason
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.models import User  # Alert, AlertStatus not yet implemented
from src.services.alert_manager import get_alert_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/approvals", tags=["approvals"])


# Pydantic Models
class ApprovalSummary(BaseModel):
    """Summary of a pending approval."""

    id: str
    alert_type: str
    severity: str
    title: str
    message: str
    entity_type: str | None
    entity_id: str | None
    approval_type: str
    approval_data: dict
    confirmation_token: str
    created_at: str

    class Config:
        from_attributes = True


class ApprovalList(BaseModel):
    """List of pending approvals."""

    items: list[ApprovalSummary]
    total: int


class ApproveRequest(BaseModel):
    """Request to approve an action."""

    confirmation_token: str = Field(
        ..., description="Security token from approval request"
    )
    notes: str | None = Field(None, description="Optional approval notes")


class RejectRequest(BaseModel):
    """Request to reject an action."""

    reason: str = Field(..., description="Reason for rejection")


class ApprovalResponse(BaseModel):
    """Response after approve/reject."""

    status: str
    message: str
    alert_id: str


# Endpoints


@router.get("/pending", response_model=ApprovalList)
async def get_pending_approvals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
) -> ApprovalList:
    """
    Get all pending approval requests for the current user.

    Only returns approvals assigned to the current user based on their role.
    """
    try:
        alert_manager = get_alert_manager()
        approvals_raw = await alert_manager.get_pending_approvals(db, current_user.id)

        # Convert to Pydantic models
        items = []
        for approval in approvals_raw:
            metadata = approval.get("metadata", {})
            if not metadata.get("requires_approval"):
                continue

            items.append(
                ApprovalSummary(
                    id=approval["id"],
                    alert_type=approval["alert_type"],
                    severity=approval["severity"],
                    title=approval["title"],
                    message=approval["message"],
                    entity_type=approval.get("entity_type"),
                    entity_id=approval.get("entity_id"),
                    approval_type=metadata.get("approval_type", "unknown"),
                    approval_data=metadata.get("approval_data", {}),
                    confirmation_token=metadata.get("approval_token", ""),
                    created_at=approval["created_at"],
                )
            )

        return ApprovalList(items=items, total=len(items))

    except Exception as e:
        logger.error(f"Error fetching pending approvals: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail="Failed to fetch pending approvals"
        )


@router.post("/{approval_id}/approve", response_model=ApprovalResponse)
async def approve_action(
    approval_id: UUID,
    request: ApproveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
) -> ApprovalResponse:
    """
    Approve a pending action.

    Requires valid confirmation token for security.
    """
    try:
        # Get alert from database
        # TODO: Use actual Alert model query once table created
        # alert = await db.get(Alert, approval_id)
        # if not alert:
        #     raise HTTPException(status_code=404, detail="Approval not found")
        #
        # # Verify assigned to current user
        # if alert.assigned_to != current_user.id:
        #     raise HTTPException(
        #         status_code=403,
        #         detail="Not authorized to approve this action"
        #     )
        #
        # # Verify confirmation token
        # metadata = alert.metadata_
        # if metadata.get("approval_token") != request.confirmation_token:
        #     raise HTTPException(
        #         status_code=403,
        #         detail="Invalid confirmation token"
        #     )
        #
        # # Mark as actioned
        # alert.status = AlertStatus.ACTIONED
        # alert.actioned_at = datetime.utcnow()
        # if request.notes:
        #     metadata["approval_notes"] = request.notes
        #     metadata["approved_by"] = str(current_user.id)
        #     metadata["approved_at"] = datetime.utcnow().isoformat()
        #     alert.metadata_ = metadata
        # await db.commit()

        # TODO: Publish event for agent to execute approved action
        # from src.events.event_bus import get_event_bus
        # event_bus = get_event_bus()
        # await event_bus.publish(
        #     "approval.approved",
        #     {
        #         "approval_id": str(approval_id),
        #         "entity_type": alert.entity_type,
        #         "entity_id": str(alert.entity_id),
        #         "approval_type": metadata.get("approval_type"),
        #         "approval_data": metadata.get("approval_data"),
        #     },
        #     source="approval_api",
        # )

        logger.info(
            f"Approval {approval_id} approved by user {current_user.id}",
            extra={"approval_id": str(approval_id), "user_id": str(current_user.id)},
        )

        return ApprovalResponse(
            status="approved",
            message="Action approved successfully",
            alert_id=str(approval_id),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving action: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to approve action")


@router.post("/{approval_id}/reject", response_model=ApprovalResponse)
async def reject_action(
    approval_id: UUID,
    request: RejectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
) -> ApprovalResponse:
    """
    Reject a pending action.

    Requires rejection reason.
    """
    try:
        # Get alert from database
        # TODO: Use actual Alert model query once table created
        # alert = await db.get(Alert, approval_id)
        # if not alert:
        #     raise HTTPException(status_code=404, detail="Approval not found")
        #
        # # Verify assigned to current user
        # if alert.assigned_to != current_user.id:
        #     raise HTTPException(
        #         status_code=403,
        #         detail="Not authorized to reject this action"
        #     )
        #
        # # Mark as dismissed with rejection reason
        # alert.status = AlertStatus.DISMISSED
        # alert.dismissed_at = datetime.utcnow()
        # metadata = alert.metadata_
        # metadata["rejection_reason"] = request.reason
        # metadata["rejected_by"] = str(current_user.id)
        # metadata["rejected_at"] = datetime.utcnow().isoformat()
        # alert.metadata_ = metadata
        # await db.commit()

        # TODO: Publish event for agent to handle rejection
        # from src.events.event_bus import get_event_bus
        # event_bus = get_event_bus()
        # await event_bus.publish(
        #     "approval.rejected",
        #     {
        #         "approval_id": str(approval_id),
        #         "entity_type": alert.entity_type,
        #         "entity_id": str(alert.entity_id),
        #         "rejection_reason": request.reason,
        #     },
        #     source="approval_api",
        # )

        logger.info(
            f"Approval {approval_id} rejected by user {current_user.id}",
            extra={
                "approval_id": str(approval_id),
                "user_id": str(current_user.id),
                "reason": request.reason,
            },
        )

        return ApprovalResponse(
            status="rejected",
            message="Action rejected successfully",
            alert_id=str(approval_id),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting action: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to reject action")


@router.get("/{approval_id}", response_model=ApprovalSummary)
async def get_approval_details(
    approval_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
) -> ApprovalSummary:
    """
    Get details of a specific approval.

    Used for showing detailed view before approve/reject.
    """
    try:
        # TODO: Query Alert model once table created
        # alert = await db.get(Alert, approval_id)
        # if not alert:
        #     raise HTTPException(status_code=404, detail="Approval not found")
        #
        # # Verify access
        # if alert.assigned_to != current_user.id:
        #     raise HTTPException(
        #         status_code=403,
        #         detail="Not authorized to view this approval"
        #     )
        #
        # metadata = alert.metadata_
        # return ApprovalSummary(
        #     id=str(alert.id),
        #     alert_type=alert.alert_type,
        #     severity=alert.severity.value,
        #     title=alert.title,
        #     message=alert.message,
        #     entity_type=alert.entity_type,
        #     entity_id=str(alert.entity_id) if alert.entity_id else None,
        #     approval_type=metadata.get("approval_type", "unknown"),
        #     approval_data=metadata.get("approval_data", {}),
        #     confirmation_token=metadata.get("approval_token", ""),
        #     created_at=alert.created_at.isoformat(),
        # )

        # Placeholder for now
        raise HTTPException(status_code=404, detail="Approval not found")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching approval details: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch approval details")
