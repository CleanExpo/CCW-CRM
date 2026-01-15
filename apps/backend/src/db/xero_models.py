"""Xero integration database models."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .models import Base


class XeroConnection(Base):
    """Store Xero OAuth2 connection details and tokens.

    Each organization can have one active Xero connection. Tokens are encrypted
    before storage and refreshed automatically when they expire.
    """

    __tablename__ = "xero_connections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Organization relationship (optional for demo mode)
    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    # Xero tenant (organization) ID
    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    tenant_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # OAuth2 tokens (should be encrypted in production)
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Scopes granted
    scopes: Mapped[dict] = mapped_column(JSON, nullable=False, default=list)

    # Connection status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    # organization = relationship("Organization", back_populates="xero_connection")  # Disabled for demo mode  # noqa: E501

    def __repr__(self) -> str:
        return f"<XeroConnection(tenant_id={self.tenant_id}, active={self.is_active})>"

    @property
    def is_token_expired(self) -> bool:
        """Check if the access token has expired."""
        return datetime.now(UTC) >= self.expires_at


class Payment(Base):
    """Track payments received from Xero.

    When invoices are paid in Xero, payment details are synced back to the ERP
    to update order statuses and maintain accurate financial records.
    """

    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Order relationship
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Xero payment ID
    xero_payment_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)  # noqa: E501

    # Payment details
    amount: Mapped[float] = mapped_column(nullable=False)
    payment_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payment_method: Mapped[str] = mapped_column(
        String(50), nullable=False, default="other"
    )  # card|bank_transfer|cash|other
    reference: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    # Relationships
    # order = relationship("Order", back_populates="payments")  # Disabled for demo mode

    def __repr__(self) -> str:
        return f"<Payment(xero_id={self.xero_payment_id}, amount={self.amount})>"
