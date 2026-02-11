"""Webhook event tracking models.

Provides transaction-safe webhook processing with:
- Idempotency checks (prevent duplicate processing)
- Transaction boundaries (commit only on success)
- Dead letter queue (failed webhooks for retry)
- Exponential backoff retry mechanism
- Full audit trail for debugging

ISS-036: Fix webhook transaction boundaries to prevent data loss on handler crashes.
"""

import enum
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import (
    JSON,
    DateTime,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .models_base import Base


class WebhookStatus(str, enum.Enum):
    """Webhook processing status."""

    PENDING = "pending"  # Received, not yet processed
    PROCESSING = "processing"  # Currently being processed
    COMPLETED = "completed"  # Successfully processed
    FAILED = "failed"  # Processing failed, will retry
    DEAD_LETTER = "dead_letter"  # Max retries exceeded, needs manual intervention


class WebhookSource(str, enum.Enum):
    """Webhook source integrations."""

    SHOPIFY = "shopify"
    XERO = "xero"
    SENDGRID = "sendgrid"
    STRIPE = "stripe"
    FEDEX = "fedex"
    UPS = "ups"
    USPS = "usps"
    CONTACT_FORM = "contact_form"
    DEMO_REQUEST = "demo_request"
    OTHER = "other"


class WebhookEvent(Base):
    """Persistent webhook event log for reliable processing.

    This table ensures:
    1. No data loss on handler crashes (event is persisted before processing)
    2. Idempotency (unique event_id prevents duplicate processing)
    3. Retry capability (failed events can be retried with backoff)
    4. Audit trail (full history of all webhook events)
    """

    __tablename__ = "webhook_events"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Source identification
    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )  # shopify, xero, sendgrid, etc.

    event_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )  # orders/create, INVOICE.UPDATE, etc.

    # Idempotency key - unique per source
    # For Shopify: X-Shopify-Webhook-Id header
    # For Xero: firstEventSequence
    # For Stripe: event.id
    event_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # Webhook payload and headers
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
    )

    headers: Mapped[dict[str, str] | None] = mapped_column(
        JSON,
        nullable=True,
    )

    # Processing status
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=WebhookStatus.PENDING.value,
        index=True,
    )

    # Retry management
    retry_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    max_retries: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=3,
    )

    next_retry_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # Error tracking
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    error_details: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
    )

    # Processing result
    processing_result: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
    )

    # Timestamps
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        index=True,
    )

    started_processing_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # Composite unique index for idempotency (source + event_id)
    __table_args__ = (
        Index(
            "ix_webhook_events_source_event_id",
            "source",
            "event_id",
            unique=True,
        ),
        Index(
            "ix_webhook_events_status_next_retry",
            "status",
            "next_retry_at",
        ),
    )

    def __repr__(self) -> str:
        """String representation."""
        return (
            f"<WebhookEvent(id={self.id}, source={self.source}, "
            f"event_type={self.event_type}, status={self.status})>"
        )

    def mark_processing(self) -> None:
        """Mark webhook as currently being processed."""
        self.status = WebhookStatus.PROCESSING.value
        self.started_processing_at = datetime.now(UTC)

    def mark_completed(self, result: dict[str, Any] | None = None) -> None:
        """Mark webhook as successfully processed."""
        self.status = WebhookStatus.COMPLETED.value
        self.completed_at = datetime.now(UTC)
        self.processing_result = result
        self.error_message = None
        self.error_details = None

    def mark_failed(
        self,
        error: str,
        error_details: dict[str, Any] | None = None,
        *,
        retry: bool = True,
    ) -> None:
        """Mark webhook as failed with optional retry scheduling.

        Args:
            error: Error message
            error_details: Additional error context
            retry: Whether to schedule a retry (default: True)
        """
        self.error_message = error
        self.error_details = error_details
        self.retry_count += 1

        if retry and self.retry_count < self.max_retries:
            # Exponential backoff: 60s, 120s, 240s, ... up to 1 hour max
            backoff_seconds = min(60 * (2 ** self.retry_count), 3600)
            self.status = WebhookStatus.FAILED.value
            self.next_retry_at = datetime.now(UTC) + timedelta(seconds=backoff_seconds)
        else:
            # Max retries exceeded, move to dead letter queue
            self.status = WebhookStatus.DEAD_LETTER.value
            self.next_retry_at = None

    def reset_for_retry(self) -> None:
        """Reset webhook for manual retry (from dead letter queue)."""
        self.status = WebhookStatus.PENDING.value
        self.retry_count = 0
        self.next_retry_at = None
        self.error_message = None
        self.error_details = None
        self.started_processing_at = None
        self.completed_at = None
        self.processing_result = None

    @property
    def is_retriable(self) -> bool:
        """Check if webhook can be retried."""
        return (
            self.status == WebhookStatus.FAILED.value
            and self.retry_count < self.max_retries
            and self.next_retry_at is not None
            and self.next_retry_at <= datetime.now(UTC)
        )

    @property
    def processing_duration_ms(self) -> int | None:
        """Calculate processing duration in milliseconds."""
        if self.started_processing_at and self.completed_at:
            delta = self.completed_at - self.started_processing_at
            return int(delta.total_seconds() * 1000)
        return None


class WebhookMetrics(Base):
    """Aggregated webhook metrics for monitoring dashboards.

    Updated periodically by a background job to avoid expensive queries.
    """

    __tablename__ = "webhook_metrics"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Metric period (hourly, daily, weekly)
    period_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )  # hourly, daily, weekly

    period_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    period_end: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    # Metrics by source
    source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    # Counts
    total_received: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    total_completed: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    total_failed: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    total_dead_letter: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )

    # Performance
    avg_processing_time_ms: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    max_processing_time_ms: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    # Reliability rate (completed / (completed + failed + dead_letter))
    reliability_rate: Mapped[float | None] = mapped_column(
        nullable=True,
    )

    # Timestamps
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    __table_args__ = (
        Index(
            "ix_webhook_metrics_source_period",
            "source",
            "period_type",
            "period_start",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        """String representation."""
        return (
            f"<WebhookMetrics(source={self.source}, "
            f"period_type={self.period_type}, reliability={self.reliability_rate})>"
        )
