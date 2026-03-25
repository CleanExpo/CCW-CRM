"""Workflow automation, SLA, and in-app notification models."""
from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from .models_base import Base


class WorkflowTemplate(Base):
    """Reusable workflow template with trigger event and ordered actions."""

    __tablename__ = "workflow_templates"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: str = Column(String(255), nullable=False)
    description: str | None = Column(Text, nullable=True)
    trigger_event: str = Column(String(100), nullable=False, index=True)
    trigger_conditions: dict | None = Column(JSONB, nullable=True)
    is_active: bool = Column(Boolean, default=True, nullable=False, index=True)
    created_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    actions = relationship(
        "WorkflowTemplateAction",
        back_populates="template",
        cascade="all, delete-orphan",
    )
    instances = relationship("WorkflowInstance", back_populates="template")

    def __repr__(self) -> str:
        return f"<WorkflowTemplate(name={self.name}, trigger={self.trigger_event}, active={self.is_active})>"


class WorkflowTemplateAction(Base):
    """Individual action step within a workflow template."""

    __tablename__ = "workflow_template_actions"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    template_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("workflow_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # send_email | create_task | create_in_app_notification
    action_type: str = Column(String(100), nullable=False)
    action_config: dict | None = Column(JSONB, nullable=True)
    order: int = Column(Integer, default=0, nullable=False)
    created_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    template = relationship("WorkflowTemplate", back_populates="actions")

    def __repr__(self) -> str:
        return f"<WorkflowTemplateAction(template_id={self.template_id}, type={self.action_type}, order={self.order})>"


class WorkflowInstance(Base):
    """A running or completed execution of a workflow template."""

    __tablename__ = "workflow_instances"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    template_id: UUID | None = Column(
        PGUUID(as_uuid=True),
        ForeignKey("workflow_templates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    trigger_entity_type: str = Column(String(100), nullable=False)
    # Bare UUID — no FK constraint, entity may be in any table
    trigger_entity_id: UUID | None = Column(PGUUID(as_uuid=True), nullable=True)
    # running | completed | failed
    status: str = Column(String(50), default="running", nullable=False, index=True)
    started_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    completed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    error_message: str | None = Column(Text, nullable=True)

    # Relationships
    template = relationship("WorkflowTemplate", back_populates="instances")

    def __repr__(self) -> str:
        return f"<WorkflowInstance(template_id={self.template_id}, status={self.status})>"


class SLARule(Base):
    """SLA rule definition: entity type + deadline hours + escalation action."""

    __tablename__ = "sla_rules"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: str = Column(String(255), nullable=False)
    entity_type: str = Column(String(100), nullable=False, index=True)
    sla_hours: int = Column(Integer, nullable=False)
    # send_email | create_notification
    escalation_action: str = Column(String(100), nullable=False)
    escalation_config: dict | None = Column(JSONB, nullable=True)
    is_active: bool = Column(Boolean, default=True, nullable=False, index=True)
    created_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    instances = relationship("SLAInstance", back_populates="rule")

    def __repr__(self) -> str:
        return f"<SLARule(name={self.name}, entity_type={self.entity_type}, sla_hours={self.sla_hours})>"


class SLAInstance(Base):
    """A tracked SLA deadline for a specific entity."""

    __tablename__ = "sla_instances"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    sla_rule_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("sla_rules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Bare UUID — entity may be in orders, quotes, or any other table
    entity_id: UUID = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    entity_type: str = Column(String(100), nullable=False)
    deadline: datetime = Column(DateTime(timezone=True), nullable=False, index=True)
    breached: bool = Column(Boolean, default=False, nullable=False, index=True)
    breach_notified: bool = Column(Boolean, default=False, nullable=False)
    created_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relationships
    rule = relationship("SLARule", back_populates="instances")

    def __repr__(self) -> str:
        return f"<SLAInstance(rule_id={self.sla_rule_id}, entity_id={self.entity_id}, breached={self.breached})>"


class InAppNotification(Base):
    """In-app notification for a user (workflow, SLA, approval, or system events)."""

    __tablename__ = "in_app_notifications"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    # Bare UUID — no FK to demo_models.py users table (established convention)
    user_id: UUID = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    title: str = Column(String(255), nullable=False)
    message: str = Column(Text, nullable=False)
    # workflow | sla | approval | system
    notification_type: str = Column(String(100), nullable=False, index=True)
    entity_type: str | None = Column(String(100), nullable=True)
    # Bare UUID — entity may be in any table
    entity_id: UUID | None = Column(PGUUID(as_uuid=True), nullable=True)
    is_read: bool = Column(Boolean, default=False, nullable=False, index=True)
    created_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
        index=True,
    )

    def __repr__(self) -> str:
        return f"<InAppNotification(user_id={self.user_id}, type={self.notification_type}, read={self.is_read})>"
