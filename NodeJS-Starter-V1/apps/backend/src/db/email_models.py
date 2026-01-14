"""Email integration database models."""

import uuid
from datetime import UTC, datetime
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .models import Base


class EmailConversation(Base):
    """Track email conversations with customers.

    Groups related emails into threads for better context and history tracking.
    """

    __tablename__ = "email_conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Thread identification
    thread_id: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True, unique=True
    )
    subject: Mapped[str] = mapped_column(String(500), nullable=False)

    # Customer information
    customer_email: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )
    customer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Customer relationship (optional)
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    # Conversation status
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="open",
        index=True,
    )  # open|responded|escalated|closed

    # Intent classification
    intent: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, index=True
    )  # order_inquiry|stock_check|quote_request|support|complaint|other

    confidence_score: Mapped[Optional[float]] = mapped_column(nullable=True)

    # Assignment (if escalated to human)
    assigned_to: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
    )

    # Related entities
    related_order_ids: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True
    )  # List of order IDs mentioned
    related_product_ids: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True
    )  # List of product IDs mentioned
    related_quote_ids: Mapped[Optional[dict]] = mapped_column(
        JSON, nullable=True
    )  # List of quote IDs mentioned

    # Message count
    message_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Timestamps
    first_message_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    last_message_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    def __repr__(self) -> str:
        return f"<EmailConversation(thread_id={self.thread_id}, subject={self.subject})>"


class EmailMessage(Base):
    """Individual email messages within conversations.

    Stores both inbound (customer → us) and outbound (us → customer) messages.
    """

    __tablename__ = "email_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Conversation relationship
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    # Message identification
    message_id: Mapped[str] = mapped_column(
        String(500), nullable=False, unique=True, index=True
    )  # Email Message-ID header

    # Direction
    direction: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )  # inbound|outbound

    # Sender/Recipient
    from_email: Mapped[str] = mapped_column(String(255), nullable=False)
    from_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    to_email: Mapped[str] = mapped_column(String(255), nullable=False)
    to_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # CC/BCC (JSON arrays)
    cc_emails: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    bcc_emails: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Content
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    body_html: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Attachments (JSON array of {filename, content_type, size, url})
    attachments: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # AI processing
    was_ai_generated: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    ai_confidence: Mapped[Optional[float]] = mapped_column(nullable=True)
    ai_intent: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # SendGrid metadata
    sendgrid_message_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, index=True
    )
    sendgrid_status: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )  # processed|delivered|opened|clicked|bounced|dropped

    # Timestamps
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    delivered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    opened_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    def __repr__(self) -> str:
        return f"<EmailMessage(message_id={self.message_id}, direction={self.direction})>"


class EmailTemplate(Base):
    """Email templates for common scenarios.

    Supports both plain text and HTML templates with variable substitution.
    """

    __tablename__ = "email_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Template identification
    template_key: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Template content
    subject_template: Mapped[str] = mapped_column(String(500), nullable=False)
    body_text_template: Mapped[str] = mapped_column(Text, nullable=False)
    body_html_template: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # SendGrid dynamic template ID (optional)
    sendgrid_template_id: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True
    )

    # Template category
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # order|quote|invoice|support|marketing

    # Variables expected in this template (JSON array)
    required_variables: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

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

    def __repr__(self) -> str:
        return f"<EmailTemplate(key={self.template_key}, name={self.name})>"


class EmailWebhookLog(Base):
    """Log all incoming webhook events from SendGrid.

    Useful for debugging and tracking email delivery status.
    """

    __tablename__ = "email_webhook_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Webhook type
    event_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # inbound|processed|delivered|opened|clicked|bounced|dropped|etc

    # Message identification
    sendgrid_message_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, index=True
    )
    email_message_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    # Full webhook payload
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)

    # Processing status
    processed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    def __repr__(self) -> str:
        return f"<EmailWebhookLog(event_type={self.event_type}, processed={self.processed})>"
