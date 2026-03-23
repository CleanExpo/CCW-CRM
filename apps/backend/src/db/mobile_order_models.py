"""
Mobile Photo-to-Order Models

Supports the tradesperson mobile ordering workflow:
1. Tradesperson takes photo on-site
2. AI recognises product(s) from photo
3. Draft order created automatically
4. Shareable link sent to customer for approval
5. Customer approves and pays
6. Order dispatched

These models are separate from demo_models.py (locked).
"""

import enum
import secrets
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from src.db.models_base import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class GuestOrderStatus(str, enum.Enum):
    """Status of a guest order awaiting customer approval."""

    PENDING = "pending"          # Awaiting customer review
    VIEWED = "viewed"            # Customer opened the link
    APPROVED = "approved"        # Customer approved
    PAYMENT_PENDING = "payment_pending"  # Stripe payment initiated
    PAID = "paid"                # Payment confirmed
    DISPATCHED = "dispatched"    # Order dispatched
    DECLINED = "declined"        # Customer declined
    EXPIRED = "expired"          # Link expired (72 hours default)
    CANCELLED = "cancelled"      # Tradesperson cancelled


class RecognitionStatus(str, enum.Enum):
    """Status of AI product recognition."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    LOW_CONFIDENCE = "low_confidence"  # Results returned but confidence < threshold


class LinkStatus(str, enum.Enum):
    """Status of tradesperson-customer link."""

    ACTIVE = "active"
    SUSPENDED = "suspended"
    REVOKED = "revoked"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class TradespersonCustomerLink(Base):
    """
    Links a tradesperson (user) to a customer for pre-approved ordering.

    A tradesperson must have an active link to a customer before creating
    guest orders on their behalf. Customers can approve/revoke links.
    """

    __tablename__ = "tradesperson_customer_links"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # The tradesperson (internal user)
    tradesperson_id: UUID = Column(
        PGUUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    tradesperson_name: str = Column(String(255), nullable=False)
    tradesperson_email: str = Column(String(255), nullable=False)

    # The customer being ordered for (references customers table)
    customer_id: UUID = Column(
        PGUUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    customer_name: str = Column(String(255), nullable=False)
    customer_email: str = Column(String(255), nullable=False)

    # Link configuration
    status: LinkStatus = Column(
        Enum(LinkStatus, name="link_status"),
        nullable=False,
        default=LinkStatus.ACTIVE,
        index=True,
    )
    default_delivery_address: dict | None = Column(JSONB, nullable=True)
    credit_limit: float | None = Column(Float, nullable=True)  # Max order value
    auto_approve_under: float | None = Column(Float, nullable=True)  # Auto-approve small orders

    # Metadata
    notes: str | None = Column(Text, nullable=True)
    created_at: datetime = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    updated_at: datetime = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    approved_by_customer_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    guest_orders = relationship("GuestOrderToken", back_populates="link", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<TradespersonCustomerLink tradesperson={self.tradesperson_email} customer={self.customer_email}>"


class ProductRecognitionImage(Base):
    """
    Stores uploaded product photos and AI recognition results.

    Tradesperson uploads a photo from the field. AI (GPT-4o Vision)
    analyses it and returns product matches with confidence scores.
    """

    __tablename__ = "product_recognition_images"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Upload details
    uploaded_by: UUID = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    original_filename: str | None = Column(String(500), nullable=True)
    storage_key: str = Column(String(1000), nullable=False)  # S3/Supabase storage path
    file_size_bytes: int | None = Column(Integer, nullable=True)
    mime_type: str = Column(String(100), nullable=False, default="image/jpeg")

    # Recognition state
    status: RecognitionStatus = Column(
        Enum(RecognitionStatus, name="recognition_status"),
        nullable=False,
        default=RecognitionStatus.PENDING,
        index=True,
    )

    # AI Results
    ai_model_used: str | None = Column(String(100), nullable=True)  # e.g. "gpt-4o"
    recognition_results: list[dict] | None = Column(JSONB, nullable=True)
    # Format: [{"product_id": "...", "product_name": "...", "confidence": 0.94, "sku": "...", "suggested_quantity": 1}]

    top_confidence: float | None = Column(Float, nullable=True)  # Highest confidence match
    processing_time_ms: int | None = Column(Integer, nullable=True)
    error_message: str | None = Column(Text, nullable=True)
    raw_ai_response: dict | None = Column(JSONB, nullable=True)  # Full AI response for debugging

    # Usage tracking
    used_in_order_id: UUID | None = Column(PGUUID(as_uuid=True), nullable=True)  # FK to orders.id
    context_notes: str | None = Column(Text, nullable=True)  # Tradesperson's description of what they see

    created_at: datetime = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    processed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    guest_orders = relationship("GuestOrderToken", back_populates="recognition_image")

    def __repr__(self) -> str:
        return f"<ProductRecognitionImage id={self.id} status={self.status}>"


class GuestOrderToken(Base):
    """
    Guest order link sent to customer for approval.

    When a tradesperson creates an order on behalf of a customer,
    a unique token is generated. The customer receives this link,
    reviews the items, and approves/declines.
    """

    __tablename__ = "guest_order_tokens"

    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # Unique shareable token (URL-safe, 32 chars)
    token: str = Column(
        String(64),
        nullable=False,
        unique=True,
        index=True,
        default=lambda: secrets.token_urlsafe(32),
    )

    # References
    link_id: UUID | None = Column(
        PGUUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    recognition_image_id: UUID | None = Column(
        PGUUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    order_id: UUID | None = Column(
        PGUUID(as_uuid=True),
        nullable=True,
        index=True,
    )  # FK to orders.id once created

    # Parties
    created_by_user_id: UUID = Column(PGUUID(as_uuid=True), nullable=False, index=True)
    customer_email: str = Column(String(255), nullable=False, index=True)
    customer_name: str = Column(String(255), nullable=False)

    # Order summary (denormalised for guest portal access without DB auth)
    order_summary: dict = Column(JSONB, nullable=False, default=dict)
    # Format: {"items": [...], "subtotal": ..., "tax": ..., "total": ..., "delivery_address": {...}}

    # Status
    status: GuestOrderStatus = Column(
        Enum(GuestOrderStatus, name="guest_order_status"),
        nullable=False,
        default=GuestOrderStatus.PENDING,
        index=True,
    )

    # Customer interaction
    customer_notes: str | None = Column(Text, nullable=True)
    declined_reason: str | None = Column(Text, nullable=True)

    # Payment
    stripe_payment_intent_id: str | None = Column(String(255), nullable=True)
    stripe_payment_link_url: str | None = Column(String(1000), nullable=True)
    amount_paid: float | None = Column(Float, nullable=True)

    # Expiry
    expires_at: datetime = Column(
        DateTime(timezone=True),
        nullable=False,
    )  # Populated at creation (now + 72 hours)

    # Audit trail
    created_at: datetime = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    updated_at: datetime = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))
    viewed_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    approved_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    paid_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Notifications sent
    email_sent_at: datetime | None = Column(DateTime(timezone=True), nullable=True)
    reminder_sent_at: datetime | None = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    link = relationship("TradespersonCustomerLink", back_populates="guest_orders")
    recognition_image = relationship("ProductRecognitionImage", back_populates="guest_orders")

    def is_expired(self) -> bool:
        """Check if this token has expired."""
        return datetime.now(UTC) > self.expires_at

    def is_actionable(self) -> bool:
        """Check if customer can still act on this order."""
        return self.status in (
            GuestOrderStatus.PENDING,
            GuestOrderStatus.VIEWED,
        ) and not self.is_expired()

    def __repr__(self) -> str:
        return f"<GuestOrderToken token={self.token[:8]}... status={self.status}>"
