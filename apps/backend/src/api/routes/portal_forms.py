"""API routes for portal form submissions."""

from typing import Annotated
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr, field_serializer
from datetime import datetime

from src.config.database import get_async_db
from src.db.portal_forms_models import (
    ContactSubmission,
    ContactSource,
    ContactStatus,
    DemoRequest,
    DemoRequestStatus,
)
from src.services.email_notifications import email_service

router = APIRouter(prefix="/api", tags=["Portal Forms"])


# Pydantic Schemas
class ContactSubmissionCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    subject: str | None = None
    message: str
    source: ContactSource


class ContactSubmissionResponse(BaseModel):
    id: UUID
    name: str
    email: str
    phone: str | None
    subject: str | None
    message: str
    source: str  # Database stores as string with CHECK constraint
    status: str  # Database stores as string with CHECK constraint
    created_at: datetime
    updated_at: datetime

    @field_serializer('id')
    def serialize_id(self, value: UUID) -> str:
        return str(value)

    class Config:
        from_attributes = True


class DemoRequestCreate(BaseModel):
    company_name: str
    contact_name: str
    email: EmailStr
    phone: str
    product_interest: str | None = None
    preferred_date: str | None = None
    notes: str | None = None


class DemoRequestResponse(BaseModel):
    id: UUID
    company_name: str
    contact_name: str
    email: str
    phone: str
    product_interest: str | None
    preferred_date: datetime | None
    notes: str | None
    status: str  # Database stores as string with CHECK constraint
    created_at: datetime
    updated_at: datetime

    @field_serializer('id')
    def serialize_id(self, value: UUID) -> str:
        return str(value)

    class Config:
        from_attributes = True


# Contact Submission Endpoints
@router.post("/contact-submissions", response_model=ContactSubmissionResponse, status_code=status.HTTP_201_CREATED)
async def create_contact_submission(
    submission_data: ContactSubmissionCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """Create a new contact submission."""
    submission = ContactSubmission(
        name=submission_data.name,
        email=submission_data.email,
        phone=submission_data.phone,
        subject=submission_data.subject,
        message=submission_data.message,
        source=submission_data.source.value,  # Convert enum to string
        status=ContactStatus.NEW.value,  # Convert enum to string
    )

    db.add(submission)
    await db.commit()
    await db.refresh(submission)

    # Send email notification (non-blocking, failures are logged but don't prevent response)
    try:
        email_service.send_contact_submission_notification(
            submission_id=str(submission.id),
            name=submission.name,
            email=submission.email,
            phone=submission.phone,
            subject=submission.subject,
            message=submission.message,
            source=submission.source,
            created_at=submission.created_at,
        )
    except Exception:
        # Log error but don't fail the request
        pass

    return ContactSubmissionResponse.model_validate(submission)


@router.get("/contact-submissions")
async def list_contact_submissions(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = 1,
    page_size: int = 50,
    status_filter: ContactStatus | None = None,
):
    """List contact submissions (admin endpoint)."""
    query = select(ContactSubmission)

    if status_filter:
        query = query.where(ContactSubmission.status == status_filter)

    # Count total
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.order_by(ContactSubmission.created_at.desc()).limit(page_size).offset((page - 1) * page_size)

    result = await db.execute(query)
    submissions = result.scalars().all()

    return {
        "items": [ContactSubmissionResponse.model_validate(s) for s in submissions],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


# Demo Request Endpoints
@router.post("/demo-requests", response_model=DemoRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_demo_request(
    request_data: DemoRequestCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """Create a new demo request."""
    demo_request = DemoRequest(
        company_name=request_data.company_name,
        contact_name=request_data.contact_name,
        email=request_data.email,
        phone=request_data.phone,
        product_interest=request_data.product_interest,
        preferred_date=datetime.fromisoformat(request_data.preferred_date) if request_data.preferred_date else None,
        notes=request_data.notes,
        status=DemoRequestStatus.PENDING.value,  # Convert enum to string
    )

    db.add(demo_request)
    await db.commit()
    await db.refresh(demo_request)

    # Send email notification (non-blocking, failures are logged but don't prevent response)
    try:
        email_service.send_demo_request_notification(
            request_id=str(demo_request.id),
            company_name=demo_request.company_name,
            contact_name=demo_request.contact_name,
            email=demo_request.email,
            phone=demo_request.phone,
            product_interest=demo_request.product_interest,
            preferred_date=demo_request.preferred_date,
            notes=demo_request.notes,
            created_at=demo_request.created_at,
        )
    except Exception:
        # Log error but don't fail the request
        pass

    return DemoRequestResponse.model_validate(demo_request)


@router.get("/demo-requests")
async def list_demo_requests(
    db: Annotated[AsyncSession, Depends(get_async_db)],
    page: int = 1,
    page_size: int = 50,
    status_filter: DemoRequestStatus | None = None,
):
    """List demo requests (admin endpoint)."""
    query = select(DemoRequest)

    if status_filter:
        query = query.where(DemoRequest.status == status_filter)

    # Count total
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    # Apply pagination
    query = query.order_by(DemoRequest.created_at.desc()).limit(page_size).offset((page - 1) * page_size)

    result = await db.execute(query)
    requests = result.scalars().all()

    return {
        "items": [DemoRequestResponse.model_validate(r) for r in requests],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }
