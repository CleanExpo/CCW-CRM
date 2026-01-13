"""SQLAlchemy models for submission notes and activity tracking."""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

from .models import Base


class SubmissionNote(Base):
    """Notes and activity tracking for form submissions."""

    __tablename__ = "submission_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # References to either contact_submissions or demo_requests
    submission_type = Column(String(20), nullable=False)  # 'contact' or 'demo'
    submission_id = Column(UUID(as_uuid=True), nullable=False)

    # Note content
    note_type = Column(String(20), nullable=False, default="note")  # 'note', 'status_change', 'email_sent'
    content = Column(Text, nullable=False)

    # Metadata
    created_by = Column(String(255), nullable=True)  # User who created the note
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Additional data (JSON-serializable dict stored as text for status changes, etc.)
    meta_data = Column(Text, nullable=True)
