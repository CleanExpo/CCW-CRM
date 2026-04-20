"""Service request models for workshop/field service tracking."""

import enum
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID  # noqa: N811
from sqlalchemy.orm import relationship

from .models_base import Base


class RequestType(str, enum.Enum):
    """Service request types."""

    repair = "repair"
    maintenance = "maintenance"
    installation = "installation"


class ServiceStatus(str, enum.Enum):
    """Service request status.

    Values are kept in sync with the frontend ServiceStatus type in
    apps/web/lib/api/service-requests.ts. Any addition here requires a
    corresponding ALTER TYPE migration (see migrations/fix_service_status_enum.sql).
    """

    submitted = "submitted"
    under_review = "under_review"
    quoted = "quoted"       # legacy alias — prefer quote_sent for new records
    quote_sent = "quote_sent"
    approved = "approved"
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class ServiceRequest(Base):
    """Service requests for workshop and field service."""

    __tablename__ = "service_requests"

    id: UUID = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4)

    # References
    customer_id: UUID = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_id: UUID | None = Column(
        PostgresUUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Request details
    request_type: str = Column(
        Enum(RequestType, name="request_type_enum", create_type=True),
        nullable=False,
        default=RequestType.repair,
    )
    status: str = Column(
        Enum(ServiceStatus, name="service_status_enum", create_type=True),
        nullable=False,
        default=ServiceStatus.submitted,
        index=True,
    )

    # Equipment and issue
    equipment_description: str = Column(Text, nullable=False)
    issue_description: str = Column(Text, nullable=False)
    photos: str | None = Column(
        JSON, nullable=True
    )  # Array of photo URLs as JSON

    # Scheduling
    assigned_technician: str | None = Column(String(255), nullable=True)
    scheduled_date: datetime | None = Column(DateTime, nullable=True)

    # Pricing
    quote_amount: float | None = Column(Numeric(10, 2), nullable=True)
    approved_amount: float | None = Column(Numeric(10, 2), nullable=True)

    # Timestamps
    created_at: datetime = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)
    updated_at: datetime = Column(
        DateTime, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False
    )

    # Relationships
    # Note: back_populates removed to avoid modifying demo_models.py
    # Add reverse relationships to Customer and Order models manually if needed
    customer = relationship("Customer")
    order = relationship("Order")

    # Table constraints
    __table_args__ = (
        CheckConstraint(
            "quote_amount IS NULL OR quote_amount >= 0",
            name="ck_quote_amount_non_negative",
        ),
        CheckConstraint(
            "approved_amount IS NULL OR approved_amount >= 0",
            name="ck_approved_amount_non_negative",
        ),
    )

    def __repr__(self) -> str:
        return f"<ServiceRequest(id={self.id}, type={self.request_type}, status={self.status})>"


# Update relationships in existing models
# Note: These will be added to demo_models.py manually to avoid modifying existing file
