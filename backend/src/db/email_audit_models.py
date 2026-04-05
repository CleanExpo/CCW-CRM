"""Email audit trail models for GDPR compliance and email tracking.

This module provides comprehensive email logging for:
- GDPR compliance (data export, consent tracking)
- Delivery tracking (sent, delivered, bounced, failed)
- Customer support (email history lookup)
- Audit trail (every email sent by the system)

ISS-037: Email audit trail implementation
"""

import enum
import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from .models_base import Base


class EmailPurpose(str, enum.Enum):
    """Email purpose classification for GDPR consent tracking."""

    TRANSACTIONAL = "transactional"  # Orders, quotes, receipts - no consent needed
    NOTIFICATION = "notification"  # Alerts, reminders - implied consent
    MARKETING = "marketing"  # Promotional - explicit consent required
    SUPPORT = "support"  # Customer service - no consent needed
    SYSTEM = "system"  # Password reset, security alerts - no consent needed


class EmailStatus(str, enum.Enum):
    """Email delivery status."""

    QUEUED = "queued"  # Queued for sending
    SENT = "sent"  # Sent to SendGrid
    DELIVERED = "delivered"  # Delivered to recipient
    OPENED = "opened"  # Opened by recipient
    CLICKED = "clicked"  # Link clicked
    BOUNCED = "bounced"  # Hard bounce
    SOFT_BOUNCED = "soft_bounced"  # Soft bounce (temporary)
    DROPPED = "dropped"  # Dropped by SendGrid
    DEFERRED = "deferred"  # Deferred delivery
    SPAM_REPORT = "spam_report"  # Marked as spam
    UNSUBSCRIBED = "unsubscribed"  # Recipient unsubscribed
    FAILED = "failed"  # Failed to send


class EmailLog(Base):
    """Comprehensive email audit log for GDPR compliance.

    Every email sent by the system is logged here with:
    - Full content archival for GDPR data export
    - Delivery tracking via SendGrid webhooks
    - Consent tracking for marketing emails
    - Metadata for customer support queries
    """

    __tablename__ = "email_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ============================================================
    # Recipient Information
    # ============================================================
    recipient_email: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )
    recipient_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ============================================================
    # Sender Information
    # ============================================================
    from_email: Mapped[str] = mapped_column(String(255), nullable=False)
    from_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reply_to: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # ============================================================
    # Email Content (for GDPR export)
    # ============================================================
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    html_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    text_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    template_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )  # SendGrid template ID or internal template name

    # ============================================================
    # Delivery Tracking
    # ============================================================
    sendgrid_message_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True, index=True
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=EmailStatus.QUEUED.value,
        index=True,
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # ============================================================
    # Engagement Tracking
    # ============================================================
    sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    opened_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )  # First open
    open_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    clicked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )  # First click
    click_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    bounced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    unsubscribed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    spam_reported_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ============================================================
    # GDPR Compliance
    # ============================================================
    purpose: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default=EmailPurpose.TRANSACTIONAL.value,
        index=True,
    )
    consent_given: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )  # For marketing emails
    consent_timestamp: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    consent_source: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # signup_form, portal, etc.

    # Data retention flag - emails older than retention period can be purged
    # but audit record retained with content_purged=True
    content_purged: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    purged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # ============================================================
    # Relationships
    # ============================================================
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )  # Internal user who sent it (if applicable)

    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )  # Customer recipient (if linked)

    organization_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Related entity tracking (what triggered this email)
    related_entity_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True, index=True
    )  # order, quote, customer, etc.
    related_entity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )

    # ============================================================
    # Metadata
    # ============================================================
    ip_address: Mapped[str | None] = mapped_column(
        String(45), nullable=True
    )  # IPv4 or IPv6
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    extra_metadata: Mapped[dict | None] = mapped_column(
        "metadata", JSON, nullable=True
    )  # Additional custom data (column name: metadata, attribute: extra_metadata)

    # ============================================================
    # Timestamps
    # ============================================================
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # ============================================================
    # Indexes for common queries
    # ============================================================
    __table_args__ = (
        # GDPR data export query: all emails for a customer
        Index("ix_email_logs_customer_date", "customer_id", "created_at"),
        # Delivery status monitoring
        Index("ix_email_logs_status_date", "status", "created_at"),
        # Related entity lookup (e.g., all emails for an order)
        Index(
            "ix_email_logs_entity",
            "related_entity_type",
            "related_entity_id",
        ),
        # Purpose-based queries (marketing consent)
        Index("ix_email_logs_purpose_consent", "purpose", "consent_given"),
        # Recipient lookup (customer support)
        Index("ix_email_logs_recipient_date", "recipient_email", "created_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<EmailLog(id={self.id}, "
            f"to={self.recipient_email}, "
            f"subject={self.subject[:30]}..., "
            f"status={self.status})>"
        )

    def to_gdpr_export(self) -> dict:
        """Export email data for GDPR data portability.

        Returns minimal, human-readable format suitable for data export requests.
        """
        return {
            "email_id": str(self.id),
            "sent_date": self.sent_at.isoformat() if self.sent_at else None,
            "recipient": self.recipient_email,
            "subject": self.subject if not self.content_purged else "[Content Purged]",
            "purpose": self.purpose,
            "status": self.status,
            "opened": (self.open_count or 0) > 0,
            "consent_given": self.consent_given,
            "consent_date": (
                self.consent_timestamp.isoformat() if self.consent_timestamp else None
            ),
        }


class EmailConsent(Base):
    """Track email consent per recipient for GDPR compliance.

    Separate from EmailLog to provide a single source of truth for
    current consent status per recipient.
    """

    __tablename__ = "email_consents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Recipient identification
    email: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True
    )

    # Linked customer (if exists)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Consent status per email type
    marketing_consent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    marketing_consent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    marketing_consent_source: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )  # signup, portal, etc.

    notification_consent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )  # Implied for customers
    notification_consent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Unsubscribe tracking
    unsubscribed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    unsubscribed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    unsubscribe_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Bounce tracking (hard bounces should stop sending)
    hard_bounced: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    hard_bounced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    bounce_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Spam report tracking (spam reports should stop sending)
    spam_reported: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    spam_reported_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    def can_send_marketing(self) -> bool:
        """Check if marketing emails can be sent to this address."""
        return (
            self.marketing_consent
            and not self.unsubscribed
            and not self.hard_bounced
            and not self.spam_reported
        )

    def can_send_transactional(self) -> bool:
        """Check if transactional emails can be sent (only blocked by hard bounce)."""
        return not self.hard_bounced

    def __repr__(self) -> str:
        return (
            f"<EmailConsent(email={self.email}, "
            f"marketing={self.marketing_consent}, "
            f"unsubscribed={self.unsubscribed})>"
        )
