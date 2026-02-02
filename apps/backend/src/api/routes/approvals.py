"""
Approval workflow API endpoints.

Multi-level approval workflows for orders, quotes, purchase orders, discounts, and credit notes.
"""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.approvals_models import (
    Approval,
    ApprovalStatus,
    ApprovalStep,
    ApprovalType,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/approvals", tags=["Approvals"])


# Pydantic Schemas


class CreateApprovalRequest(BaseModel):
    """Request to create approval workflow."""

    approval_type: str = Field(..., description="Type: order, quote, purchase_order, discount, credit_note")
    entity_id: UUID = Field(..., description="ID of entity requiring approval")
    entity_type: str = Field(..., description="Entity type (order, quote, etc.)")
    total_steps: int = Field(default=1, ge=1, le=10, description="Total approval steps")
    requested_by: UUID = Field(..., description="User ID requesting approval")
    notes: str | None = Field(None, max_length=5000, description="Additional notes")


class AddApprovalStepRequest(BaseModel):
    """Request to add approval step."""

    step_number: int = Field(..., ge=1, description="Step number in sequence")
    approver_id: UUID = Field(..., description="User ID of approver")
    approver_role: str | None = Field(None, max_length=100, description="Approver role/title")


class UpdateApprovalStepRequest(BaseModel):
    """Request to update approval step (approve/reject)."""

    action: str = Field(..., description="Action: approve or reject")
    comments: str | None = Field(None, max_length=5000, description="Approval/rejection comments")


class ApprovalStepResponse(BaseModel):
    """Approval step response."""

    id: UUID
    step_number: int
    approver_id: UUID
    approver_role: str | None
    status: str
    comments: str | None
    created_at: datetime
    reviewed_at: datetime | None


class ApprovalResponse(BaseModel):
    """Approval response."""

    id: UUID
    approval_type: str
    entity_id: UUID
    entity_type: str
    status: str
    total_steps: int
    current_step: int
    requested_by: UUID
    notes: str | None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    steps: list[ApprovalStepResponse]


class PaginatedApprovalResponse(BaseModel):
    """Paginated approval response."""

    data: list[ApprovalResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# API Endpoints


@router.post("", response_model=ApprovalResponse, status_code=status.HTTP_201_CREATED)
async def create_approval(
    request: CreateApprovalRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ApprovalResponse:
    """
    Create a new approval workflow.

    Creates an approval workflow for orders, quotes, purchase orders, discounts, or credit notes.
    The workflow will have multiple steps that must be completed in sequence.
    """
    try:
        # Validate approval type
        try:
            approval_type_enum = ApprovalType(request.approval_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid approval type: {request.approval_type}",
            )

        # Create approval
        approval = Approval(
            approval_type=request.approval_type,
            entity_id=request.entity_id,
            entity_type=request.entity_type,
            status=ApprovalStatus.PENDING,
            total_steps=request.total_steps,
            current_step=1,
            requested_by=request.requested_by,
            notes=request.notes,
        )

        db.add(approval)
        await db.commit()
        await db.refresh(approval)

        logger.info(
            "Approval workflow created",
            approval_id=str(approval.id),
            type=request.approval_type,
            entity_id=str(request.entity_id),
            total_steps=request.total_steps,
        )

        # Get steps (empty for now)
        steps_result = await db.execute(
            select(ApprovalStep).where(ApprovalStep.approval_id == approval.id).order_by(ApprovalStep.step_number)
        )
        steps = steps_result.scalars().all()

        return _build_approval_response(approval, steps)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create approval", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create approval: {str(e)}",
        )


@router.get("", response_model=PaginatedApprovalResponse)
async def list_approvals(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    status_filter: str | None = Query(None, description="Filter by status: pending, approved, rejected, cancelled"),
    approval_type: str | None = Query(None, description="Filter by type: order, quote, purchase_order, etc."),
    requested_by: UUID | None = Query(None, description="Filter by requester ID"),
    approver_id: UUID | None = Query(None, description="Filter by approver ID"),
) -> PaginatedApprovalResponse:
    """
    List approval workflows with filtering and pagination.

    Supports filtering by status, type, requester, and approver.
    """
    # Base query
    query = select(Approval)

    # Apply filters
    if status_filter:
        query = query.where(Approval.status == status_filter)

    if approval_type:
        query = query.where(Approval.approval_type == approval_type)

    if requested_by:
        query = query.where(Approval.requested_by == requested_by)

    if approver_id:
        # Filter by approver - join with approval_steps
        query = query.join(ApprovalStep).where(ApprovalStep.approver_id == approver_id)

    # Count total
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    # Apply pagination and ordering
    query = query.order_by(Approval.created_at.desc()).offset((page - 1) * page_size).limit(page_size)

    # Execute
    result = await db.execute(query)
    approvals = result.scalars().all()

    # Get steps for each approval
    approval_responses = []
    for approval in approvals:
        steps_result = await db.execute(
            select(ApprovalStep).where(ApprovalStep.approval_id == approval.id).order_by(ApprovalStep.step_number)
        )
        steps = steps_result.scalars().all()
        approval_responses.append(_build_approval_response(approval, steps))

    logger.info("Approvals listed", total=total, page=page, filters_applied=bool(status_filter or approval_type))

    return PaginatedApprovalResponse(
        data=approval_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/pending", response_model=PaginatedApprovalResponse)
async def get_pending_approvals(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    approver_id: UUID = Query(..., description="User ID of approver"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> PaginatedApprovalResponse:
    """
    Get pending approvals for a specific approver.

    Returns approvals where the current step is assigned to the approver and status is pending.
    """
    # Query for pending approvals where approver has a pending step
    query = (
        select(Approval)
        .join(ApprovalStep)
        .where(
            Approval.status == ApprovalStatus.PENDING,
            ApprovalStep.approver_id == approver_id,
            ApprovalStep.status == ApprovalStatus.PENDING,
            ApprovalStep.step_number == Approval.current_step,
        )
    )

    # Count total
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.order_by(Approval.created_at.desc()).offset((page - 1) * page_size).limit(page_size)

    # Execute
    result = await db.execute(query)
    approvals = result.scalars().all()

    # Get steps for each approval
    approval_responses = []
    for approval in approvals:
        steps_result = await db.execute(
            select(ApprovalStep).where(ApprovalStep.approval_id == approval.id).order_by(ApprovalStep.step_number)
        )
        steps = steps_result.scalars().all()
        approval_responses.append(_build_approval_response(approval, steps))

    logger.info("Pending approvals retrieved", approver_id=str(approver_id), total=total)

    return PaginatedApprovalResponse(
        data=approval_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.get("/{approval_id}", response_model=ApprovalResponse)
async def get_approval(
    approval_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ApprovalResponse:
    """
    Get approval workflow details by ID.

    Returns complete approval with all steps.
    """
    # Get approval
    result = await db.execute(select(Approval).where(Approval.id == approval_id))
    approval = result.scalar_one_or_none()

    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Approval {approval_id} not found",
        )

    # Get steps
    steps_result = await db.execute(
        select(ApprovalStep).where(ApprovalStep.approval_id == approval_id).order_by(ApprovalStep.step_number)
    )
    steps = steps_result.scalars().all()

    logger.info("Approval retrieved", approval_id=str(approval_id), status=approval.status)

    return _build_approval_response(approval, steps)


@router.post("/{approval_id}/steps", response_model=ApprovalStepResponse, status_code=status.HTTP_201_CREATED)
async def add_approval_step(
    approval_id: UUID,
    request: AddApprovalStepRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ApprovalStepResponse:
    """
    Add an approval step to the workflow.

    Steps must be added in sequence. Each step represents an approval level.
    """
    # Get approval
    result = await db.execute(select(Approval).where(Approval.id == approval_id))
    approval = result.scalar_one_or_none()

    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Approval {approval_id} not found",
        )

    # Validate step number
    if request.step_number > approval.total_steps:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Step number {request.step_number} exceeds total steps {approval.total_steps}",
        )

    # Check if step already exists
    existing_result = await db.execute(
        select(ApprovalStep).where(
            ApprovalStep.approval_id == approval_id, ApprovalStep.step_number == request.step_number
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Step {request.step_number} already exists for this approval",
        )

    # Create step
    step = ApprovalStep(
        approval_id=approval_id,
        step_number=request.step_number,
        approver_id=request.approver_id,
        approver_role=request.approver_role,
        status=ApprovalStatus.PENDING,
    )

    db.add(step)
    await db.commit()
    await db.refresh(step)

    logger.info(
        "Approval step added",
        approval_id=str(approval_id),
        step_number=request.step_number,
        approver_id=str(request.approver_id),
    )

    return ApprovalStepResponse(
        id=step.id,
        step_number=step.step_number,
        approver_id=step.approver_id,
        approver_role=step.approver_role,
        status=step.status,
        comments=step.comments,
        created_at=step.created_at,
        reviewed_at=step.reviewed_at,
    )


@router.put("/{approval_id}/steps/{step_id}", response_model=ApprovalStepResponse)
async def update_approval_step(
    approval_id: UUID,
    step_id: UUID,
    request: UpdateApprovalStepRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> ApprovalStepResponse:
    """
    Update approval step (approve or reject).

    When a step is approved, the workflow advances to the next step.
    When a step is rejected, the entire workflow is rejected.
    """
    # Validate action
    if request.action not in ["approve", "reject"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid action: {request.action}. Must be 'approve' or 'reject'",
        )

    # Get approval
    approval_result = await db.execute(select(Approval).where(Approval.id == approval_id))
    approval = approval_result.scalar_one_or_none()

    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Approval {approval_id} not found",
        )

    # Get step
    step_result = await db.execute(
        select(ApprovalStep).where(ApprovalStep.id == step_id, ApprovalStep.approval_id == approval_id)
    )
    step = step_result.scalar_one_or_none()

    if not step:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Step {step_id} not found for approval {approval_id}",
        )

    # Check if step is current step
    if step.step_number != approval.current_step:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update step {step.step_number}. Current step is {approval.current_step}",
        )

    # Check if already reviewed
    if step.status != ApprovalStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Step already reviewed with status: {step.status}",
        )

    # Update step
    step.status = ApprovalStatus.APPROVED if request.action == "approve" else ApprovalStatus.REJECTED
    step.comments = request.comments
    step.reviewed_at = datetime.now(UTC)

    # Update approval workflow
    if request.action == "approve":
        # Check if this is the last step
        if approval.current_step >= approval.total_steps:
            # All steps approved - mark approval as complete
            approval.status = ApprovalStatus.APPROVED
            approval.completed_at = datetime.now(UTC)
            logger.info("Approval workflow completed", approval_id=str(approval_id))
        else:
            # Advance to next step
            approval.current_step += 1
            logger.info(
                "Approval step approved - advancing",
                approval_id=str(approval_id),
                next_step=approval.current_step,
            )
    else:
        # Rejection - reject entire workflow
        approval.status = ApprovalStatus.REJECTED
        approval.completed_at = datetime.now(UTC)
        logger.info("Approval workflow rejected", approval_id=str(approval_id), step=step.step_number)

    await db.commit()
    await db.refresh(step)
    await db.refresh(approval)

    return ApprovalStepResponse(
        id=step.id,
        step_number=step.step_number,
        approver_id=step.approver_id,
        approver_role=step.approver_role,
        status=step.status,
        comments=step.comments,
        created_at=step.created_at,
        reviewed_at=step.reviewed_at,
    )


@router.delete("/{approval_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_approval(
    approval_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> None:
    """
    Cancel an approval workflow.

    Sets the approval status to cancelled. Cannot be undone.
    """
    # Get approval
    result = await db.execute(select(Approval).where(Approval.id == approval_id))
    approval = result.scalar_one_or_none()

    if not approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Approval {approval_id} not found",
        )

    # Check if already completed
    if approval.status in [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel approval with status: {approval.status}",
        )

    # Cancel
    approval.status = ApprovalStatus.CANCELLED
    approval.completed_at = datetime.now(UTC)

    await db.commit()

    logger.info("Approval workflow cancelled", approval_id=str(approval_id))


# Helper Functions


def _build_approval_response(approval: Approval, steps: list[ApprovalStep]) -> ApprovalResponse:
    """Build approval response with steps."""
    step_responses = [
        ApprovalStepResponse(
            id=step.id,
            step_number=step.step_number,
            approver_id=step.approver_id,
            approver_role=step.approver_role,
            status=step.status,
            comments=step.comments,
            created_at=step.created_at,
            reviewed_at=step.reviewed_at,
        )
        for step in steps
    ]

    return ApprovalResponse(
        id=approval.id,
        approval_type=approval.approval_type,
        entity_id=approval.entity_id,
        entity_type=approval.entity_type,
        status=approval.status,
        total_steps=approval.total_steps,
        current_step=approval.current_step,
        requested_by=approval.requested_by,
        notes=approval.notes,
        created_at=approval.created_at,
        updated_at=approval.updated_at,
        completed_at=approval.completed_at,
        steps=step_responses,
    )
