"""Cin7 Sales Order Fulfilment database models.

Models for the pick -> pack -> ship -> invoice -> payment workflow.
These track fulfilment lifecycle, invoices, and payments for Cin7-synced orders.
"""

import enum
from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from .models_base import Base


class FulfilmentStatus(str, enum.Enum):
    """Status values for a sales order fulfilment."""

    PENDING = "pending"
    PICKING = "picking"
    PACKING = "packing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class InvoiceStatus(str, enum.Enum):
    """Status values for an invoice."""

    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class PaymentStatus(str, enum.Enum):
    """Status values for a payment."""

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class Cin7Fulfilment(Base):
    """Sales order fulfilment record.

    Tracks the pick -> pack -> ship -> deliver lifecycle for a Cin7
    sales order.  Linked to the Cin7OrderMapping that owns the order.
    """

    __tablename__ = "cin7_fulfilments"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # FK to cin7_order_mappings.id (cascade delete)
    cin7_order_mapping_id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cin7_order_mappings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Cin7-side fulfilment identifier (populated after sync)
    cin7_fulfilment_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )

    # Workflow status
    status: Mapped[str] = mapped_column(
        String(20), default=FulfilmentStatus.PENDING.value, index=True
    )

    # Pick details
    pick_location: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Shipping details (populated when status reaches 'shipped')
    tracking_number: Mapped[str | None] = mapped_column(String(255), nullable=True)
    carrier: Mapped[str | None] = mapped_column(String(100), nullable=True)
    shipped_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Free-text notes (visible to warehouse staff)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    def __repr__(self) -> str:
        return (
            f"<Cin7Fulfilment(id={self.id}, mapping={self.cin7_order_mapping_id},"
            f" status={self.status})>"
        )


class Cin7Invoice(Base):
    """Invoice record linked to a Cin7 order mapping.

    Tracks invoice lifecycle from draft through to paid/overdue.
    Can be populated by syncing from Cin7 or created locally.
    """

    __tablename__ = "cin7_invoices"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # FK to cin7_order_mappings.id (cascade delete)
    cin7_order_mapping_id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cin7_order_mappings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Cin7-side invoice identifier (populated after sync)
    cin7_invoice_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )

    # Invoice details
    invoice_number: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Financials
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"))
    currency: Mapped[str] = mapped_column(String(3), default="AUD")

    # Status
    status: Mapped[str] = mapped_column(
        String(20), default=InvoiceStatus.DRAFT.value, index=True
    )

    # Payment timestamp (populated when status becomes 'paid')
    paid_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    def __repr__(self) -> str:
        return (
            f"<Cin7Invoice(id={self.id}, number={self.invoice_number},"
            f" status={self.status}, amount={self.amount})>"
        )


class Cin7Payment(Base):
    """Payment record linked to a Cin7Invoice.

    Captures individual payment transactions against an invoice.
    May be partial payments; full reconciliation happens when invoice
    status is set to 'paid'.
    """

    __tablename__ = "cin7_payments"

    id: Mapped[str] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # FK to cin7_invoices.id (cascade delete, nullable for orphaned payments)
    cin7_invoice_id: Mapped[str | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cin7_invoices.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Cin7-side payment identifier (populated after sync)
    cin7_payment_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )

    # Payment details
    payment_method: Mapped[str | None] = mapped_column(String(100), nullable=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"))
    currency: Mapped[str] = mapped_column(String(3), default="AUD")
    payment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    reference: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Status
    status: Mapped[str] = mapped_column(
        String(20), default=PaymentStatus.PENDING.value, index=True
    )

    # Timestamp (no updated_at — payments are immutable once created)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )

    def __repr__(self) -> str:
        return (
            f"<Cin7Payment(id={self.id}, invoice={self.cin7_invoice_id},"
            f" amount={self.amount}, status={self.status})>"
        )
