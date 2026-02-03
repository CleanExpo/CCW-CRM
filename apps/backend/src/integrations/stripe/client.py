"""Stripe SDK wrapper for subscription billing.

Provides methods for:
- Customer management
- Subscription CRUD operations
- Payment method management
- Webhook verification
"""

import os
from datetime import datetime
from typing import Any

import stripe
from stripe import (
    Customer,
    Invoice,
    PaymentMethod,
    Price,
    Product,
    Subscription,
    WebhookEndpoint,
)
from stripe.error import StripeError


class StripeClient:
    """Wrapper for Stripe API operations."""

    def __init__(self, api_key: str | None = None):
        """Initialize Stripe client with API key from environment or parameter."""
        self.api_key = api_key or os.getenv("STRIPE_SECRET_KEY")
        if not self.api_key:
            raise ValueError("Stripe API key not provided")

        stripe.api_key = self.api_key
        self.webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")

        # ✅ SECURITY: Fail fast if webhook secret missing in production
        is_production = os.getenv("ENVIRONMENT", "development") == "production"
        if is_production and not self.webhook_secret:
            raise ValueError(
                "STRIPE_WEBHOOK_SECRET required in production for secure webhook verification"
            )

    # Customer Management

    async def create_customer(
        self,
        email: str,
        name: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Customer:
        """Create a new Stripe customer.

        Args:
            email: Customer email address
            name: Customer name (optional)
            metadata: Custom metadata (e.g., organization_id)

        Returns:
            Stripe Customer object
        """
        try:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata=metadata or {},
            )
            return customer
        except StripeError as e:
            raise Exception(f"Failed to create Stripe customer: {str(e)}")

    async def get_customer(self, customer_id: str) -> Customer:
        """Retrieve a Stripe customer by ID."""
        try:
            return stripe.Customer.retrieve(customer_id)
        except StripeError as e:
            raise Exception(f"Failed to retrieve customer: {str(e)}")

    async def update_customer(
        self,
        customer_id: str,
        email: str | None = None,
        name: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Customer:
        """Update a Stripe customer."""
        try:
            update_data = {}
            if email:
                update_data["email"] = email
            if name:
                update_data["name"] = name
            if metadata:
                update_data["metadata"] = metadata

            return stripe.Customer.modify(customer_id, **update_data)
        except StripeError as e:
            raise Exception(f"Failed to update customer: {str(e)}")

    # Payment Method Management

    async def attach_payment_method(
        self, payment_method_id: str, customer_id: str
    ) -> PaymentMethod:
        """Attach a payment method to a customer."""
        try:
            payment_method = stripe.PaymentMethod.attach(
                payment_method_id,
                customer=customer_id,
            )

            # Set as default payment method
            stripe.Customer.modify(
                customer_id,
                invoice_settings={"default_payment_method": payment_method_id},
            )

            return payment_method
        except StripeError as e:
            raise Exception(f"Failed to attach payment method: {str(e)}")

    async def detach_payment_method(self, payment_method_id: str) -> PaymentMethod:
        """Detach a payment method from a customer."""
        try:
            return stripe.PaymentMethod.detach(payment_method_id)
        except StripeError as e:
            raise Exception(f"Failed to detach payment method: {str(e)}")

    async def list_payment_methods(self, customer_id: str) -> list[PaymentMethod]:
        """List all payment methods for a customer."""
        try:
            response = stripe.PaymentMethod.list(customer=customer_id, type="card")
            return response.data
        except StripeError as e:
            raise Exception(f"Failed to list payment methods: {str(e)}")

    # Subscription Management

    async def create_subscription(
        self,
        customer_id: str,
        price_id: str,
        trial_period_days: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Subscription:
        """Create a new subscription for a customer.

        Args:
            customer_id: Stripe customer ID
            price_id: Stripe price ID (identifies plan + interval)
            trial_period_days: Optional trial period in days
            metadata: Custom metadata (e.g., organization_id, tier)

        Returns:
            Stripe Subscription object
        """
        try:
            subscription_data = {
                "customer": customer_id,
                "items": [{"price": price_id}],
                "metadata": metadata or {},
            }

            if trial_period_days:
                subscription_data["trial_period_days"] = trial_period_days

            return stripe.Subscription.create(**subscription_data)
        except StripeError as e:
            raise Exception(f"Failed to create subscription: {str(e)}")

    async def get_subscription(self, subscription_id: str) -> Subscription:
        """Retrieve a subscription by ID."""
        try:
            return stripe.Subscription.retrieve(subscription_id)
        except StripeError as e:
            raise Exception(f"Failed to retrieve subscription: {str(e)}")

    async def update_subscription(
        self,
        subscription_id: str,
        price_id: str | None = None,
        cancel_at_period_end: bool | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Subscription:
        """Update an existing subscription.

        Args:
            subscription_id: Stripe subscription ID
            price_id: New price ID (to change plan/interval)
            cancel_at_period_end: Whether to cancel at end of billing period
            metadata: Custom metadata

        Returns:
            Updated Subscription object
        """
        try:
            update_data = {}

            if price_id:
                # Get current subscription
                subscription = await self.get_subscription(subscription_id)
                current_item = subscription["items"]["data"][0]

                # Update subscription item
                update_data["items"] = [{"id": current_item.id, "price": price_id}]

            if cancel_at_period_end is not None:
                update_data["cancel_at_period_end"] = cancel_at_period_end

            if metadata:
                update_data["metadata"] = metadata

            return stripe.Subscription.modify(subscription_id, **update_data)
        except StripeError as e:
            raise Exception(f"Failed to update subscription: {str(e)}")

    async def cancel_subscription(self, subscription_id: str, immediately: bool = False) -> Subscription:
        """Cancel a subscription.

        Args:
            subscription_id: Stripe subscription ID
            immediately: If True, cancel immediately. If False, cancel at period end.

        Returns:
            Canceled Subscription object
        """
        try:
            if immediately:
                return stripe.Subscription.delete(subscription_id)
            else:
                return stripe.Subscription.modify(
                    subscription_id,
                    cancel_at_period_end=True,
                )
        except StripeError as e:
            raise Exception(f"Failed to cancel subscription: {str(e)}")

    # Invoice Management

    async def get_upcoming_invoice(self, customer_id: str) -> Invoice:
        """Retrieve the upcoming invoice for a customer."""
        try:
            return stripe.Invoice.upcoming(customer=customer_id)
        except StripeError as e:
            raise Exception(f"Failed to retrieve upcoming invoice: {str(e)}")

    async def list_invoices(
        self,
        customer_id: str,
        limit: int = 10,
    ) -> list[Invoice]:
        """List invoices for a customer."""
        try:
            response = stripe.Invoice.list(customer=customer_id, limit=limit)
            return response.data
        except StripeError as e:
            raise Exception(f"Failed to list invoices: {str(e)}")

    # Webhook Handling

    def verify_webhook_signature(
        self,
        payload: bytes,
        signature: str,
    ) -> dict[str, Any]:
        """Verify and parse Stripe webhook event.

        Args:
            payload: Raw webhook request body
            signature: Stripe-Signature header value

        Returns:
            Parsed event object

        Raises:
            ValueError: If signature verification fails
        """
        try:
            event = stripe.Webhook.construct_event(
                payload, signature, self.webhook_secret
            )
            return event
        except ValueError as e:
            raise ValueError(f"Invalid webhook signature: {str(e)}")
        except Exception as e:
            raise Exception(f"Webhook verification failed: {str(e)}")

    # Helper Methods

    @staticmethod
    def format_amount(amount_cents: int) -> str:
        """Format amount in cents to dollar string."""
        return f"${amount_cents / 100:.2f}"

    @staticmethod
    def cents_to_dollars(amount_cents: int) -> float:
        """Convert cents to dollars."""
        return amount_cents / 100

    @staticmethod
    def dollars_to_cents(amount_dollars: float) -> int:
        """Convert dollars to cents."""
        return int(amount_dollars * 100)
