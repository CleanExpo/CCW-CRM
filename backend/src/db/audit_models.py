"""
Audit trail models for entity-level change tracking.

Records who changed what and when across all key entities.
"""
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from src.db.models_base import Base


class AuditLog(Base):
    """
    Entity-level audit trail.

    Records every create/update/delete action on key ERP entities.
    Used for compliance, debugging, and customer dispute resolution.

    Table: audit_logs
    """

    __tablename__ = "audit_logs"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Who
    user_id: UUID | None = Column(PGUUID(as_uuid=True), nullable=True, index=True)
    user_email: str | None = Column(String(255), nullable=True)

    # What
    entity_type: str = Column(String(50), nullable=False, index=True)  # "order", "quote", "invoice", etc.
    entity_id: str = Column(String(255), nullable=False, index=True)   # UUID as string for flexibility
    action: str = Column(String(20), nullable=False, index=True)       # "create", "update", "delete"

    # Changes
    changes: dict = Column(JSONB, nullable=True)       # {"field": {"old": ..., "new": ...}}
    metadata_: dict = Column("metadata", JSONB, nullable=True, default=dict)  # extra context

    # Context
    ip_address: str | None = Column(String(45), nullable=True)
    user_agent: str | None = Column(String(500), nullable=True)
    notes: str | None = Column(Text, nullable=True)

    # When
    created_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        # Composite index for entity lookup (most common query: "show history for order X")
        Index("ix_audit_logs_entity", "entity_type", "entity_id", "created_at"),
        # Composite index for user activity lookup
        Index("ix_audit_logs_user_action", "user_id", "action", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<AuditLog(entity={self.entity_type}:{self.entity_id}, action={self.action})>"
