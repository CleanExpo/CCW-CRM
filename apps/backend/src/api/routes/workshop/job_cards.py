"""Workshop job card API routes — Phase 1 (UNI-1825).

Endpoints:
  GET    /api/workshop/jobs                         list job cards (paginated)
  POST   /api/workshop/jobs                         create job card
  GET    /api/workshop/jobs/{job_id}                job card detail + time logs
  PATCH  /api/workshop/jobs/{job_id}                update status / fields
  GET    /api/workshop/jobs/{job_id}/time-logs       list time logs
  POST   /api/workshop/jobs/{job_id}/time-logs       start timer / log entry
  PATCH  /api/workshop/jobs/{job_id}/time-logs/{log_id}  stop running timer
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.workshop_models import JobCard, JobCardStatus, TimeLog

router = APIRouter(prefix="/api/workshop/jobs", tags=["Workshop"])

_job_card_counter: dict[str, int] = {}


def _generate_job_number() -> str:
    year = datetime.now(UTC).year
    key = str(year)
    _job_card_counter[key] = _job_card_counter.get(key, 0) + 1
    return f"JC-{year}-{_job_card_counter[key]:04d}"


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class JobCardCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    booking_id: UUID | None = None
    service_request_id: UUID | None = None
    equipment_id: UUID | None = None
    description: str | None = None
    assigned_technician: str | None = None


class JobCardUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: JobCardStatus | None = None
    assigned_technician: str | None = None


class JobCardResponse(BaseModel):
    id: UUID
    job_number: str
    booking_id: UUID | None
    service_request_id: UUID | None
    equipment_id: UUID | None
    title: str
    description: str | None
    status: str
    assigned_technician: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedJobCardsResponse(BaseModel):
    items: list[JobCardResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class TimeLogCreate(BaseModel):
    technician_name: str = Field(min_length=1, max_length=200)
    started_at: datetime
    stopped_at: datetime | None = None
    notes: str | None = None


class TimeLogStop(BaseModel):
    stopped_at: datetime


class TimeLogResponse(BaseModel):
    id: UUID
    job_card_id: UUID
    technician_name: str
    started_at: datetime
    stopped_at: datetime | None
    duration_minutes: float | None
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Job card endpoints
# ---------------------------------------------------------------------------


@router.get("")
async def list_job_cards(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    status: str | None = None,
    equipment_id: UUID | None = None,
    booking_id: UUID | None = None,
) -> PaginatedJobCardsResponse:
    """List job cards with optional filters."""
    stmt = select(JobCard)
    if status:
        stmt = stmt.where(JobCard.status == status)
    if equipment_id:
        stmt = stmt.where(JobCard.equipment_id == equipment_id)
    if booking_id:
        stmt = stmt.where(JobCard.booking_id == booking_id)

    total_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = total_result.scalar_one()

    stmt = stmt.order_by(JobCard.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    cards = result.scalars().all()

    return PaginatedJobCardsResponse(
        items=[JobCardResponse.model_validate(c) for c in cards],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_job_card(
    payload: JobCardCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> JobCardResponse:
    """Create a new digital job card."""
    card = JobCard(
        job_number=_generate_job_number(),
        title=payload.title,
        booking_id=payload.booking_id,
        service_request_id=payload.service_request_id,
        equipment_id=payload.equipment_id,
        description=payload.description,
        assigned_technician=payload.assigned_technician,
        status=JobCardStatus.open,
    )
    db.add(card)
    try:
        await db.commit()
        await db.refresh(card)
    except Exception:
        await db.rollback()
        raise
    return JobCardResponse.model_validate(card)


@router.get("/{job_id}")
async def get_job_card(
    job_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict:
    """Get job card detail with its time logs."""
    card = await db.get(JobCard, job_id)
    if not card:
        raise HTTPException(status_code=404, detail="Job card not found")

    logs_result = await db.execute(
        select(TimeLog)
        .where(TimeLog.job_card_id == job_id)
        .order_by(TimeLog.started_at.asc())
    )
    logs = logs_result.scalars().all()

    return {
        "job_card": JobCardResponse.model_validate(card),
        "time_logs": [TimeLogResponse.model_validate(log) for log in logs],
    }


@router.patch("/{job_id}")
async def update_job_card(
    job_id: UUID,
    payload: JobCardUpdate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> JobCardResponse:
    """Update job card status or editable fields."""
    card = await db.get(JobCard, job_id)
    if not card:
        raise HTTPException(status_code=404, detail="Job card not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(card, field, value)
    card.updated_at = datetime.now(UTC)
    try:
        await db.commit()
        await db.refresh(card)
    except Exception:
        await db.rollback()
        raise
    return JobCardResponse.model_validate(card)


# ---------------------------------------------------------------------------
# Time log endpoints
# ---------------------------------------------------------------------------


@router.get("/{job_id}/time-logs")
async def list_time_logs(
    job_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> list[TimeLogResponse]:
    """List all time log entries for a job card."""
    card = await db.get(JobCard, job_id)
    if not card:
        raise HTTPException(status_code=404, detail="Job card not found")

    result = await db.execute(
        select(TimeLog)
        .where(TimeLog.job_card_id == job_id)
        .order_by(TimeLog.started_at.asc())
    )
    logs = result.scalars().all()
    return [TimeLogResponse.model_validate(log) for log in logs]


@router.post("/{job_id}/time-logs", status_code=status.HTTP_201_CREATED)
async def create_time_log(
    job_id: UUID,
    payload: TimeLogCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> TimeLogResponse:
    """Start a timer or log a complete time entry.

    Omit ``stopped_at`` to start a running timer.
    Supply both ``started_at`` and ``stopped_at`` to log a finished entry.
    ``duration_minutes`` is computed automatically when ``stopped_at`` is given.
    Creating the first log also transitions an open job card to in_progress.
    """
    card = await db.get(JobCard, job_id)
    if not card:
        raise HTTPException(status_code=404, detail="Job card not found")

    duration_minutes: float | None = None
    if payload.stopped_at is not None:
        if payload.stopped_at <= payload.started_at:
            raise HTTPException(status_code=400, detail="stopped_at must be after started_at")
        delta = payload.stopped_at - payload.started_at
        duration_minutes = delta.total_seconds() / 60.0

    log = TimeLog(
        job_card_id=job_id,
        technician_name=payload.technician_name,
        started_at=payload.started_at,
        stopped_at=payload.stopped_at,
        duration_minutes=duration_minutes,
        notes=payload.notes,
    )
    db.add(log)

    # Automatically advance an open job card to in_progress on first timer start
    if card.status == JobCardStatus.open:
        card.status = JobCardStatus.in_progress
        card.updated_at = datetime.now(UTC)

    try:
        await db.commit()
        await db.refresh(log)
    except Exception:
        await db.rollback()
        raise
    return TimeLogResponse.model_validate(log)


@router.patch("/{job_id}/time-logs/{log_id}")
async def stop_time_log(
    job_id: UUID,
    log_id: UUID,
    payload: TimeLogStop,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> TimeLogResponse:
    """Stop a running timer and record duration."""
    log = await db.get(TimeLog, log_id)
    if not log or log.job_card_id != job_id:
        raise HTTPException(status_code=404, detail="Time log not found")
    if log.stopped_at is not None:
        raise HTTPException(status_code=400, detail="Timer already stopped")
    if payload.stopped_at <= log.started_at:
        raise HTTPException(status_code=400, detail="stopped_at must be after started_at")

    delta = payload.stopped_at - log.started_at
    log.stopped_at = payload.stopped_at
    log.duration_minutes = delta.total_seconds() / 60.0
    log.updated_at = datetime.now(UTC)

    try:
        await db.commit()
        await db.refresh(log)
    except Exception:
        await db.rollback()
        raise
    return TimeLogResponse.model_validate(log)
