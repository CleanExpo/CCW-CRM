"""SQLAlchemy models for portal form submissions."""

from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
import enum

from .models import Base


class ContactSource(str, enum.Enum):
    """Source of contact submission."""
    WALK_IN = "walk-in"
    INTERNET = "internet"
    PHONE = "phone"
    SERVICE = "service"


class ContactStatus(str, enum.Enum):
    """Status of contact submission."""
    NEW = "new"
    READ = "read"
    RESPONDED = "responded"
    CLOSED = "closed"


class DemoRequestStatus(str, enum.Enum):
    """Status of demo request."""
    PENDING = "pending"
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ContactSubmission(Base):
    """Contact form submissions from portal users."""

    __tablename__ = "contact_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    subject = Column(String(500), nullable=True)
    message = Column(Text, nullable=False)
    source = Column(String(20), nullable=False)  # Uses CHECK constraint in DB
    status = Column(String(20), default="new", nullable=False)  # Uses CHECK constraint in DB
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class DemoRequest(Base):
    """Demo request submissions from potential customers."""

    __tablename__ = "demo_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_name = Column(String(255), nullable=False)
    contact_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=False)
    product_interest = Column(Text, nullable=True)
    preferred_date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String(20), default="pending", nullable=False)  # Uses CHECK constraint in DB
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
