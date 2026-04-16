"""Customer credit profile extension model (UNI-1829).
Extends the locked Customer model with credit limit and credit hold fields
via a one-to-one companion table, avoiding modification of demo_models.py.
"""
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from .models_base import Base


class CustomerCreditProfile(Base):
    """One-to-one extension of Customer for credit management.
    - credit_limit: Maximum outstanding balance allowed (NULL = no limit).
    - credit_hold: When True, no new orders are accepted for this customer.
    """
    __tablename__ = "customer_credit_profiles"
    id: UUID = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    customer_id: UUID = Column(
        PGUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    credit_limit: Decimal | None = Column(Numeric(12, 2), nullable=True, default=None)
    credit_hold: bool = Column(Boolean, nullable=False, default=False)
    created_at: datetime = Column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: datetime = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
