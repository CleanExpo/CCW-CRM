"""
CRM Models for Contact Management and Activity Tracking.

These models extend the existing Customer model with:
- Contact: Multiple contacts per customer/company
- Activity: General-purpose activity/interaction tracking
"""

import enum
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from .models_base import Base


class ActivityType(str, enum.Enum):
    """Activity type enum for CRM interactions."""

    CALL = "call"
    EMAIL = "email"
    MEETING = "meeting"
    NOTE = "note"
    TASK = "task"


class Contact(Base):
    """
    Contact model for CRM.

    Represents individual contacts that can be associated with a customer (company).
    Supports multiple contacts per customer.
    """

    __tablename__ = "contacts"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Link to customer (company) - nullable for standalone contacts
    customer_id: UUID | None = Column(
        PGUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Contact details
    first_name: str = Column(String(100), nullable=False)
    last_name: str = Column(String(100), nullable=False)
    email: str | None = Column(String(255), nullable=True, index=True)
    phone: str | None = Column(String(30), nullable=True)
    mobile: str | None = Column(String(30), nullable=True)

    # Professional info
    job_title: str | None = Column(String(100), nullable=True)
    department: str | None = Column(String(100), nullable=True)

    # Flags
    is_primary: bool = Column(Boolean, default=False, nullable=False)
    is_active: bool = Column(Boolean, default=True, nullable=False)

    # Additional info
    notes: str | None = Column(Text, nullable=True)

    # Timestamps
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    customer = relationship("Customer", backref="contacts")
    activities = relationship("Activity", back_populates="contact", cascade="all, delete-orphan")

    # Indexes for common queries
    __table_args__ = (
        Index("ix_contacts_customer_primary", "customer_id", "is_primary"),
        Index("ix_contacts_name", "first_name", "last_name"),
    )

    @property
    def full_name(self) -> str:
        """Return full name of contact."""
        return f"{self.first_name} {self.last_name}"

    def __repr__(self) -> str:
        return f"<Contact(name={self.full_name}, email={self.email})>"


class Activity(Base):
    """
    Activity model for CRM interaction tracking.

    Tracks all interactions with customers and contacts including
    calls, emails, meetings, notes, and tasks.
    """

    __tablename__ = "activities"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Activity type and content
    activity_type: str = Column(
        String(20),
        default=ActivityType.NOTE.value,
        nullable=False,
        index=True,
    )
    subject: str = Column(String(255), nullable=False)
    description: str | None = Column(Text, nullable=True)

    # Related entities (all optional - activity can relate to any/all)
    customer_id: UUID | None = Column(
        PGUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    contact_id: UUID | None = Column(
        PGUUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    order_id: UUID | None = Column(
        PGUUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    quote_id: UUID | None = Column(
        PGUUID(as_uuid=True),
        ForeignKey("quotes.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Task-specific fields
    due_date: datetime | None = Column(DateTime(timezone=True), nullable=True)
    completed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Audit fields
    created_by: str | None = Column(String(255), nullable=True)

    # Timestamps
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    customer = relationship("Customer", backref="activities")
    contact = relationship("Contact", back_populates="activities")
    order = relationship("Order", backref="crm_activities")
    quote = relationship("Quote", backref="crm_activities")

    # Indexes for common queries
    __table_args__ = (
        Index("ix_activities_customer_created", "customer_id", "created_at"),
        Index("ix_activities_type_created", "activity_type", "created_at"),
    )

    @property
    def is_completed(self) -> bool:
        """Check if activity (task) is completed."""
        return self.completed_at is not None

    @property
    def is_overdue(self) -> bool:
        """Check if task is overdue."""
        if self.due_date and not self.completed_at:
            return datetime.now(UTC) > self.due_date
        return False

    def __repr__(self) -> str:
        return f"<Activity(type={self.activity_type}, subject={self.subject[:30]})>"
