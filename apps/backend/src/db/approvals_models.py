"""
Approvals workflow models for multi-level authorization.
"""

import enum
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from .models import Base


class ApprovalStatus(str, enum.Enum):
    """Approval status enum."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class ApprovalType(str, enum.Enum):
    """Approval type enum."""

    ORDER = "order"
    QUOTE = "quote"
    PURCHASE_ORDER = "purchase_order"
    DISCOUNT = "discount"
    CREDIT_NOTE = "credit_note"


class Approval(Base):
    """Multi-level approval workflow."""

    __tablename__ = "approvals"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    approval_type: str = Column(String(50), nullable=False, index=True)
    entity_id: UUID = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    entity_type: str = Column(String(50), nullable=False)  # 'order', 'quote', etc.

    status: str = Column(
        String(20),
        default=ApprovalStatus.PENDING,
        nullable=False,
        index=True,
    )

    total_steps: int = Column(Integer, nullable=False, default=1)
    current_step: int = Column(Integer, nullable=False, default=1)

    requested_by: UUID = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    notes: str | None = Column(Text, nullable=True)

    created_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
        index=True,
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
    completed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    steps = relationship("ApprovalStep", back_populates="approval", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Approval(type={self.approval_type}, entity_id={self.entity_id}, status={self.status})>"


class ApprovalStep(Base):
    """Individual step in approval workflow."""

    __tablename__ = "approval_steps"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    approval_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("approvals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    step_number: int = Column(Integer, nullable=False)
    approver_id: UUID = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    approver_role: str | None = Column(String(100), nullable=True)

    status: str = Column(
        String(20),
        default=ApprovalStatus.PENDING,
        nullable=False,
        index=True,
    )

    comments: str | None = Column(Text, nullable=True)

    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    reviewed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    approval = relationship("Approval", back_populates="steps")

    def __repr__(self) -> str:
        return f"<ApprovalStep(approval_id={self.approval_id}, step={self.step_number}, status={self.status})>"
