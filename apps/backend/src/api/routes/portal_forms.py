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
from src.db.submission_notes_models import SubmissionNote
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


class StatusUpdate(BaseModel):
    status: str


class NoteCreate(BaseModel):
    content: str
    created_by: str | None = None


class NoteResponse(BaseModel):
    id: UUID
    submission_type: str
    submission_id: UUID
    note_type: str
    content: str
    created_by: str | None
    created_at: datetime

    @field_serializer('id', 'submission_id')
    def serialize_uuid(self, value: UUID) -> str:
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


# Single Contact Submission Endpoints
@router.get("/contact-submissions/{submission_id}", response_model=ContactSubmissionResponse)
async def get_contact_submission(
    submission_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """Get a single contact submission by ID."""
    result = await db.execute(
        select(ContactSubmission).where(ContactSubmission.id == submission_id)
    )
    submission = result.scalar_one_or_none()

    if not submission:
        raise HTTPException(status_code=404, detail="Contact submission not found")

    return ContactSubmissionResponse.model_validate(submission)


@router.patch("/contact-submissions/{submission_id}/status", response_model=ContactSubmissionResponse)
async def update_contact_submission_status(
    submission_id: UUID,
    status_update: StatusUpdate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """Update the status of a contact submission."""
    result = await db.execute(
        select(ContactSubmission).where(ContactSubmission.id == submission_id)
    )
    submission = result.scalar_one_or_none()

    if not submission:
        raise HTTPException(status_code=404, detail="Contact submission not found")

    # Validate status
    valid_statuses = ["new", "read", "responded", "closed"]
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")

    old_status = submission.status
    submission.status = status_update.status
    submission.updated_at = datetime.utcnow()

    # Create a status change note
    note = SubmissionNote(
        submission_type="contact",
        submission_id=submission_id,
        note_type="status_change",
        content=f"Status changed from {old_status} to {status_update.status}",
        created_by="system",
    )
    db.add(note)

    await db.commit()
    await db.refresh(submission)

    return ContactSubmissionResponse.model_validate(submission)


# Single Demo Request Endpoints
@router.get("/demo-requests/{request_id}", response_model=DemoRequestResponse)
async def get_demo_request(
    request_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """Get a single demo request by ID."""
    result = await db.execute(
        select(DemoRequest).where(DemoRequest.id == request_id)
    )
    demo_request = result.scalar_one_or_none()

    if not demo_request:
        raise HTTPException(status_code=404, detail="Demo request not found")

    return DemoRequestResponse.model_validate(demo_request)


@router.patch("/demo-requests/{request_id}/status", response_model=DemoRequestResponse)
async def update_demo_request_status(
    request_id: UUID,
    status_update: StatusUpdate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """Update the status of a demo request."""
    result = await db.execute(
        select(DemoRequest).where(DemoRequest.id == request_id)
    )
    demo_request = result.scalar_one_or_none()

    if not demo_request:
        raise HTTPException(status_code=404, detail="Demo request not found")

    # Validate status
    valid_statuses = ["pending", "scheduled", "completed", "cancelled"]
    if status_update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")

    old_status = demo_request.status
    demo_request.status = status_update.status
    demo_request.updated_at = datetime.utcnow()

    # Create a status change note
    note = SubmissionNote(
        submission_type="demo",
        submission_id=request_id,
        note_type="status_change",
        content=f"Status changed from {old_status} to {status_update.status}",
        created_by="system",
    )
    db.add(note)

    await db.commit()
    await db.refresh(demo_request)

    return DemoRequestResponse.model_validate(demo_request)


# Notes Endpoints
@router.post("/submissions/{submission_type}/{submission_id}/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_submission_note(
    submission_type: str,
    submission_id: UUID,
    note_data: NoteCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """Create a note for a submission (contact or demo)."""
    # Validate submission_type
    if submission_type not in ["contact", "demo"]:
        raise HTTPException(status_code=400, detail="submission_type must be 'contact' or 'demo'")

    # Verify submission exists
    if submission_type == "contact":
        result = await db.execute(
            select(ContactSubmission).where(ContactSubmission.id == submission_id)
        )
        submission = result.scalar_one_or_none()
    else:
        result = await db.execute(
            select(DemoRequest).where(DemoRequest.id == submission_id)
        )
        submission = result.scalar_one_or_none()

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Create note
    note = SubmissionNote(
        submission_type=submission_type,
        submission_id=submission_id,
        note_type="note",
        content=note_data.content,
        created_by=note_data.created_by or "admin",
    )

    db.add(note)
    await db.commit()
    await db.refresh(note)

    return NoteResponse.model_validate(note)


@router.get("/submissions/{submission_type}/{submission_id}/notes")
async def list_submission_notes(
    submission_type: str,
    submission_id: UUID,
    db: Annotated[AsyncSession, Depends(get_async_db)],
):
    """Get all notes for a submission."""
    # Validate submission_type
    if submission_type not in ["contact", "demo"]:
        raise HTTPException(status_code=400, detail="submission_type must be 'contact' or 'demo'")

    # Get notes
    query = select(SubmissionNote).where(
        SubmissionNote.submission_type == submission_type,
        SubmissionNote.submission_id == submission_id,
    ).order_by(SubmissionNote.created_at.desc())

    result = await db.execute(query)
    notes = result.scalars().all()

    return [NoteResponse.model_validate(note) for note in notes]
