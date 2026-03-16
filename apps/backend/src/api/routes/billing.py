"""Billing and subscription management API endpoints.

Provides Stripe-based subscription management:
- View current subscription and plan
- Subscribe to a plan (create subscription)
- Update subscription (change plan/interval)
- Cancel subscription
- Manage payment methods
- View invoices
- Handle Stripe webhooks
"""

import os
from datetime import datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.middleware.rbac import require_permission
from src.api.middleware.tenant_isolation import CurrentOrganization
from src.config.database import get_async_db
from src.db.demo_models import Organization
from src.db.models.subscription import (
    BillingInterval,
    Subscription,
    SubscriptionStatus,
    SubscriptionTier,
    get_tier_config,
)
from src.integrations.stripe.client import StripeClient

router = APIRouter(prefix="/api/billing", tags=["Billing"])


# Pydantic models
class SubscriptionResponse(BaseModel):
    """Schema for subscription response."""

    id: str
    organization_id: str
    tier: SubscriptionTier
    status: SubscriptionStatus
    billing_interval: BillingInterval
    price_cents: int
    price_display: str
    max_locations: int
    max_users: int
    max_products: int
    max_ai_quotes_per_month: int
    has_multi_location: bool
    has_ai_features: bool
    has_api_access: bool
    has_white_label: bool
    trial_ends_at: datetime | None
    current_period_start: datetime | None
    current_period_end: datetime | None
    canceled_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm(cls, subscription: Subscription) -> "SubscriptionResponse":
        """Convert SQLAlchemy model to Pydantic response."""
        return cls(
            id=str(subscription.id),
            organization_id=str(subscription.organization_id),
            tier=subscription.tier,
            status=subscription.status,
            billing_interval=subscription.billing_interval,
            price_cents=subscription.price_cents,
            price_display=subscription.get_price_display(),
            max_locations=subscription.max_locations,
            max_users=subscription.max_users,
            max_products=subscription.max_products,
            max_ai_quotes_per_month=subscription.max_ai_quotes_per_month,
            has_multi_location=subscription.has_multi_location,
            has_ai_features=subscription.has_ai_features,
            has_api_access=subscription.has_api_access,
            has_white_label=subscription.has_white_label,
            trial_ends_at=subscription.trial_ends_at,
            current_period_start=subscription.current_period_start,
            current_period_end=subscription.current_period_end,
            canceled_at=subscription.canceled_at,
            created_at=subscription.created_at,
            updated_at=subscription.updated_at,
        )


class SubscribeRequest(BaseModel):
    """Request to create a new subscription."""

    tier: SubscriptionTier
    billing_interval: BillingInterval = BillingInterval.MONTHLY
    payment_method_id: str = Field(description="Stripe payment method ID (from frontend)")
    trial_days: int = Field(default=14, ge=0, le=30)


class UpdateSubscriptionRequest(BaseModel):
    """Request to update subscription (change plan/interval)."""

    tier: SubscriptionTier | None = None
    billing_interval: BillingInterval | None = None


class AddPaymentMethodRequest(BaseModel):
    """Request to add a payment method."""

    payment_method_id: str = Field(description="Stripe payment method ID (from frontend)")


class InvoiceResponse(BaseModel):
    """Schema for invoice response."""

    id: str
    amount_due: int
    amount_paid: int
    currency: str
    status: str
    invoice_pdf: str | None
    created: datetime
    period_start: datetime | None
    period_end: datetime | None


# Initialize Stripe client lazily (requires STRIPE_SECRET_KEY in environment)
try:
    stripe_client: StripeClient | None = StripeClient()
except ValueError:
    stripe_client = None  # Stripe not configured — billing endpoints will return 503


def _require_stripe() -> StripeClient:
    """Return the Stripe client or raise 503 if not configured."""
    if stripe_client is None:
        raise HTTPException(status_code=503, detail="Stripe billing is not configured")
    return stripe_client


