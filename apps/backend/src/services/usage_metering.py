"""Usage metering service for tracking subscription usage.

Tracks:
- API calls
- Orders created
- Quotes generated
- Products added
- AI translations requested
"""

import asyncio
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db_session
from src.db.demo_models import Order, Product, Organization
from src.db.models.subscription import Subscription
from src.integrations.stripe.client import StripeClient


class UsageMeteringService:
    """Service for tracking and reporting usage to Stripe."""

    def __init__(self, stripe_client: StripeClient):
        self.stripe = stripe_client

    async def get_current_usage(
        self, organization_id: UUID, db: AsyncSession
    ) -> dict[str, int]:
        """Get current usage metrics for an organization.

        Returns:
            Dictionary with usage counts for:
            - locations: Number of active locations
            - users: Number of active users
            - products: Number of products
            - orders: Number of orders this month
            - quotes: Number of quotes this month
            - ai_quotes: Number of AI-generated quotes this month
        """
        # Get start of current month
        now = datetime.utcnow()
        month_start = datetime(now.year, now.month, 1)

        # Count products
        products_result = await db.execute(
            select(func.count())
            .select_from(Product)
            .where(Product.is_active == True)  # noqa: E712
        )
        products_count = products_result.scalar() or 0

        # Count orders this month
        orders_result = await db.execute(
            select(func.count())
            .select_from(Order)
            .where(Order.order_date >= month_start)
        )
        orders_count = orders_result.scalar() or 0

        # TODO: Count quotes this month (when quotes table is added)
        quotes_count = 0
        ai_quotes_count = 0

        # TODO: Count locations (when locations table is added)
        locations_count = 1

        # TODO: Count users (when users are properly tracked by organization)
        users_count = 2

        return {
            "locations": locations_count,
            "users": users_count,
            "products": products_count,
            "orders": orders_count,
            "quotes": quotes_count,
            "ai_quotes": ai_quotes_count,
        }

    async def check_usage_limits(
        self, organization_id: UUID, db: AsyncSession
    ) -> dict[str, Any]:
        """Check if organization is approaching or exceeding usage limits.

        Returns:
            Dictionary with:
            - within_limits: bool
            - warnings: list of warning messages
            - exceeded: list of exceeded limits
        """
        # Get subscription
        result = await db.execute(
            select(Subscription).where(Subscription.organization_id == organization_id)
        )
        subscription = result.scalar_one_or_none()

        if not subscription:
            return {
                "within_limits": False,
                "warnings": ["No active subscription found"],
                "exceeded": [],
            }

        # Get current usage
        usage = await self.get_current_usage(organization_id, db)

        warnings = []
        exceeded = []

        # Check each limit
        limits = {
            "locations": (usage["locations"], subscription.max_locations),
            "users": (usage["users"], subscription.max_users),
            "products": (usage["products"], subscription.max_products),
            "ai_quotes": (usage["ai_quotes"], subscription.max_ai_quotes_per_month),
        }

        for key, (current, max_limit) in limits.items():
            if max_limit == -1:  # Unlimited
                continue

            percent = (current / max_limit) * 100 if max_limit > 0 else 0

            if current >= max_limit:
                exceeded.append(
                    f"{key.replace('_', ' ').title()}: {current}/{max_limit} (limit reached)"
                )
            elif percent >= 90:
                warnings.append(
                    f"{key.replace('_', ' ').title()}: {current}/{max_limit} ({percent:.0f}% used)"
                )
            elif percent >= 80:
                warnings.append(
                    f"{key.replace('_', ' ').title()}: {current}/{max_limit} ({percent:.0f}% used)"
                )

        return {
            "within_limits": len(exceeded) == 0,
            "warnings": warnings,
            "exceeded": exceeded,
        }

    async def report_usage_to_stripe(
        self, organization_id: UUID, db: AsyncSession
    ) -> dict[str, Any]:
        """Report usage metrics to Stripe for metered billing.

        This should be called daily via cron job.

        Returns:
            Dictionary with reported usage
        """
        # Get subscription
        result = await db.execute(
            select(Subscription).where(Subscription.organization_id == organization_id)
        )
        subscription = result.scalar_one_or_none()

        if not subscription or not subscription.stripe_subscription_id:
            return {"error": "No active Stripe subscription"}

        # Get usage
        usage = await self.get_current_usage(organization_id, db)

        # TODO: Report to Stripe using usage records
        # For now, just return the usage data
        # In production, you would:
        # 1. Get the subscription item ID for metered usage
        # 2. Report usage via stripe.SubscriptionItem.create_usage_record()

        return {
            "organization_id": str(organization_id),
            "usage": usage,
            "reported_at": datetime.utcnow().isoformat(),
        }

    async def record_event(
        self,
        organization_id: UUID,
        event_type: str,
        quantity: int = 1,
        metadata: dict | None = None,
    ) -> None:
        """Record a usage event for later aggregation.

        Args:
            organization_id: Organization UUID
            event_type: Type of event (e.g., "order_created", "quote_generated")
            quantity: Quantity to record (default 1)
            metadata: Additional metadata about the event

        Note:
            In production, you would store these events in a usage_events table
            and aggregate them daily to report to Stripe.
        """
        # TODO: Store event in database for later aggregation
        # For MVP, we'll just track in real-time
        pass


async def get_usage_service() -> UsageMeteringService:
    """Get usage metering service instance."""
    stripe_client = StripeClient()
    return UsageMeteringService(stripe_client)
