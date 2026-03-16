"""Cin7 Financial/GL integration database models.

Models for Chart of Accounts sync, journal entries, journal lines,
and account mapping between ERP entities and Cin7 GL accounts.
"""

import enum
from datetime import UTC, date, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .models_base import Base

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class AccountType(str, enum.Enum):
    """GL account classification types."""

    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    REVENUE = "revenue"
    EXPENSE = "expense"
    COST_OF_GOODS = "cost_of_goods"


class JournalStatus(str, enum.Enum):
    """Status of a journal entry."""

    DRAFT = "draft"
    POSTED = "posted"
    VOID = "void"


class JournalSource(str, enum.Enum):
    """Source system or event that originated the journal entry."""

    MANUAL = "manual"
    ORDER = "order"
    INVOICE = "invoice"
    PAYMENT = "payment"
    ADJUSTMENT = "adjustment"


class LineType(str, enum.Enum):
    """Whether the line is a debit or credit."""

    DEBIT = "debit"
    CREDIT = "credit"


class ErpEntityType(str, enum.Enum):
    """ERP entity types used in account mapping rules."""

    ORDER = "order"
    INVOICE = "invoice"
    PAYMENT = "payment"
    REFUND = "refund"
    ADJUSTMENT = "adjustment"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class Cin7ChartOfAccount(Base):
    """A single account in the Cin7 Chart of Accounts.

    Synced from Cin7 and used to map ERP transactions to GL codes.
    """

    __tablename__ = "cin7_chart_of_accounts"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    cin7_account_id: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    account_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    account_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default=AccountType.EXPENSE.value
    )
    parent_account_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="AUD", nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    journal_lines: Mapped[list["Cin7JournalLine"]] = relationship(
        "Cin7JournalLine", back_populates="account", cascade="all, delete-orphan"
    )
    account_mappings: Mapped[list["Cin7AccountMapping"]] = relationship(
        "Cin7AccountMapping", back_populates="cin7_account"
    )

    def __repr__(self) -> str:
        return (
            f"<Cin7ChartOfAccount(code={self.account_code}, name={self.account_name})>"
        )


class Cin7JournalEntry(Base):
    """A journal entry in the GL, sourced from Cin7 or created manually.

    Double-entry bookkeeping: total_debit must equal total_credit when posted.
    """

    __tablename__ = "cin7_journal_entries"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    cin7_journal_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )
    journal_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default=JournalStatus.DRAFT.value, nullable=False, index=True
    )
    total_debit: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    total_credit: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    currency: Mapped[str] = mapped_column(String(10), default="AUD", nullable=False)
    source: Mapped[str] = mapped_column(
        String(20), default=JournalSource.MANUAL.value, nullable=False
    )
    cin7_synced: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    lines: Mapped[list["Cin7JournalLine"]] = relationship(
        "Cin7JournalLine", back_populates="journal_entry", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<Cin7JournalEntry(date={self.journal_date}, ref={self.reference}, "
            f"status={self.status})>"
        )


class Cin7JournalLine(Base):
    """A single debit or credit line within a journal entry."""

    __tablename__ = "cin7_journal_lines"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    journal_entry_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cin7_journal_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    account_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cin7_chart_of_accounts.id"),
        nullable=False,
        index=True,
    )
    line_type: Mapped[str] = mapped_column(String(10), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    tax_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )

    # Relationships
    journal_entry: Mapped["Cin7JournalEntry"] = relationship(
        "Cin7JournalEntry", back_populates="lines"
    )
    account: Mapped["Cin7ChartOfAccount"] = relationship(
        "Cin7ChartOfAccount", back_populates="journal_lines"
    )

    def __repr__(self) -> str:
        return (
            f"<Cin7JournalLine(type={self.line_type}, amount={self.amount})>"
        )


class Cin7AccountMapping(Base):
    """Maps ERP entity types/fields to Cin7 GL account codes.

    Defines which GL account to use for each type of ERP transaction
    (e.g., order revenue → account 4000, tax payable → account 2200).
    """

    __tablename__ = "cin7_account_mappings"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    erp_entity_type: Mapped[str] = mapped_column(
        String(30), nullable=False, index=True
    )
    erp_field: Mapped[str] = mapped_column(String(100), nullable=False)
    cin7_account_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("cin7_chart_of_accounts.id", ondelete="SET NULL"),
        nullable=True,
    )
    account_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relationships
    cin7_account: Mapped["Cin7ChartOfAccount | None"] = relationship(
        "Cin7ChartOfAccount", back_populates="account_mappings"
    )

    def __repr__(self) -> str:
        return (
            f"<Cin7AccountMapping(entity={self.erp_entity_type}, "
            f"field={self.erp_field}, code={self.account_code})>"
        )