def _get_stripe_price_id(tier: SubscriptionTier, interval: BillingInterval) -> str:
    """Look up the Stripe Price ID for a given tier + billing interval from env vars.

    Expected env var format: STRIPE_{TIER}_{INTERVAL}_PRICE_ID
    e.g. STRIPE_STARTER_MONTHLY_PRICE_ID, STRIPE_PROFESSIONAL_ANNUAL_PRICE_ID
    """
    env_key = f"STRIPE_{tier.value.upper()}_{interval.value.upper()}_PRICE_ID"
    price_id = os.getenv(env_key)
    if not price_id:
        raise HTTPException(
            status_code=503,
            detail=f"Stripe Price ID not configured for {tier.value} {interval.value}. "
                   f"Set {env_key} in environment.",
        )
    return price_id


@router.get("", response_model=SubscriptionResponse)
@require_permission("billing:read")
async def get_subscription(
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> SubscriptionResponse:
    """Get current organization's subscription details."""
    result = await db.execute(
        select(Subscription).where(Subscription.organization_id == org_id)
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        # Create default trial subscription if none exists
        config = get_tier_config(SubscriptionTier.STARTER, BillingInterval.MONTHLY)
        subscription = Subscription(
            organization_id=org_id,
            tier=SubscriptionTier.STARTER,
            status=SubscriptionStatus.TRIAL,
            billing_interval=BillingInterval.MONTHLY,
            price_cents=0,  # Free trial
            trial_ends_at=datetime.utcnow() + timedelta(days=14),
            **{k: v for k, v in config.items() if k.startswith("max_") or k.startswith("has_")},
        )
        db.add(subscription)
        await db.commit()
        await db.refresh(subscription)

    return SubscriptionResponse.from_orm(subscription)


@router.post("/subscribe", response_model=SubscriptionResponse)
@require_permission("billing:manage")
async def subscribe(
    request: SubscribeRequest,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> SubscriptionResponse:
    """Create a new subscription (convert from trial or change plan).

    Steps:
    1. Get or create Stripe customer
    2. Attach payment method
    3. Create Stripe subscription
    4. Update local subscription record
    """
    # Get organization
    org_result = await db.execute(select(Organization).where(Organization.id == org_id))
    organization = org_result.scalar_one_or_none()
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    client = _require_stripe()

    # Get or create subscription record
    result = await db.execute(
        select(Subscription).where(Subscription.organization_id == org_id)
    )
    subscription = result.scalar_one_or_none()

    # Get tier configuration
    config = get_tier_config(request.tier, request.billing_interval)

    # Resolve Stripe Price ID — raises 503 if not configured in env
    price_id = _get_stripe_price_id(request.tier, request.billing_interval)

    try:
        # Create or get Stripe customer
        if subscription and subscription.stripe_customer_id:
            stripe_customer = await client.get_customer(subscription.stripe_customer_id)
        else:
            stripe_customer = await client.create_customer(
                email=f"billing@{organization.slug}.ccw-erp.com",
                name=organization.name,
                metadata={"organization_id": str(org_id)},
            )

        # Attach payment method and set as default
        await client.attach_payment_method(
            request.payment_method_id,
            stripe_customer.id,
        )

        # Create the real Stripe subscription
        stripe_sub = await client.create_subscription(
            customer_id=stripe_customer.id,
            price_id=price_id,
            trial_period_days=request.trial_days if request.trial_days > 0 else None,
            metadata={"organization_id": str(org_id), "tier": request.tier.value},
        )

        # Determine status and period dates from Stripe response
        is_trialing = stripe_sub["status"] == "trialing"
        period_start = datetime.fromtimestamp(stripe_sub["current_period_start"])
        period_end = datetime.fromtimestamp(stripe_sub["current_period_end"])
        new_status = SubscriptionStatus.TRIAL if is_trialing else SubscriptionStatus.ACTIVE
        trial_end_dt = (
            datetime.fromtimestamp(stripe_sub["trial_end"])
            if stripe_sub.get("trial_end")
            else None
        )

        # Update or create subscription record
        if subscription:
            subscription.tier = request.tier
            subscription.billing_interval = request.billing_interval
            subscription.status = new_status
            subscription.stripe_customer_id = stripe_customer.id
            subscription.stripe_subscription_id = stripe_sub["id"]
            subscription.stripe_payment_method_id = request.payment_method_id
            subscription.price_cents = config["price_cents"]
            subscription.trial_ends_at = trial_end_dt
            subscription.current_period_start = period_start
            subscription.current_period_end = period_end
            # Update limits
            subscription.max_locations = config["max_locations"]
            subscription.max_users = config["max_users"]
            subscription.max_products = config["max_products"]
            subscription.max_ai_quotes_per_month = config["max_ai_quotes_per_month"]
            subscription.has_multi_location = config["has_multi_location"]
            subscription.has_ai_features = config["has_ai_features"]
            subscription.has_api_access = config["has_api_access"]
            subscription.has_white_label = config["has_white_label"]
        else:
            subscription = Subscription(
                organization_id=org_id,
                tier=request.tier,
                status=new_status,
                billing_interval=request.billing_interval,
                stripe_customer_id=stripe_customer.id,
                stripe_subscription_id=stripe_sub["id"],
                stripe_payment_method_id=request.payment_method_id,
                price_cents=config["price_cents"],
                trial_ends_at=trial_end_dt,
                current_period_start=period_start,
                current_period_end=period_end,
                **{k: v for k, v in config.items() if k.startswith("max_") or k.startswith("has_")},
            )
            db.add(subscription)

        await db.commit()
        await db.refresh(subscription)

        return SubscriptionResponse.from_orm(subscription)

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Subscription creation failed: {str(e)}")


@router.put("/subscription", response_model=SubscriptionResponse)
@require_permission("billing:manage")
async def update_subscription(
    request: UpdateSubscriptionRequest,
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> SubscriptionResponse:
    """Update subscription (change tier or billing interval)."""
    result = await db.execute(
        select(Subscription).where(Subscription.organization_id == org_id)
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        raise HTTPException(status_code=404, detail="No subscription found")

    if subscription.status not in [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL]:
        raise HTTPException(status_code=400, detail="Cannot update inactive subscription")

    # Update tier if provided
    if request.tier:
        subscription.tier = request.tier

    # Update billing interval if provided
    if request.billing_interval:
        subscription.billing_interval = request.billing_interval

    # Recalculate pricing and limits
    config = get_tier_config(subscription.tier, subscription.billing_interval)
    subscription.price_cents = config["price_cents"]
    subscription.max_locations = config["max_locations"]
    subscription.max_users = config["max_users"]
    subscription.max_products = config["max_products"]
    subscription.max_ai_quotes_per_month = config["max_ai_quotes_per_month"]
    subscription.has_multi_location = config["has_multi_location"]
    subscription.has_ai_features = config["has_ai_features"]
    subscription.has_api_access = config["has_api_access"]
    subscription.has_white_label = config["has_white_label"]

    # Update the Stripe subscription with the new price if one exists
    if subscription.stripe_subscription_id:
        try:
            client = _require_stripe()
            new_price_id = _get_stripe_price_id(subscription.tier, subscription.billing_interval)
            await client.update_subscription(
                subscription.stripe_subscription_id,
                price_id=new_price_id,
            )
        except HTTPException:
            # If Stripe not configured or price ID missing, skip remote update
            # Local DB record is still updated
            pass

    await db.commit()
    await db.refresh(subscription)

    return SubscriptionResponse.from_orm(subscription)


@router.delete("/subscription", response_model=SubscriptionResponse)
@require_permission("billing:manage")
async def cancel_subscription(
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    immediately: bool = False,
) -> SubscriptionResponse:
    """Cancel subscription (at period end or immediately)."""
    result = await db.execute(
        select(Subscription).where(Subscription.organization_id == org_id)
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        raise HTTPException(status_code=404, detail="No subscription found")

    if subscription.status != SubscriptionStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Subscription not active")

    try:
        # Cancel Stripe subscription if exists
        if subscription.stripe_subscription_id:
            client = _require_stripe()
            await client.cancel_subscription(
                subscription.stripe_subscription_id,
                immediately=immediately,
            )

        # Update local record
        if immediately:
            subscription.status = SubscriptionStatus.CANCELED
            subscription.canceled_at = datetime.utcnow()
        else:
            # Will cancel at period end
            subscription.canceled_at = subscription.current_period_end

        await db.commit()
        await db.refresh(subscription)

        return SubscriptionResponse.from_orm(subscription)

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Cancellation failed: {str(e)}")


@router.get("/invoices", response_model=list[InvoiceResponse])
@require_permission("billing:read")
async def list_invoices(
    org_id: CurrentOrganization,
    db: Annotated[AsyncSession, Depends(get_async_db)],
    limit: int = 10,
) -> list[InvoiceResponse]:
    """List invoices for the organization."""
    result = await db.execute(
        select(Subscription).where(Subscription.organization_id == org_id)
    )
    subscription = result.scalar_one_or_none()

    if not subscription or not subscription.stripe_customer_id:
        return []

    try:
        client = _require_stripe()
        invoices = await client.list_invoices(
            subscription.stripe_customer_id,
            limit=limit,
        )

        return [
            InvoiceResponse(
                id=invoice.id,
                amount_due=invoice.amount_due,
                amount_paid=invoice.amount_paid,
                currency=invoice.currency,
                status=invoice.status,
                invoice_pdf=invoice.invoice_pdf if hasattr(invoice, "invoice_pdf") else None,
                created=datetime.fromtimestamp(invoice.created),
                period_start=datetime.fromtimestamp(invoice.period_start) if invoice.period_start else None,
                period_end=datetime.fromtimestamp(invoice.period_end) if invoice.period_end else None,
            )
            for invoice in invoices
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to retrieve invoices: {str(e)}")


@router.post("/webhooks")
async def handle_stripe_webhook(
    request: Request,
    stripe_signature: Annotated[str | None, Header()] = None,
    db: Annotated[AsyncSession, Depends(get_async_db)] = None,
) -> dict:
    """Handle Stripe webhook events.

    Processes events:
    - customer.subscription.updated: Update subscription status
    - customer.subscription.deleted: Mark subscription as canceled
    - invoice.payment_succeeded: Update payment status
    - invoice.payment_failed: Mark subscription as past_due
    """
    if not stripe_signature:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")

    # Get raw request body
    payload = await request.body()

    try:
        # Verify webhook signature
        client = _require_stripe()
        event = client.verify_webhook_signature(payload, stripe_signature)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Handle different event types
    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "customer.subscription.updated":
        # Update subscription status
        subscription_id = data["id"]
        org_id_str = data.get("metadata", {}).get("organization_id")

        if org_id_str:
            org_id = UUID(org_id_str)
            result = await db.execute(
                select(Subscription).where(Subscription.organization_id == org_id)
            )
            subscription = result.scalar_one_or_none()

            if subscription:
                subscription.status = SubscriptionStatus.ACTIVE
                subscription.current_period_start = datetime.fromtimestamp(data["current_period_start"])
                subscription.current_period_end = datetime.fromtimestamp(data["current_period_end"])
                await db.commit()

    elif event_type == "customer.subscription.deleted":
        # Mark subscription as canceled
        org_id_str = data.get("metadata", {}).get("organization_id")

        if org_id_str:
            org_id = UUID(org_id_str)
            result = await db.execute(
                select(Subscription).where(Subscription.organization_id == org_id)
            )
            subscription = result.scalar_one_or_none()

            if subscription:
                subscription.status = SubscriptionStatus.CANCELED
                subscription.canceled_at = datetime.utcnow()
                await db.commit()

    elif event_type == "invoice.payment_succeeded":
        # Update period dates after successful payment
        customer_id = data["customer"]
        result = await db.execute(
            select(Subscription).where(Subscription.stripe_customer_id == customer_id)
        )
        subscription = result.scalar_one_or_none()

        if subscription:
            subscription.status = SubscriptionStatus.ACTIVE
            # Update period from the subscription object on the invoice
            sub_data = data.get("subscription")
            if sub_data and isinstance(sub_data, dict):
                if sub_data.get("current_period_start"):
                    subscription.current_period_start = datetime.fromtimestamp(
                        sub_data["current_period_start"]
                    )
                if sub_data.get("current_period_end"):
                    subscription.current_period_end = datetime.fromtimestamp(
                        sub_data["current_period_end"]
                    )
            await db.commit()

    elif event_type == "invoice.payment_failed":
        # Mark subscription as past_due
        customer_id = data["customer"]
        result = await db.execute(
            select(Subscription).where(Subscription.stripe_customer_id == customer_id)
        )
        subscription = result.scalar_one_or_none()

        if subscription:
            subscription.status = SubscriptionStatus.PAST_DUE
            await db.commit()

    return {"status": "success", "event_type": event_type}
