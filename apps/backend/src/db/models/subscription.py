"""Subscription and billing models for multi-tenant SaaS."""

import enum
from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.models_base import Base


class SubscriptionTier(str, enum.Enum):
    """Subscription plan tiers."""

    STARTER = "starter"  # $79/month, $790/year
    PROFESSIONAL = "professional"  # $299/month, $2,990/year
    ENTERPRISE = "enterprise"  # $999/month, $9,990/year
    CUSTOM = "custom"  # $2,999+/month


class SubscriptionStatus(str, enum.Enum):
    """Subscription lifecycle status."""

    TRIAL = "trial"  # Free trial period
    ACTIVE = "active"  # Paid and active
    PAST_DUE = "past_due"  # Payment failed, grace period
    CANCELED = "canceled"  # User canceled, end of billing period
    EXPIRED = "expired"  # Trial/subscription ended


class BillingInterval(str, enum.Enum):
    """Billing frequency."""

    MONTHLY = "monthly"
    ANNUAL = "annual"


class Subscription(Base):
    """Organization subscription details.

    Stores Stripe subscription information and enforces usage limits.
    """

    __tablename__ = "subscriptions"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True), primary_key=True, default=uuid4
    )

    # Foreign keys
    organization_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # One subscription per organization
    )

    # Stripe fields
    stripe_subscription_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True
    )
    stripe_customer_id: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True
    )
    stripe_payment_method_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Subscription details
    tier: Mapped[SubscriptionTier] = mapped_column(
        Enum(SubscriptionTier, name="subscription_tier"),
        nullable=False,
        default=SubscriptionTier.STARTER,
    )
    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus, name="subscription_status"),
        nullable=False,
        default=SubscriptionStatus.TRIAL,
    )
    billing_interval: Mapped[BillingInterval] = mapped_column(
        Enum(BillingInterval, name="billing_interval"),
        nullable=False,
        default=BillingInterval.MONTHLY,
    )

    # Pricing (in cents to avoid floating point issues)
    price_cents: Mapped[int] = mapped_column(nullable=False, default=0)  # Monthly price

    # Billing dates
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Usage limits (enforced by application)
    max_locations: Mapped[int] = mapped_column(nullable=False, default=1)
    max_users: Mapped[int] = mapped_column(nullable=False, default=2)
    max_products: Mapped[int] = mapped_column(nullable=False, default=500)
    max_ai_quotes_per_month: Mapped[int] = mapped_column(nullable=False, default=0)

    # Feature flags
    has_multi_location: Mapped[bool] = mapped_column(nullable=False, default=False)
    has_ai_features: Mapped[bool] = mapped_column(nullable=False, default=False)
    has_api_access: Mapped[bool] = mapped_column(nullable=False, default=False)
    has_white_label: Mapped[bool] = mapped_column(nullable=False, default=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # Relationships
    # organization = relationship("Organization", back_populates="subscription")

    def get_price_display(self) -> str:
        """Return formatted price string."""
        dollars = self.price_cents / 100
        return f"${dollars:.2f}"

    def is_trial_active(self) -> bool:
        """Check if trial is still active."""
        if self.status != SubscriptionStatus.TRIAL or not self.trial_ends_at:
            return False
        return datetime.utcnow() < self.trial_ends_at

    def is_feature_available(self, feature: str) -> bool:
        """Check if a feature is available on current plan."""
        feature_map = {
            "multi_location": self.has_multi_location,
            "ai_features": self.has_ai_features,
            "api_access": self.has_api_access,
            "white_label": self.has_white_label,
        }
        return feature_map.get(feature, False)


# Subscription tier configuration
TIER_CONFIG = {
    SubscriptionTier.STARTER: {
        "name": "Starter",
        "monthly_price_cents": 7900,  # $79
        "annual_price_cents": 79000,  # $790 (save 20%)
        "max_locations": 1,
        "max_users": 2,
        "max_products": 500,
        "max_ai_quotes_per_month": 0,
        "has_multi_location": False,
        "has_ai_features": False,
        "has_api_access": False,
        "has_white_label": False,
    },
    SubscriptionTier.PROFESSIONAL: {
        "name": "Professional",
        "monthly_price_cents": 29900,  # $299
        "annual_price_cents": 299000,  # $2,990 (save 20%)
        "max_locations": 3,
        "max_users": 5,
        "max_products": -1,  # Unlimited
        "max_ai_quotes_per_month": 100,
        "has_multi_location": True,
        "has_ai_features": True,
        "has_api_access": False,
        "has_white_label": False,
    },
    SubscriptionTier.ENTERPRISE: {
        "name": "Enterprise",
        "monthly_price_cents": 99900,  # $999
        "annual_price_cents": 999000,  # $9,990 (save 20%)
        "max_locations": 10,
        "max_users": -1,  # Unlimited
        "max_products": -1,  # Unlimited
        "max_ai_quotes_per_month": -1,  # Unlimited
        "has_multi_location": True,
        "has_ai_features": True,
        "has_api_access": True,
        "has_white_label": True,
    },
    SubscriptionTier.CUSTOM: {
        "name": "Custom",
        "monthly_price_cents": 299900,  # $2,999 (starting price)
        "annual_price_cents": 2999000,  # Custom pricing
        "max_locations": -1,  # Unlimited
        "max_users": -1,  # Unlimited
        "max_products": -1,  # Unlimited
        "max_ai_quotes_per_month": -1,  # Unlimited
        "has_multi_location": True,
        "has_ai_features": True,
        "has_api_access": True,
        "has_white_label": True,
    },
}


def get_tier_config(tier: SubscriptionTier, interval: BillingInterval) -> dict:
    """Get configuration for a subscription tier."""
    config = TIER_CONFIG[tier].copy()
    price_key = (
        "annual_price_cents" if interval == BillingInterval.ANNUAL else "monthly_price_cents"
    )
    config["price_cents"] = config[price_key]
    return config
