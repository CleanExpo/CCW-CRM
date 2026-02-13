"""Background job management API routes."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.demo_models import BackgroundJob, JobStatus
from src.db.schemas import Job, JobCreate

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.post("/", status_code=201, response_model=Job)
async def create_job(
    job_data: JobCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> BackgroundJob:
    """Create a new background job."""

    job = BackgroundJob(
        job_type=job_data.job_type,
        status=JobStatus.PENDING,
        input_data=job_data.input_data,  # SQLAlchemy JSON column handles serialization
        progress=0,
    )

    db.add(job)
    await db.commit()
    await db.refresh(job)

    return job


@router.get("/{job_id}", response_model=Job)
async def get_job(
    job_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> BackgroundJob:
    """Get job status and results."""

    query = select(BackgroundJob).where(BackgroundJob.id == job_id)
    result = await db.execute(query)
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return job


@router.get("/", response_model=list[Job])
async def list_jobs(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    status: str | None = None,
    job_type: str | None = None,
    limit: int = 50,
) -> list[BackgroundJob]:
    """List background jobs with optional filters."""

    query = select(BackgroundJob).order_by(BackgroundJob.created_at.desc())

    if status:
        query = query.where(BackgroundJob.status == status)

    if job_type:
        query = query.where(BackgroundJob.job_type == job_type)

    query = query.limit(limit)

    result = await db.execute(query)
    jobs = result.scalars().all()

    return list(jobs)


@router.delete("/{job_id}", status_code=204)
async def delete_job(
    job_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> None:
    """Delete a background job."""

    query = select(BackgroundJob).where(BackgroundJob.id == job_id)
    result = await db.execute(query)
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    await db.delete(job)
    await db.commit()

    return None
