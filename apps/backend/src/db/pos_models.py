"""
SQLAlchemy models for POS (Point of Sale) system.

Includes:
- Location (physical stores and virtual channels)
- SalesStaff (salesperson → location mapping)
- POSTerminal (EFTPOS terminals)
- POSTransaction (transaction records)
- BankFeed (bank feed data)
- BankAccount (bank account config)
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    ARRAY,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .models import Base  # Use existing Base class


class Location(Base):
    """
    Location master data for physical stores and virtual sales channels.

    Locations:
    - brisbane: Brisbane Headquarters (physical)
    - sydney: Sydney Branch (physical)
    - melbourne: Melbourne Branch (physical)
    - online: Online Sales (virtual)
    - phone: Telephone Sales (virtual)
    """

    __tablename__ = "locations"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    location_type: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint("location_type IN ('physical', 'virtual')"),
        nullable=False,
        index=True,
    )

    # Address (for physical locations)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    country: Mapped[str] = mapped_column(String(100), default="Australia", nullable=False)

    # Configuration
    timezone: Mapped[str] = mapped_column(
        String(50), default="Australia/Brisbane", nullable=False
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False, index=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    sales_staff: Mapped[list["SalesStaff"]] = relationship(
        "SalesStaff", back_populates="primary_location", foreign_keys="SalesStaff.primary_location_code"
    )
    pos_terminals: Mapped[list["POSTerminal"]] = relationship(
        "POSTerminal", back_populates="location"
    )
    bank_accounts: Mapped[list["BankAccount"]] = relationship(
        "BankAccount", back_populates="location"
    )
    pos_transactions_location: Mapped[list["POSTransaction"]] = relationship(
        "POSTransaction",
        back_populates="location",
        foreign_keys="POSTransaction.location_code",
    )
    pos_transactions_resolved: Mapped[list["POSTransaction"]] = relationship(
        "POSTransaction",
        back_populates="resolved_location",
        foreign_keys="POSTransaction.resolved_location_code",
    )


class SalesStaff(Base):
    """
    Sales staff with location routing configuration.

    Used for:
    - Tracking who processed each sale
    - Location routing (QLD-JOHN → Brisbane)
    - Multi-location staff management
    """

    __tablename__ = "sales_staff"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    staff_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Location mapping
    primary_location_code: Mapped[str] = mapped_column(
        String(50), ForeignKey("locations.code", ondelete="RESTRICT"), nullable=False, index=True
    )
    can_sell_at_locations: Mapped[list[str]] = mapped_column(
        ARRAY(String(50)), default=[], nullable=False
    )

    # Status
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False, index=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    primary_location: Mapped["Location"] = relationship(
        "Location", back_populates="sales_staff", foreign_keys=[primary_location_code]
    )
    pos_transactions: Mapped[list["POSTransaction"]] = relationship(
        "POSTransaction", back_populates="sales_staff"
    )


class POSTerminal(Base):
    """
    POS terminals (EFTPOS, AMEX, virtual) at each location.

    Terminal types:
    - eftpos: Physical EFTPOS terminal
    - amex: AMEX payment gateway
    - virtual: Online/phone sales (no physical terminal)
    """

    __tablename__ = "pos_terminals"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    terminal_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    location_code: Mapped[str] = mapped_column(
        String(50), ForeignKey("locations.code", ondelete="RESTRICT"), nullable=False, index=True
    )
    terminal_type: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint("terminal_type IN ('eftpos', 'amex', 'virtual')"),
        nullable=False,
        index=True,
    )

    # Configuration
    merchant_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    terminal_config: Mapped[dict] = mapped_column(JSONB, default={}, nullable=False)

    # Status
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False, index=True)
    last_ping_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    location: Mapped["Location"] = relationship("Location", back_populates="pos_terminals")
    pos_transactions: Mapped[list["POSTransaction"]] = relationship(
        "POSTransaction", back_populates="terminal"
    )


class BankAccount(Base):
    """
    Bank accounts for each location with feed integration config.

    Bank feed providers:
    - xero: Xero bank feeds
    - yodlee: Yodlee aggregation
    - basiq: Basiq open banking
    - manual: Manual CSV upload
    """

    __tablename__ = "bank_accounts"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    account_name: Mapped[str] = mapped_column(String(200), nullable=False)
    account_number: Mapped[str] = mapped_column(String(100), nullable=False)
    bsb: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    bank_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    location_code: Mapped[Optional[str]] = mapped_column(
        String(50), ForeignKey("locations.code", ondelete="SET NULL"), nullable=True, index=True
    )
    account_type: Mapped[Optional[str]] = mapped_column(
        String(50),
        CheckConstraint("account_type IN ('checking', 'savings', 'merchant')"),
        nullable=True,
    )
    currency: Mapped[str] = mapped_column(String(3), default="AUD", nullable=False)

    # Bank Feed Integration
    feed_provider: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    feed_account_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    last_feed_sync_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    feed_sync_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Status
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False, index=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    location: Mapped[Optional["Location"]] = relationship(
        "Location", back_populates="bank_accounts"
    )
    bank_feeds: Mapped[list["BankFeed"]] = relationship(
        "BankFeed", back_populates="bank_account", cascade="all, delete-orphan"
    )


class POSTransaction(Base):
    """
    POS transaction records with payment and reconciliation tracking.

    Handles:
    - Walk-in sales (no order)
    - Order-based sales (linked to order)
    - Payment processing (EFTPOS, AMEX, bank transfer, cash)
    - Location routing (QLD branch routing logic)
    - Reconciliation with bank feeds and Xero
    """

    __tablename__ = "pos_transactions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    transaction_number: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )

    # Links
    order_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    terminal_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("pos_terminals.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    sales_staff_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("sales_staff.id", ondelete="RESTRICT"), nullable=True, index=True
    )

    # Location routing
    location_code: Mapped[str] = mapped_column(
        String(50), ForeignKey("locations.code", ondelete="RESTRICT"), nullable=False, index=True
    )
    resolved_location_code: Mapped[Optional[str]] = mapped_column(
        String(50), ForeignKey("locations.code", ondelete="RESTRICT"), nullable=True, index=True
    )

    # Transaction Details
    transaction_type: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint("transaction_type IN ('sale', 'refund', 'void')"),
        nullable=False,
    )
    payment_method: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint("payment_method IN ('eftpos', 'amex', 'bank_transfer', 'cash')"),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="AUD", nullable=False)

    # Payment Processing
    payment_status: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint(
            "payment_status IN ('pending', 'authorized', 'captured', 'failed', 'refunded')"
        ),
        nullable=False,
        index=True,
    )
    payment_gateway_ref: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    payment_gateway_response: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Reconciliation
    bank_statement_ref: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    xero_invoice_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    cin7_transaction_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    reconciliation_status: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint(
            "reconciliation_status IN ('pending', 'matched', 'discrepancy', 'resolved')"
        ),
        default="pending",
        nullable=False,
        index=True,
    )
    reconciled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    reconciled_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    # order: Mapped[Optional["Order"]] = relationship("Order", back_populates="pos_transactions")
    terminal: Mapped[Optional["POSTerminal"]] = relationship(
        "POSTerminal", back_populates="pos_transactions"
    )
    sales_staff: Mapped[Optional["SalesStaff"]] = relationship(
        "SalesStaff", back_populates="pos_transactions"
    )
    location: Mapped["Location"] = relationship(
        "Location",
        back_populates="pos_transactions_location",
        foreign_keys=[location_code],
    )
    resolved_location: Mapped[Optional["Location"]] = relationship(
        "Location",
        back_populates="pos_transactions_resolved",
        foreign_keys=[resolved_location_code],
    )
    bank_feeds: Mapped[list["BankFeed"]] = relationship(
        "BankFeed", back_populates="matched_pos_transaction"
    )


class BankFeed(Base):
    """
    Bank feed transactions for automatic reconciliation.

    Auto-matches POS transactions with bank feed data based on:
    - Amount
    - Date
    - Reference number
    """

    __tablename__ = "bank_feeds"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    bank_account_id: Mapped[UUID] = mapped_column(
        ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Transaction data
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reference: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    debit: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)
    credit: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)
    balance: Mapped[Optional[Decimal]] = mapped_column(Numeric(15, 2), nullable=True)

    # Matching
    matched_pos_transaction_id: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("pos_transactions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    match_confidence: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2), nullable=True)
    match_status: Mapped[str] = mapped_column(
        String(50),
        CheckConstraint(
            "match_status IN ('pending', 'auto_matched', 'manual_matched', 'no_match')"
        ),
        default="pending",
        nullable=False,
        index=True,
    )
    matched_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    matched_by: Mapped[Optional[UUID]] = mapped_column(nullable=True)

    # Metadata
    raw_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    bank_account: Mapped["BankAccount"] = relationship("BankAccount", back_populates="bank_feeds")
    matched_pos_transaction: Mapped[Optional["POSTransaction"]] = relationship(
        "POSTransaction", back_populates="bank_feeds"
    )
