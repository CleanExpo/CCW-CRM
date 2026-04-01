"""PRD API endpoints."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.api.schemas.prd import (
    AgentRunDetail,
    PRDCostSummary,
    PRDDetail,
    PRDGenerateRequest,
    PRDGenerateResponse,
    PRDListResponse,
    PRDSummary,
)
from src.config.database import get_async_db
from src.db.models import User
from src.db.models.prd import PRD, AgentRun, APIUsage

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/prd", tags=["prd"])


async def generate_prd_background(
    prd_id: UUID,
    requirements: str,
    context: dict | None,
    db: AsyncSession,
) -> None:
    """Background task to generate PRD."""
    try:
        from src.agents.prd.prd_orchestrator import PRDOrchestrator

        logger.info("Starting PRD generation", prd_id=str(prd_id))

        # Create orchestrator
        orchestrator = PRDOrchestrator()

        # Generate PRD (this may take 1-2 minutes)
        result = await orchestrator.generate(
            requirements=requirements,
            context=context or {},
            output_dir=None,  # Don't generate files, just return data
        )

        # Update PRD in database
        query = select(PRD).where(PRD.id == prd_id)
        db_result = await db.execute(query)
        prd = db_result.scalar_one_or_none()

        if not prd:
            logger.error("PRD not found after generation", prd_id=str(prd_id))
            return

        if result["success"]:
            prd_result = result["prd_result"]

            # Update PRD with generated content
            prd.status = "completed"
            prd.executive_summary = prd_result["prd_analysis"]["executive_summary"]
            prd.problem_statement = prd_result["prd_analysis"]["problem_statement"]
            prd.prd_analysis = prd_result["prd_analysis"]
            prd.feature_decomposition = prd_result["feature_decomposition"]
            prd.technical_spec = prd_result["technical_spec"]
            prd.test_plan = prd_result["test_plan"]
            prd.roadmap = prd_result["roadmap"]
            prd.documents_generated = prd_result["documents_generated"]
            prd.total_user_stories = prd_result["total_user_stories"]
            prd.total_api_endpoints = prd_result["total_api_endpoints"]
            prd.total_test_scenarios = prd_result["total_test_scenarios"]
            prd.total_sprints = prd_result["total_sprints"]
            prd.estimated_duration_weeks = prd_result["estimated_duration_weeks"]
            prd.completed_at = datetime.utcnow()

            logger.info(
                "PRD generation completed",
                prd_id=str(prd_id),
                user_stories=prd.total_user_stories,
            )
        else:
            prd.status = "failed"
            prd.error_message = result.get("error", "Unknown error")

            logger.error(
                "PRD generation failed",
                prd_id=str(prd_id),
                error=prd.error_message,
            )

        await db.commit()

    except Exception as e:
        logger.error("PRD generation exception", prd_id=str(prd_id), error=str(e))

        # Update status to failed
        try:
            query = select(PRD).where(PRD.id == prd_id)
            db_result = await db.execute(query)
            prd = db_result.scalar_one_or_none()

            if prd:
                prd.status = "failed"
                prd.error_message = str(e)
                await db.commit()
        except Exception as db_error:
            logger.error("Failed to update PRD status", error=str(db_error))


@router.post("/generate", response_model=PRDGenerateResponse, status_code=status.HTTP_202_ACCEPTED)
async def generate_prd(
    request: PRDGenerateRequest,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> PRDGenerateResponse:
    """
    Generate a Product Requirements Document from plain English requirements.

    This endpoint initiates PRD generation as a background task and returns immediately.
    The PRD will be generated asynchronously and can be retrieved later.

    Args:
        request: Requirements and optional context
        background_tasks: FastAPI background tasks
        current_user: Authenticated user
        db: Database session

    Returns:
        PRDGenerateResponse with PRD ID and status
    """
    logger.info(
        "PRD generation requested",
        user_id=str(current_user.id),
        requirements_length=len(request.requirements),
    )

    # Create PRD record in database
    prd = PRD(
        user_id=current_user.id,
        organization_id=getattr(current_user, 'organization_id', None),  # Optional for demo auth
        requirements=request.requirements,
        context=request.context,
        status="generating",
    )

    db.add(prd)
    await db.commit()
    await db.refresh(prd)

    logger.info("PRD record created", prd_id=str(prd.id))

    # Start background task
    background_tasks.add_task(
        generate_prd_background,
        prd_id=prd.id,
        requirements=request.requirements,
        context=request.context,
        db=db,
    )

    return PRDGenerateResponse(
        id=prd.id,
        status="generating",
        message="PRD generation started. This may take 1-2 minutes.",
    )


@router.get("/{prd_id}", response_model=PRDDetail)
async def get_prd(
    prd_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> PRDDetail:
    """
    Get a generated PRD by ID.

    Args:
        prd_id: PRD UUID
        current_user: Authenticated user
        db: Database session

    Returns:
        PRDDetail with complete PRD information

    Raises:
        404: PRD not found or access denied
    """
    query = select(PRD).where(
        PRD.id == prd_id,
        PRD.user_id == current_user.id,  # Filter by user_id for demo auth
    )
    result = await db.execute(query)
    prd = result.scalar_one_or_none()

    if not prd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PRD not found",
        )

    return PRDDetail.model_validate(prd)


@router.get("", response_model=PRDListResponse)
async def list_prds(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status_filter: str | None = Query(None, description="Filter by status"),
) -> PRDListResponse:
    """
    List all PRDs for the current user's organization.

    Args:
        current_user: Authenticated user
        db: Database session
        page: Page number (1-indexed)
        page_size: Items per page
        status_filter: Optional status filter (generating, completed, failed)

    Returns:
        PRDListResponse with paginated list of PRDs
    """
    # Build query
    query = select(PRD).where(PRD.user_id == current_user.id)  # Filter by user_id for demo auth

    if status_filter:
        query = query.where(PRD.status == status_filter)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar_one()

    # Apply pagination
    query = query.order_by(PRD.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    # Execute query
    result = await db.execute(query)
    prds = result.scalars().all()

    return PRDListResponse(
        prds=[PRDSummary.model_validate(prd) for prd in prds],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.delete("/{prd_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_prd(
    prd_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """
    Delete a PRD.

    Args:
        prd_id: PRD UUID
        current_user: Authenticated user
        db: Database session

    Raises:
        404: PRD not found or access denied
    """
    query = select(PRD).where(
        PRD.id == prd_id,
        PRD.user_id == current_user.id,  # Filter by user_id for demo auth
    )
    result = await db.execute(query)
    prd = result.scalar_one_or_none()

    if not prd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PRD not found",
        )

    await db.delete(prd)
    await db.commit()

    logger.info("PRD deleted", prd_id=str(prd_id), user_id=str(current_user.id))


@router.get("/{prd_id}/agent-runs", response_model=list[AgentRunDetail])
async def get_prd_agent_runs(
    prd_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[AgentRunDetail]:
    """
    Get agent execution history for a PRD.

    Args:
        prd_id: PRD UUID
        current_user: Authenticated user
        db: Database session

    Returns:
        List of agent runs

    Raises:
        404: PRD not found or access denied
    """
    # Check PRD exists and user has access
    prd_query = select(PRD).where(
        PRD.id == prd_id,
        PRD.user_id == current_user.id,  # Filter by user_id for demo auth
    )
    prd_result = await db.execute(prd_query)
    prd = prd_result.scalar_one_or_none()

    if not prd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PRD not found",
        )

    # Get agent runs
    query = select(AgentRun).where(AgentRun.prd_id == prd_id).order_by(AgentRun.started_at)
    result = await db.execute(query)
    agent_runs = result.scalars().all()

    return [AgentRunDetail.model_validate(run) for run in agent_runs]


@router.get("/{prd_id}/cost", response_model=PRDCostSummary)
async def get_prd_cost(
    prd_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> PRDCostSummary:
    """
    Get cost summary for a PRD.

    Args:
        prd_id: PRD UUID
        current_user: Authenticated user
        db: Database session

    Returns:
        Cost summary with token usage and estimated costs

    Raises:
        404: PRD not found or access denied
    """
    # Check PRD exists and user has access
    prd_query = select(PRD).where(
        PRD.id == prd_id,
        PRD.user_id == current_user.id,  # Filter by user_id for demo auth
    )
    prd_result = await db.execute(prd_query)
    prd = prd_result.scalar_one_or_none()

    if not prd:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PRD not found",
        )

    # Get API usage
    query = select(APIUsage).where(APIUsage.prd_id == prd_id)
    result = await db.execute(query)
    usage_records = result.scalars().all()

    # Calculate totals
    total_calls = len(usage_records)
    total_input_tokens = sum(r.input_tokens for r in usage_records)
    total_output_tokens = sum(r.output_tokens for r in usage_records)

    # Calculate costs
    total_cost = 0.0
    by_model: dict[str, dict[str, any]] = {}

    for record in usage_records:
        input_cost = float(record.cost_per_input_token) * record.input_tokens
        output_cost = float(record.cost_per_output_token) * record.output_tokens
        record_cost = input_cost + output_cost
        total_cost += record_cost

        if record.model not in by_model:
            by_model[record.model] = {
                "calls": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "cost": 0.0,
            }

        by_model[record.model]["calls"] += 1
        by_model[record.model]["input_tokens"] += record.input_tokens
        by_model[record.model]["output_tokens"] += record.output_tokens
        by_model[record.model]["cost"] += record_cost

    return PRDCostSummary(
        total_calls=total_calls,
        total_input_tokens=total_input_tokens,
        total_output_tokens=total_output_tokens,
        total_cost=round(total_cost, 4),
        by_model=by_model,
    )
