"""Invoicing and payment models for UNI-173."""
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DECIMAL,
    ForeignKey,
    Integer,
    String,
    Text,
    Boolean,
    Date,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..models_base import Base

if TYPE_CHECKING:
    from src.db.demo_models import Customer, Order, Product, User


class TaxRate(Base):
    """Tax rate configuration."""

    __tablename__ = "tax_rates"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    rate: Mapped[Decimal] = mapped_column(DECIMAL(5, 2), nullable=False)
    country: Mapped[str | None] = mapped_column(String(2), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(UTC), nullable=False)


class Invoice(Base):
    """Invoice for customer orders."""

    __tablename__ = "invoices"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    invoice_number: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )
    order_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("orders.id"), nullable=True, index=True
    )
    customer_id: Mapped[UUID] = mapped_column(
        ForeignKey("customers.id"), nullable=False, index=True
    )

    # Invoice details
    issue_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="draft", nullable=False, index=True
    )

    # Financial
    subtotal: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    tax_rate: Mapped[Decimal] = mapped_column(DECIMAL(5, 2), default=Decimal("10.00"), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    total: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), default=Decimal("0.00"), nullable=False)
    amount_due: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)

    # Additional info
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_terms: Mapped[str] = mapped_column(Text, default="Net 30", nullable=False)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(UTC), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC), nullable=False
    )
    created_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    # Relationships
    items: Mapped[list["InvoiceItem"]] = relationship(
        "InvoiceItem", back_populates="invoice", cascade="all, delete-orphan"
    )
    payments: Mapped[list["InvoicePayment"]] = relationship(
        "InvoicePayment", back_populates="invoice", cascade="all, delete-orphan"
    )
    customer: Mapped["Customer"] = relationship("Customer", foreign_keys=[customer_id])
    order: Mapped["Order | None"] = relationship("Order", foreign_keys=[order_id])
    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        CheckConstraint("subtotal >= 0", name="invoices_subtotal_positive"),
        CheckConstraint("tax_amount >= 0", name="invoices_tax_amount_positive"),
        CheckConstraint("total = subtotal + tax_amount", name="invoices_total_calculation"),
        CheckConstraint("amount_paid >= 0", name="invoices_amount_paid_positive"),
        CheckConstraint("amount_paid <= total", name="invoices_amount_paid_not_exceeds_total"),
        CheckConstraint("amount_due = total - amount_paid", name="invoices_amount_due_calculation"),
    )


class InvoiceItem(Base):
    """Line item in an invoice."""

    __tablename__ = "invoice_items"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    invoice_id: Mapped[UUID] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Item details
    product_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("products.id"), nullable=True, index=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)

    # Tax
    tax_rate: Mapped[Decimal] = mapped_column(DECIMAL(5, 2), default=Decimal("10.00"), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)

    # Totals
    subtotal: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    total: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(UTC), nullable=False)

    # Relationships
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="items")
    product: Mapped["Product | None"] = relationship("Product", foreign_keys=[product_id])

    __table_args__ = (
        CheckConstraint("quantity > 0", name="invoice_items_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="invoice_items_unit_price_positive"),
        CheckConstraint(
            "subtotal = quantity * unit_price",
            name="invoice_items_subtotal_calculation"
        ),
        CheckConstraint(
            "total = subtotal + tax_amount",
            name="invoice_items_total_calculation"
        ),
    )


class InvoicePayment(Base):
    """Payment record for an invoice."""

    __tablename__ = "invoice_payments"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    invoice_id: Mapped[UUID] = mapped_column(
        ForeignKey("invoices.id"), nullable=False, index=True
    )

    # Payment details
    payment_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(DECIMAL(10, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    # Payment reference
    reference_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Metadata
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(UTC), nullable=False)
    created_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    # Relationships
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="payments")
    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by])

    __table_args__ = (
        CheckConstraint("amount > 0", name="invoice_payments_amount_positive"),
    )
