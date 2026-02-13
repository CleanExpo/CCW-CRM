"""SQLAlchemy models for submission notes and activity tracking."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID

from .models_base import Base


class SubmissionNote(Base):
    """Notes and activity tracking for form submissions."""

    __tablename__ = "submission_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # References to either contact_submissions or demo_requests
    submission_type = Column(String(20), nullable=False)  # 'contact' or 'demo'
    submission_id = Column(UUID(as_uuid=True), nullable=False)

    # Note content
    note_type = Column(String(20), nullable=False, default="note")  # 'note', 'status_change', 'email_sent'  # noqa: E501
    content = Column(Text, nullable=False)

    # Metadata
    created_by = Column(String(255), nullable=True)  # User who created the note
    created_at = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Additional data (JSON-serializable dict stored as text for status changes, etc.)
    meta_data = Column(Text, nullable=True)
