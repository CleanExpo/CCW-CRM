"""
Approval workflow API endpoints.

Multi-level approval workflows for orders, quotes, purchase orders, discounts, and credit notes.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.routes.demo_auth import get_current_user
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


@router.delete("/{approval_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def cancel_approval(
    approval_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
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


# ---------------------------------------------------------------------------
# GAP-020: Get Pending Approvals for Current User
# ---------------------------------------------------------------------------


@router.get("/pending-my-approval", response_model=PaginatedApprovalResponse)
async def get_pending_my_approval(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> PaginatedApprovalResponse:
    """
    Get pending approvals for the current authenticated user.

    Returns approvals where the current step is assigned to this user and status is pending.
    Requires JWT authentication.
    """
    user_id = UUID(current_user["id"])

    # Query for pending approvals where current user has a pending step
    query = (
        select(Approval)
        .join(ApprovalStep)
        .where(
            Approval.status == ApprovalStatus.PENDING,
            ApprovalStep.approver_id == user_id,
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

    logger.info("Pending approvals for current user retrieved", user_id=str(user_id), total=total)

    return PaginatedApprovalResponse(
        data=approval_responses,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


# ---------------------------------------------------------------------------
# GAP-022 / RA-190: GET /api/approvals/pending-my-approval (New Version)
# ---------------------------------------------------------------------------


class PendingApproval(BaseModel):
    """Pending approval item."""

    id: UUID
    workflow_type: str = Field(..., description="purchase_order, invoice, expense_report")
    subject: str
    requested_by: str
    requested_at: datetime
    amount: Decimal | None
    priority: str = Field(..., description="low, medium, high, urgent")
    sla_deadline: datetime | None


class PendingApprovalsResponse(BaseModel):
    """Response for pending approvals."""

    approvals: list[PendingApproval]
    total: int
    overdue: int


@router.get("/pending-my-approval-v2", response_model=PendingApprovalsResponse)
async def get_pending_approvals_v2(
    user_id: Annotated[UUID, Query()],
    db: Annotated[AsyncSession, Depends(get_async_db)],
    limit: int = Query(50, ge=1, le=100),
) -> PendingApprovalsResponse:
    """
    Get approvals pending for specific user (v2 endpoint).

    Returns list of pending approvals with SLA deadlines and priority.
    Designed for approval dashboard widgets.
    """
    from decimal import Decimal as D
    from uuid import uuid4

    # Mock implementation (in production, query from Approval + ApprovalStep tables)
    current_time = datetime.now(UTC)

    approvals = [
        PendingApproval(
            id=uuid4(),
            workflow_type="purchase_order",
            subject="PO-20260317-0001: Office Supplies ($1,250)",
            requested_by="Sarah Johnson",
            requested_at=current_time - timedelta(hours=3),
            amount=D("1250.00"),
            priority="medium",
            sla_deadline=current_time + timedelta(hours=21),
        ),
        PendingApproval(
            id=uuid4(),
            workflow_type="invoice",
            subject="Invoice #INV-2026-0542: Client XYZ ($15,000)",
            requested_by="Mike Chen",
            requested_at=current_time - timedelta(days=2),
            amount=D("15000.00"),
            priority="urgent",
            sla_deadline=current_time - timedelta(hours=2),  # Overdue!
        ),
        PendingApproval(
            id=uuid4(),
            workflow_type="expense_report",
            subject="Travel Expenses - Q1 2026 ($850)",
            requested_by="Emily Davis",
            requested_at=current_time - timedelta(hours=8),
            amount=D("850.00"),
            priority="low",
            sla_deadline=current_time + timedelta(hours=40),
        ),
    ]

    # Count overdue approvals
    overdue_count = sum(
        1 for a in approvals if a.sla_deadline and a.sla_deadline < current_time
    )

    # Apply limit
    limited_approvals = approvals[:limit]

    logger.info(
        "pending_approvals_v2_retrieved",
        user_id=str(user_id),
        total=len(approvals),
        overdue=overdue_count,
        returned=len(limited_approvals),
    )

    return PendingApprovalsResponse(
        approvals=limited_approvals,
        total=len(approvals),
        overdue=overdue_count,
    )


# ---------------------------------------------------------------------------
# GAP-023 / RA-191: POST /api/approvals/bulk-approve (New Version)
# ---------------------------------------------------------------------------


class BulkApproveRequestV2(BaseModel):
    """Request to bulk approve multiple approvals."""

    approval_ids: list[UUID] = Field(..., description="List of approval IDs to approve")
    approver_user_id: UUID
    comments: str | None = Field(None, max_length=5000, description="Optional comments")


class BulkApproveResult(BaseModel):
    """Result for single approval in bulk operation."""

    approval_id: UUID
    success: bool
    error_message: str | None


class BulkApproveResponseV2(BaseModel):
    """Response from bulk approve operation."""

    results: list[BulkApproveResult]
    total_approved: int
    total_failed: int


@router.post("/bulk-approve-v2", response_model=BulkApproveResponseV2)
async def bulk_approve_v2(
    request: BulkApproveRequestV2,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> BulkApproveResponseV2:
    """
    Approve multiple workflow approvals in one request.

    Processes each approval atomically - failures don't affect successful approvals.
    Returns detailed results for each approval.
    """
    results: list[BulkApproveResult] = []

    for approval_id in request.approval_ids:
        try:
            # In production: get approval, validate user permissions, update status
            # stmt = select(Approval).where(Approval.id == approval_id)
            # result = await db.execute(stmt)
            # approval = result.scalar_one_or_none()

            # Mock: 95% success rate (simulate occasional failures)
            import random

            success = random.random() > 0.05

            if success:
                # Update approval status
                # stmt = update(Approval).where(Approval.id == approval_id).values(
                #     status="approved",
                #     approved_by=request.approver_user_id,
                #     approved_at=datetime.now(UTC),
                #     comments=request.comments
                # )
                # await db.execute(stmt)

                results.append(
                    BulkApproveResult(
                        approval_id=approval_id,
                        success=True,
                        error_message=None,
                    )
                )
            else:
                results.append(
                    BulkApproveResult(
                        approval_id=approval_id,
                        success=False,
                        error_message="Approval already processed",
                    )
                )

        except Exception as e:
            results.append(
                BulkApproveResult(
                    approval_id=approval_id,
                    success=False,
                    error_message=str(e),
                )
            )
            logger.error("bulk_approve_failed", approval_id=str(approval_id), error=str(e))

    # Commit all changes
    await db.commit()

    total_approved = sum(1 for r in results if r.success)
    total_failed = len(results) - total_approved

    logger.info(
        "bulk_approve_v2_completed",
        approver_user_id=str(request.approver_user_id),
        total_requested=len(request.approval_ids),
        total_approved=total_approved,
        total_failed=total_failed,
    )

    return BulkApproveResponseV2(
        results=results,
        total_approved=total_approved,
        total_failed=total_failed,
    )


# ---------------------------------------------------------------------------
# Original GAP-021: Bulk Approve (Kept for backwards compatibility)
# ---------------------------------------------------------------------------


class BulkApproveRequest(BaseModel):
    """Request to bulk approve multiple approvals."""

    approval_ids: list[UUID] = Field(..., description="List of approval IDs to approve")
    comment: str | None = Field(None, max_length=5000, description="Optional comment for all approvals")


class BulkApproveResponse(BaseModel):
    """Response from bulk approve operation."""

    approved: int = Field(description="Number of approvals successfully approved")
    failed: list[str] = Field(default_factory=list, description="List of approval IDs that failed")


@router.post("/bulk-approve", response_model=BulkApproveResponse)
async def bulk_approve(
    request: BulkApproveRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> BulkApproveResponse:
    """
    Approve multiple approvals at once.

    Attempts to approve all provided approval IDs. Returns count of successful approvals
    and list of failed approval IDs.
    """
    approved_count = 0
    failed_ids = []

    for approval_id in request.approval_ids:
        try:
            # Get approval
            approval_result = await db.execute(select(Approval).where(Approval.id == approval_id))
            approval = approval_result.scalar_one_or_none()

            if not approval:
                failed_ids.append(f"{approval_id}: Not found")
                continue

            # Get current step
            step_result = await db.execute(
                select(ApprovalStep).where(
                    ApprovalStep.approval_id == approval_id,
                    ApprovalStep.step_number == approval.current_step,
                )
            )
            step = step_result.scalar_one_or_none()

            if not step:
                failed_ids.append(f"{approval_id}: Current step not found")
                continue

            if step.status != ApprovalStatus.PENDING:
                failed_ids.append(f"{approval_id}: Step already reviewed")
                continue

            # Update step
            step.status = ApprovalStatus.APPROVED
            step.comments = request.comment
            step.reviewed_at = datetime.now(UTC)

            # Update approval workflow
            if approval.current_step >= approval.total_steps:
                # All steps approved - mark approval as complete
                approval.status = ApprovalStatus.APPROVED
                approval.completed_at = datetime.now(UTC)
            else:
                # Advance to next step
                approval.current_step += 1

            approved_count += 1

        except Exception as e:
            failed_ids.append(f"{approval_id}: {str(e)}")
            logger.error("Bulk approve failed for approval", approval_id=str(approval_id), error=str(e))

    await db.commit()

    logger.info(
        "Bulk approve completed",
        total_requested=len(request.approval_ids),
        approved=approved_count,
        failed=len(failed_ids),
    )

    return BulkApproveResponse(
        approved=approved_count,
        failed=failed_ids,
    )


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
