"""
SQLAlchemy ORM Models

Database models matching the PostgreSQL schema from init-db.sql.
These are separate from Pydantic models (used for API validation).
"""
# ruff: noqa: E501

import enum
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    Time,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, relationship

# from pgvector.sqlalchemy import Vector  # Temporarily disabled for demo


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""

    pass


class AustralianState(str, enum.Enum):
    """Australian states and territories (matching database ENUM)."""

    QLD = "QLD"  # Queensland
    NSW = "NSW"  # New South Wales
    VIC = "VIC"  # Victoria
    SA = "SA"  # South Australia
    WA = "WA"  # Western Australia
    TAS = "TAS"  # Tasmania
    NT = "NT"  # Northern Territory
    ACT = "ACT"  # Australian Capital Territory


class AvailabilityStatus(str, enum.Enum):
    """Availability status for contractor slots (matching database ENUM)."""

    AVAILABLE = "available"
    BOOKED = "booked"
    TENTATIVE = "tentative"
    UNAVAILABLE = "unavailable"


class User(Base):
    """
    User model for JWT authentication.

    Table: users
    """

    __tablename__ = "users"
    __allow_unmapped__ = True  # Allow unmapped relationships for compatibility

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    email: str = Column(String(255), unique=True, nullable=False, index=True)
    password_hash: str = Column("hashed_password", String(255), nullable=False)  # Maps to hashed_password column
    full_name: str | None = Column(String(255), nullable=True)
    role: str = Column(String(50), nullable=False, default="employee")
    is_active: bool = Column(Boolean, default=True, nullable=False, index=True)
    is_admin: bool = Column(Boolean, default=False, nullable=False)
    organization_id: UUID | None = Column(PGUUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
    # last_login_at: datetime | None = Column(DateTime(timezone=True), nullable=True)  # Column doesn't exist in DB

    # Relationships - Disabled for ERP demo
    # contractors = relationship("Contractor", back_populates="user")
    # documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    # prds relationship removed - causing SQLAlchemy issues, use PRD.user_id foreign key instead

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email})>"


class Contractor(Base):
    """
    Contractor model for tracking contractor information.

    Table: contractors
    """

    __tablename__ = "contractors"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: UUID | None = Column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    name: str = Column(String(100), nullable=False)
    mobile: str = Column(String(20), nullable=False, index=True)
    abn: str | None = Column(String(20), nullable=True, index=True)
    email: str | None = Column(String(255), nullable=True)
    specialisation: str | None = Column(String(100), nullable=True)
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships - Disabled for ERP demo
    # user = relationship("User", back_populates="contractors")
    availability_slots = relationship(
        "AvailabilitySlot", back_populates="contractor", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Contractor(id={self.id}, name={self.name})>"


class AvailabilitySlot(Base):
    """
    Availability slot model for contractor scheduling.

    Table: availability_slots
    """

    __tablename__ = "availability_slots"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    contractor_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("contractors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    date: datetime = Column(DateTime(timezone=True), nullable=False, index=True)
    start_time: datetime = Column(Time, nullable=False)
    end_time: datetime = Column(Time, nullable=False)
    suburb: str = Column(String(100), nullable=False, index=True)
    state: AustralianState = Column(
        Enum(AustralianState, name="australian_state"),
        nullable=False,
        default=AustralianState.QLD,
        index=True,
    )
    postcode: str | None = Column(String(10), nullable=True)
    status: AvailabilityStatus = Column(
        Enum(AvailabilityStatus, name="availability_status"),
        default=AvailabilityStatus.AVAILABLE,
        index=True,
    )
    notes: str | None = Column(Text, nullable=True)
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
    contractor = relationship("Contractor", back_populates="availability_slots")

    def __repr__(self) -> str:
        return f"<AvailabilitySlot(id={self.id}, contractor_id={self.contractor_id}, date={self.date})>"


class Document(Base):
    """
    Document model for RAG/semantic search with pgvector.

    Table: documents
    """

    __tablename__ = "documents"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: UUID | None = Column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    title: str = Column(String(255), nullable=False)
    content: str = Column(Text, nullable=False)
    # embedding: Optional[list[float]] = Column(Vector(1536), nullable=True)  # Temporarily disabled for demo
    metadata_: dict = Column("metadata", JSONB, default=dict, nullable=False)  # Renamed to avoid SQLAlchemy conflict
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships - Disabled for ERP demo
    # user = relationship("User", back_populates="documents")

    def __repr__(self) -> str:
        return f"<Document(id={self.id}, title={self.title})>"


class AlertSeverity(str, enum.Enum):
    """Alert severity levels."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class AlertStatus(str, enum.Enum):
    """Alert status."""

    UNREAD = "unread"
    READ = "read"
    DISMISSED = "dismissed"
    ACTIONED = "actioned"


class Alert(Base):
    """
    Alert model for system notifications and approval requests.

    Table: alerts
    """

    __tablename__ = "alerts"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    alert_type: str = Column(String(100), nullable=False, index=True)
    severity: AlertSeverity = Column(
        Enum(AlertSeverity, name="alert_severity", create_type=True),
        nullable=False,
        default=AlertSeverity.MEDIUM,
        index=True,
    )
    status: AlertStatus = Column(
        Enum(AlertStatus, name="alert_status", create_type=True),
        nullable=False,
        default=AlertStatus.UNREAD,
        index=True,
    )
    title: str = Column(String(255), nullable=False)
    message: str = Column(Text, nullable=False)
    entity_type: str | None = Column(String(100), nullable=True)
    entity_id: UUID | None = Column(PGUUID(as_uuid=True), nullable=True)
    assigned_to: UUID | None = Column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    metadata_: dict = Column("metadata", JSONB, default=dict, nullable=False)
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )
    read_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    dismissed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    actioned_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    assigned_user = relationship("User", foreign_keys=[assigned_to])

    def __repr__(self) -> str:
        return f"<Alert(id={self.id}, type={self.alert_type}, severity={self.severity}, status={self.status})>"

    def to_dict(self) -> dict:
        """Convert alert to dictionary."""
        return {
            "id": str(self.id),
            "alert_type": self.alert_type,
            "severity": self.severity.value,
            "status": self.status.value,
            "title": self.title,
            "message": self.message,
            "entity_type": self.entity_type,
            "entity_id": str(self.entity_id) if self.entity_id else None,
            "assigned_to": str(self.assigned_to) if self.assigned_to else None,
            "metadata": self.metadata_,
            "created_at": self.created_at.isoformat(),
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "dismissed_at": self.dismissed_at.isoformat() if self.dismissed_at else None,
            "actioned_at": self.actioned_at.isoformat() if self.actioned_at else None,
        }
