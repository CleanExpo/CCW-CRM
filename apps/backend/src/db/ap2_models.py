"""
Google Agent Payments Protocol (AP2) Database Models.

This module defines SQLAlchemy ORM models for the AP2 integration,
supporting payment processing, voice commerce, and agent-to-agent transactions.
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
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from src.db.models_base import Base


class AP2ConnectionStatus(str, enum.Enum):
    """AP2 connection status."""

    PENDING = "pending"
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"


class AP2MandateType(str, enum.Enum):
    """AP2 mandate types."""

    INTENT = "intent"  # User expresses purchase intent
    CART = "cart"  # Cart with items ready for checkout
    PAYMENT = "payment"  # Payment authorization


class AP2MandateStatus(str, enum.Enum):
    """AP2 mandate status."""

    PENDING = "pending"
    VERIFIED = "verified"
    EXECUTED = "executed"
    EXPIRED = "expired"
    REVOKED = "revoked"


class AP2TransactionStatus(str, enum.Enum):
    """AP2 transaction status."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class AP2VoiceSessionStatus(str, enum.Enum):
    """AP2 voice session status."""

    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"
    ERROR = "error"


class AP2Connection(Base):
    """
    AP2 OAuth connections and credentials.

    Stores OAuth tokens and connection state for AP2 integration.
    """

    __tablename__ = "ap2_connections"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: UUID | None = Column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    organization_id: UUID | None = Column(
        PGUUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True
    )

    # OAuth credentials
    access_token: str | None = Column(Text, nullable=True)
    refresh_token: str | None = Column(Text, nullable=True)
    token_expires_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Connection metadata
    status: AP2ConnectionStatus = Column(
        Enum(AP2ConnectionStatus, name="ap2_connection_status"),
        nullable=False,
        default=AP2ConnectionStatus.PENDING,
        index=True,
    )
    google_account_id: str | None = Column(String(255), nullable=True)
    google_account_email: str | None = Column(String(255), nullable=True)

    # Timestamps
    connected_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    last_used_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
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
    mandates = relationship("AP2Mandate", back_populates="connection", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<AP2Connection(id={self.id}, status={self.status})>"


class AP2Mandate(Base):
    """
    AP2 payment mandates.

    Cryptographically-signed authorizations for purchases.
    Chain: Intent → Cart → Payment
    """

    __tablename__ = "ap2_mandates"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    connection_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("ap2_connections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Mandate details
    mandate_type: AP2MandateType = Column(
        Enum(AP2MandateType, name="ap2_mandate_type"),
        nullable=False,
        index=True,
    )
    status: AP2MandateStatus = Column(
        Enum(AP2MandateStatus, name="ap2_mandate_status"),
        nullable=False,
        default=AP2MandateStatus.PENDING,
        index=True,
    )

    # Intent data (for INTENT mandates)
    intent_description: str | None = Column(Text, nullable=True)
    intent_language: str | None = Column(String(10), nullable=True)

    # Cart data (for CART mandates)
    cart_items: dict | None = Column(JSONB, nullable=True)
    cart_total: float | None = Column(Numeric(10, 2), nullable=True)

    # Payment data (for PAYMENT mandates)
    payment_amount: float | None = Column(Numeric(10, 2), nullable=True)
    payment_currency: str | None = Column(String(3), default="AUD", nullable=True)
    payment_method: str | None = Column(String(100), nullable=True)

    # Cryptographic verification
    signature: str | None = Column(Text, nullable=True)
    signature_algorithm: str | None = Column(String(50), default="RS256", nullable=True)
    public_key: str | None = Column(Text, nullable=True)

    # Chain references
    parent_mandate_id: UUID | None = Column(
        PGUUID(as_uuid=True), ForeignKey("ap2_mandates.id", ondelete="SET NULL"), nullable=True
    )

    # Expiry
    expires_at: datetime = Column(
        DateTime(timezone=True), nullable=False
    )  # Default: NOW() + 1 hour
    verified_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    executed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    mandate_metadata: dict | None = Column(JSONB, nullable=True)

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
    connection = relationship("AP2Connection", back_populates="mandates")
    transactions = relationship("AP2Transaction", back_populates="mandate", cascade="all, delete-orphan")
    parent_mandate = relationship("AP2Mandate", remote_side=[id], backref="child_mandates")

    def __repr__(self) -> str:
        return f"<AP2Mandate(id={self.id}, type={self.mandate_type}, status={self.status})>"


class AP2Transaction(Base):
    """
    AP2 payment transactions.

    Records all payment transactions with full audit trail.
    """

    __tablename__ = "ap2_transactions"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    mandate_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("ap2_mandates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Transaction details
    transaction_type: str = Column(String(50), nullable=False)  # payment, refund, void
    status: AP2TransactionStatus = Column(
        Enum(AP2TransactionStatus, name="ap2_transaction_status"),
        nullable=False,
        default=AP2TransactionStatus.PENDING,
        index=True,
    )

    # Financial details
    amount: float = Column(Numeric(10, 2), nullable=False)
    currency: str = Column(String(3), default="AUD", nullable=False)
    fee: float | None = Column(Numeric(10, 2), nullable=True)
    net_amount: float | None = Column(Numeric(10, 2), nullable=True)

    # External references
    google_transaction_id: str | None = Column(String(255), nullable=True, unique=True, index=True)
    payment_method: str | None = Column(String(100), nullable=True)

    # Order reference
    order_id: UUID | None = Column(
        PGUUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True
    )

    # Status tracking
    processing_started_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    completed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    failed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    error_message: str | None = Column(Text, nullable=True)

    # Audit trail
    transaction_metadata: dict | None = Column(JSONB, nullable=True)

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
    mandate = relationship("AP2Mandate", back_populates="transactions")

    def __repr__(self) -> str:
        return f"<AP2Transaction(id={self.id}, type={self.transaction_type}, status={self.status})>"


class AP2VoiceSession(Base):
    """
    AP2 voice commerce sessions.

    Tracks voice interactions for voice-based ordering.
    """

    __tablename__ = "ap2_voice_sessions"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    connection_id: UUID | None = Column(
        PGUUID(as_uuid=True),
        ForeignKey("ap2_connections.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Session details
    status: AP2VoiceSessionStatus = Column(
        Enum(AP2VoiceSessionStatus, name="ap2_voice_session_status"),
        nullable=False,
        default=AP2VoiceSessionStatus.ACTIVE,
        index=True,
    )
    language: str = Column(String(10), nullable=False, default="en")

    # Voice assistant
    assistant_type: str = Column(String(50), nullable=True)  # siri, google_assistant, alexa

    # Conversation tracking
    turn_count: int = Column(Integer, default=0, nullable=False)
    conversation_history: list[dict] | None = Column(JSONB, nullable=True)

    # Intent detection
    detected_intent: str | None = Column(String(100), nullable=True)
    intent_confidence: float | None = Column(Numeric(5, 4), nullable=True)

    # Order reference
    mandate_id: UUID | None = Column(
        PGUUID(as_uuid=True), ForeignKey("ap2_mandates.id", ondelete="SET NULL"), nullable=True
    )
    order_id: UUID | None = Column(
        PGUUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True
    )

    # Session lifecycle
    started_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    completed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    abandoned_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Metadata
    session_metadata: dict | None = Column(JSONB, nullable=True)

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

    def __repr__(self) -> str:
        return f"<AP2VoiceSession(id={self.id}, status={self.status}, language={self.language})>"


class AP2AgentInteraction(Base):
    """
    AP2 agent-to-agent commerce interactions.

    Logs interactions between AI agents for autonomous ordering.
    """

    __tablename__ = "ap2_agent_interactions"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    connection_id: UUID | None = Column(
        PGUUID(as_uuid=True),
        ForeignKey("ap2_connections.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Agent details
    source_agent_id: str = Column(String(255), nullable=False)
    source_agent_type: str | None = Column(String(100), nullable=True)
    target_agent_id: str | None = Column(String(255), nullable=True)

    # Interaction details
    interaction_type: str = Column(String(100), nullable=False)  # query, order, cancel, status_check
    request_data: dict | None = Column(JSONB, nullable=True)
    response_data: dict | None = Column(JSONB, nullable=True)

    # Status
    status: str = Column(String(50), nullable=False, default="pending")
    success: bool | None = Column(Boolean, nullable=True)
    error_message: str | None = Column(Text, nullable=True)

    # Order reference
    mandate_id: UUID | None = Column(
        PGUUID(as_uuid=True), ForeignKey("ap2_mandates.id", ondelete="SET NULL"), nullable=True
    )
    order_id: UUID | None = Column(
        PGUUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True
    )

    # Performance tracking
    processing_time_ms: int | None = Column(Integer, nullable=True)

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

    def __repr__(self) -> str:
        return f"<AP2AgentInteraction(id={self.id}, type={self.interaction_type}, status={self.status})>"


class AP2WebhookLog(Base):
    """
    AP2 webhook audit trail.

    Logs all incoming webhooks from Google AP2 for debugging and compliance.
    """

    __tablename__ = "ap2_webhook_logs"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Webhook details
    event_type: str = Column(String(100), nullable=False, index=True)
    event_id: str | None = Column(String(255), nullable=True, unique=True, index=True)

    # Request details
    headers: dict | None = Column(JSONB, nullable=True)
    payload: dict | None = Column(JSONB, nullable=True)
    signature: str | None = Column(Text, nullable=True)

    # Verification
    signature_verified: bool | None = Column(Boolean, nullable=True)
    verification_error: str | None = Column(Text, nullable=True)

    # Processing
    processed: bool = Column(Boolean, default=False, nullable=False)
    processed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    processing_error: str | None = Column(Text, nullable=True)

    # Related entities
    mandate_id: UUID | None = Column(
        PGUUID(as_uuid=True), ForeignKey("ap2_mandates.id", ondelete="SET NULL"), nullable=True
    )
    transaction_id: UUID | None = Column(
        PGUUID(as_uuid=True), ForeignKey("ap2_transactions.id", ondelete="SET NULL"), nullable=True
    )

    # Timestamps
    received_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    def __repr__(self) -> str:
        return f"<AP2WebhookLog(id={self.id}, event_type={self.event_type}, processed={self.processed})>"
