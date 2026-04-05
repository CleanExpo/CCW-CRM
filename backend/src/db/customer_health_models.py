"""
Customer Health & Onboarding Models — UNI-1112, UNI-1113

New models that extend the CRM without touching demo_models.py:
- CustomerPersona  : auto-classified persona tag per customer (UNI-1112)
- OnboardingSequence : Day-1/7/30 touchpoint tracking (UNI-1113)
- OnboardingTouchpoint : individual email records
"""
from __future__ import annotations

import enum
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from src.db.models_base import Base


class PersonaType(str, enum.Enum):
    HIGH_VALUE       = "high_value"
    EQUIPMENT_BUYER  = "equipment_buyer"
    CONSUMABLES      = "consumables"
    CONTRACTOR       = "contractor"
    NEW_ACCOUNT      = "new_account"
    DORMANT          = "dormant"
    UNCLASSIFIED     = "unclassified"


class OnboardingStatus(str, enum.Enum):
    ACTIVE    = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TouchpointStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    SENT      = "sent"
    SKIPPED   = "skipped"
    FAILED    = "failed"


class CustomerPersona(Base):
    """Persona tag per customer — UNI-1112."""
    __tablename__ = "customer_personas"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"),
                         nullable=False, unique=True, index=True)
    persona     = Column(String(50), nullable=False, default=PersonaType.UNCLASSIFIED.value)
    confidence  = Column(String(10), nullable=False, default="low")
    reason      = Column(Text, nullable=True)
    classified_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at    = Column(DateTime(timezone=True), server_default=func.now(),
                           onupdate=func.now(), nullable=False)


class OnboardingSequence(Base):
    """Onboarding sequence per customer — UNI-1113."""
    __tablename__ = "onboarding_sequences"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    customer_id  = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"),
                          nullable=False, index=True)
    status       = Column(String(20), nullable=False, default=OnboardingStatus.ACTIVE.value)
    triggered_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class OnboardingTouchpoint(Base):
    """Individual Day-1 / Day-7 / Day-30 email record — UNI-1113."""
    __tablename__ = "onboarding_touchpoints"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    sequence_id = Column(UUID(as_uuid=True), ForeignKey("onboarding_sequences.id", ondelete="CASCADE"),
                         nullable=False, index=True)
    day         = Column(String(5), nullable=False)   # "1", "7", "30"
    status      = Column(String(20), nullable=False, default=TouchpointStatus.SCHEDULED.value)
    scheduled_at  = Column(DateTime(timezone=True), nullable=False)
    sent_at       = Column(DateTime(timezone=True), nullable=True)
    email_subject = Column(String(200), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
