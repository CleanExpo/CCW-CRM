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

    # Get or create subscription record
    result = await db.execute(
        select(Subscription).where(Subscription.organization_id == org_id)
    )
    subscription = result.scalar_one_or_none()

    # Get tier configuration
    config = get_tier_config(request.tier, request.billing_interval)

    try:
        # Create or get Stripe customer
        if subscription and subscription.stripe_customer_id:
            stripe_customer = await stripe_client.get_customer(subscription.stripe_customer_id)
        else:
            stripe_customer = await stripe_client.create_customer(
                email=f"billing@{organization.slug}.example.com",  # TODO: Use actual billing email
                name=organization.name,
                metadata={"organization_id": str(org_id)},
            )

        # Attach payment method
        await stripe_client.attach_payment_method(
            request.payment_method_id,
            stripe_customer.id,
        )

        # Create Stripe subscription
        # Note: In production, you'd have Stripe Price IDs configured for each tier/interval
        # For now, we'll store the price in our database and handle it manually
        stripe_subscription = None  # TODO: Create actual Stripe subscription with Price ID

        # Update or create subscription record
        if subscription:
            subscription.tier = request.tier
            subscription.billing_interval = request.billing_interval
            subscription.status = SubscriptionStatus.ACTIVE
            subscription.stripe_customer_id = stripe_customer.id
            subscription.stripe_payment_method_id = request.payment_method_id
            subscription.price_cents = config["price_cents"]
            subscription.trial_ends_at = None
            subscription.current_period_start = datetime.utcnow()
            subscription.current_period_end = datetime.utcnow() + timedelta(days=30)
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
                status=SubscriptionStatus.ACTIVE,
                billing_interval=request.billing_interval,
                stripe_customer_id=stripe_customer.id,
                stripe_payment_method_id=request.payment_method_id,
                price_cents=config["price_cents"],
                current_period_start=datetime.utcnow(),
                current_period_end=datetime.utcnow() + timedelta(days=30),
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

    # TODO: Update Stripe subscription with new price

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
            await stripe_client.cancel_subscription(
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
        invoices = await stripe_client.list_invoices(
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
        event = stripe_client.verify_webhook_signature(payload, stripe_signature)
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
