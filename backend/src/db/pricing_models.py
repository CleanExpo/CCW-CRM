"""Customer trade pricing tier models.

Enables CCW to offer tiered trade discounts (Bronze/Silver/Gold/Platinum)
based on annual spend, applying automatic discounts to quotes and orders
for qualified trade customers.
"""
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .models_base import Base

# Standard CCW pricing tiers
DEFAULT_TIERS = [
    {"name": "Bronze", "discount_pct": Decimal("5.00"), "min_annual_spend": Decimal("5000.00")},
    {"name": "Silver", "discount_pct": Decimal("10.00"), "min_annual_spend": Decimal("20000.00")},
    {"name": "Gold", "discount_pct": Decimal("15.00"), "min_annual_spend": Decimal("50000.00")},
    {"name": "Platinum", "discount_pct": Decimal("20.00"), "min_annual_spend": Decimal("100000.00")},
]


class PricingTier(Base):
    """
    Trade pricing tier defining a discount level.

    Customers assigned to a tier receive the tier's discount_pct
    applied to standard list prices across all products.
    """

    __tablename__ = "pricing_tiers"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    # Discount percentage: 5.00 = 5% off list price
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    # Minimum annual spend (AUD) to qualify for this tier
    min_annual_spend: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    assignments: Mapped[list["CustomerPricingAssignment"]] = relationship(
        "CustomerPricingAssignment", back_populates="tier"
    )


class CustomerPricingAssignment(Base):
    """
    Assignment of a pricing tier to a specific customer.

    One assignment per customer (unique constraint on customer_id).
    Effective from effective_date — historical assignments are not tracked.
    """

    __tablename__ = "customer_pricing_assignments"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    customer_id: Mapped[UUID] = mapped_column(
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    tier_id: Mapped[UUID] = mapped_column(
        ForeignKey("pricing_tiers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    effective_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    tier: Mapped["PricingTier"] = relationship(
        "PricingTier", back_populates="assignments"
    )
