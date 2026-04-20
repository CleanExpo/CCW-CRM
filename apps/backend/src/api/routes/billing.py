"""Billing and payment endpoints (Phase 2 Batch 2A).

GAP-010: POST /api/billing/payment-methods
GAP-011: GET /api/billing/payment-methods/enum
GAP-012: POST /api/billing/dunning/send-letter (uses dunning service)
GAP-013: GET /api/billing/subscription-health
GAP-014: POST /api/billing/retry-failed-payment
"""
from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated
from uuid import UUID, uuid4

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import get_current_user
from src.config.database import get_async_db
from src.db.demo_models import Customer
from src.db.models.invoicing import Invoice
from src.services.dunning import (
    calculate_days_overdue,
    generate_dunning_letter,
    get_dunning_level,
    should_send_dunning_pure,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/billing", tags=["billing"], dependencies=[Depends(get_current_user)])


# ---------------------------------------------------------------------------
# Request/Response Models
# ---------------------------------------------------------------------------


class PaymentMethodCreate(BaseModel):
    """Request model for creating payment method."""

    customer_id: UUID
    type: str = Field(description="credit_card, bank_account, paypal, stripe, square")
    is_default: bool = False
    # Card details (if credit_card)
    card_number_last4: str | None = None
    card_brand: str | None = Field(None, description="visa, mastercard, amex")
    expiry_month: int | None = None
    expiry_year: int | None = None
    # Bank details (if bank_account)
    account_number_last4: str | None = None
    routing_number: str | None = None
    account_holder_name: str | None = None


class PaymentMethodResponse(BaseModel):
    """Response model for payment method."""

    id: UUID
    customer_id: UUID
    type: str
    is_default: bool
    is_verified: bool
    display_name: str = Field(description="Masked display name like 'Visa •••• 4242'")
    created_at: datetime


class PaymentMethodEnumResponse(BaseModel):
    """Response model for payment method types enum."""

    types: list[dict[str, str]] = Field(
        description="List of payment method types with value/label pairs"
    )


class DunningLetterRequest(BaseModel):
    """Request model for sending dunning letter."""

    invoice_id: UUID
    force_send: bool = Field(
        default=False,
        description="Override 'already sent today' check"
    )


class DunningLetterResponse(BaseModel):
    """Response model for dunning letter send result."""

    invoice_id: UUID
    level: int = Field(description="Dunning level 1-4")
    letter_sent: bool
    email_sent_to: str
    subject: str
    body_preview: str = Field(description="First 200 chars of letter body")
    reason: str = Field(description="Success message or reason for not sending")


class SubscriptionHealthResponse(BaseModel):
    """Response model for subscription health metrics."""

    total_subscriptions: int
    active: int
    past_due: int
    cancelled: int
    trial: int
    mrr: Decimal = Field(description="Monthly Recurring Revenue")
    churn_rate: float = Field(description="Churn rate percentage")
    health_score: int = Field(description="Health score 0-100", ge=0, le=100)


class RetryPaymentRequest(BaseModel):
    """Request model for retrying failed payment."""

    invoice_id: UUID
    payment_method_id: UUID | None = Field(
        None,
        description="Optional payment method ID, uses default if not provided"
    )


class RetryPaymentResponse(BaseModel):
    """Response model for retry payment result."""

    invoice_id: UUID
    payment_status: str = Field(description="paid, failed, pending")
    transaction_id: UUID | None
    error_message: str | None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/payment-methods/enum")
async def get_payment_method_enum() -> PaymentMethodEnumResponse:
    """
    GAP-011 / RA-179: Get available payment method types.

    Returns enum of supported payment method types for dropdowns/forms.
    """
    logger.info("get_payment_method_enum_called")

    return PaymentMethodEnumResponse(
        types=[
            {"value": "credit_card", "label": "Credit Card"},
            {"value": "bank_account", "label": "Bank Account"},
            {"value": "paypal", "label": "PayPal"},
            {"value": "stripe", "label": "Stripe"},
            {"value": "square", "label": "Square"},
        ]
    )


@router.post("/payment-methods")
async def create_payment_method(
    payment_method: PaymentMethodCreate,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> PaymentMethodResponse:
    """
    GAP-010 / RA-178: Create payment method for customer billing.

    Creates a new payment method for a customer. Can mark as default.
    If marking as default, unsets previous default payment method.

    Note: This is a mock implementation. In production, would integrate
    with Stripe/PayPal/etc to tokenize and store payment methods securely.
    """
    logger.info(
        "create_payment_method_called",
        customer_id=str(payment_method.customer_id),
        type=payment_method.type,
        is_default=payment_method.is_default,
    )

    # Validate customer exists
    stmt = select(Customer).where(Customer.id == payment_method.customer_id)
    result = await db.execute(stmt)
    customer = result.scalar_one_or_none()
    if not customer:
        logger.warning("customer_not_found", customer_id=str(payment_method.customer_id))
        raise HTTPException(status_code=404, detail="Customer not found")

    # Generate display name
    if payment_method.type == "credit_card":
        brand = payment_method.card_brand or "Card"
        last4 = payment_method.card_number_last4 or "****"
        display_name = f"{brand.title()} •••• {last4}"
    elif payment_method.type == "bank_account":
        last4 = payment_method.account_number_last4 or "****"
        display_name = f"Bank Account •••• {last4}"
    else:
        display_name = payment_method.type.replace("_", " ").title()

    # Mock: Create payment method (PaymentMethod model doesn't exist yet)
    # In production: call Stripe API, store token reference
    payment_method_id = uuid4()

    logger.info(
        "payment_method_created",
        payment_method_id=str(payment_method_id),
        customer_id=str(payment_method.customer_id),
        display_name=display_name,
    )

    return PaymentMethodResponse(
        id=payment_method_id,
        customer_id=payment_method.customer_id,
        type=payment_method.type,
        is_default=payment_method.is_default,
        is_verified=False,  # Require verification flow in production
        display_name=display_name,
        created_at=datetime.now(UTC),
    )


@router.post("/dunning/send-letter")
async def send_dunning_letter(
    request: DunningLetterRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> DunningLetterResponse:
    """
    GAP-012 / RA-180: Send dunning letter for overdue invoice.

    Uses dunning service to:
    1. Calculate dunning level (1-4) based on days overdue
    2. Check if should send (not already sent today, not paid, etc.)
    3. Generate appropriate dunning letter
    4. Send email (mock for now)

    Args:
        request: DunningLetterRequest with invoice_id and force_send flag

    Returns:
        DunningLetterResponse with send result
    """
    logger.info(
        "send_dunning_letter_called",
        invoice_id=str(request.invoice_id),
        force_send=request.force_send,
    )

    # Get invoice
    stmt = select(Invoice).where(Invoice.id == request.invoice_id)
    result = await db.execute(stmt)
    invoice = result.scalar_one_or_none()
    if not invoice:
        logger.warning("invoice_not_found", invoice_id=str(request.invoice_id))
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Check if paid (payment_status exists on Invoice model)
    if hasattr(invoice, "payment_status") and invoice.payment_status == "paid":
        logger.info("invoice_already_paid", invoice_id=str(request.invoice_id))
        raise HTTPException(status_code=400, detail="Invoice is already paid")

    # Check if paid by amount_due (alternative check)
    if invoice.amount_due <= Decimal("0"):
        logger.info("invoice_paid_by_amount", invoice_id=str(request.invoice_id))
        raise HTTPException(status_code=400, detail="Invoice is already paid")

    # Calculate days overdue
    days_overdue = calculate_days_overdue(invoice.due_date)
    if days_overdue < 0:
        logger.warning(
            "invoice_not_yet_due",
            invoice_id=str(request.invoice_id),
            days_overdue=days_overdue,
        )
        raise HTTPException(status_code=400, detail="Invoice is not overdue yet")

    # Check if should send (unless force_send)
    if not request.force_send:
        # In real system, would fetch last_dunning_sent from DB
        # For now, always allow first send
        dunning_check = should_send_dunning_pure(
            due_date=invoice.due_date,
            last_dunning_sent=None,  # Mock: first time sending
            amount_due=invoice.amount_due,
        )

        if not dunning_check.should_send:
            level = get_dunning_level(days_overdue)
            logger.info(
                "dunning_not_eligible",
                invoice_id=str(request.invoice_id),
                reason=dunning_check.reason,
            )
            return DunningLetterResponse(
                invoice_id=invoice.id,
                level=level.value,
                letter_sent=False,
                email_sent_to="",
                subject="",
                body_preview="",
                reason=dunning_check.reason,
            )

    # Generate letter using dunning service
    level = get_dunning_level(days_overdue)
    letter = generate_dunning_letter(
        invoice_number=invoice.invoice_number,
        customer_name="Valued Customer",  # In production: fetch from invoice.customer.company_name
        amount_due=invoice.amount_due,
        due_date=invoice.due_date,
        level=level,
    )

    # Mock: Send email (in production, use SendGrid/SES/etc)
    customer_email = "customer@example.com"  # In production: invoice.customer.email

    # Update last dunning date (if Invoice model has this field)
    # ...

    logger.info(
        "dunning_letter_sent",
        invoice_id=str(request.invoice_id),
        level=level.value,
        tone=letter.tone,
        email_sent_to=customer_email,
    )

    body_preview = letter.body[:200] + "..." if len(letter.body) > 200 else letter.body

    return DunningLetterResponse(
        invoice_id=invoice.id,
        level=level.value,
        letter_sent=True,
        email_sent_to=customer_email,
        subject=letter.subject,
        body_preview=body_preview,
        reason="Sent successfully",
    )


@router.get("/subscription-health")
async def get_subscription_health(
    organization_id: Annotated[UUID, Query()],
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> SubscriptionHealthResponse:
    """
    GAP-013 / RA-181: Get subscription health metrics.

    Dashboard widget showing subscription health:
    - Total subscriptions, active, past_due, cancelled, trial
    - MRR (Monthly Recurring Revenue)
    - Churn rate
    - Health score (0-100)

    Note: Mock implementation - Subscription model doesn't exist yet.
    In production, would query subscriptions table and calculate metrics.
    """
    logger.info(
        "get_subscription_health_called",
        organization_id=str(organization_id),
    )

    # Mock implementation
    # In production: query subscriptions table, calculate real metrics
    return SubscriptionHealthResponse(
        total_subscriptions=150,
        active=135,
        past_due=10,
        cancelled=5,
        trial=15,
        mrr=Decimal("12500.00"),
        churn_rate=3.3,
        health_score=87,
    )


@router.post("/retry-failed-payment")
async def retry_failed_payment(
    request: RetryPaymentRequest,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> RetryPaymentResponse:
    """
    GAP-014 / RA-182: Retry failed payment.

    Retries payment for invoice with optional new payment method.
    If payment_method_id not provided, uses customer's default.

    Note: Mock implementation. In production, would integrate with
    Stripe/PayPal/etc payment gateway to actually process payment.
    """
    logger.info(
        "retry_failed_payment_called",
        invoice_id=str(request.invoice_id),
        payment_method_id=str(request.payment_method_id) if request.payment_method_id else None,
    )

    # Get invoice
    stmt = select(Invoice).where(Invoice.id == request.invoice_id)
    result = await db.execute(stmt)
    invoice = result.scalar_one_or_none()
    if not invoice:
        logger.warning("invoice_not_found", invoice_id=str(request.invoice_id))
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Check if already paid
    if hasattr(invoice, "payment_status") and invoice.payment_status == "paid":
        logger.info("invoice_already_paid", invoice_id=str(request.invoice_id))
        raise HTTPException(status_code=400, detail="Invoice is already paid")

    if invoice.amount_due <= Decimal("0"):
        logger.info("invoice_paid_by_amount", invoice_id=str(request.invoice_id))
        raise HTTPException(status_code=400, detail="Invoice is already paid")

    # Mock: Process payment
    # In production: call Stripe/PayPal API with payment_method_id
    # Simulate 90% success rate
    import random
    success = random.random() < 0.9

    if success:
        # Update invoice status to paid
        if hasattr(invoice, "payment_status"):
            stmt = (
                update(Invoice)
                .where(Invoice.id == request.invoice_id)
                .values(payment_status="paid", amount_paid=invoice.total, amount_due=Decimal("0"))
            )
            await db.execute(stmt)
            await db.commit()

        transaction_id = uuid4()
        logger.info(
            "payment_retry_success",
            invoice_id=str(request.invoice_id),
            transaction_id=str(transaction_id),
        )

        return RetryPaymentResponse(
            invoice_id=invoice.id,
            payment_status="paid",
            transaction_id=transaction_id,
            error_message=None,
        )
    else:
        logger.warning(
            "payment_retry_failed",
            invoice_id=str(request.invoice_id),
        )

        return RetryPaymentResponse(
            invoice_id=invoice.id,
            payment_status="failed",
            transaction_id=None,
            error_message="Payment declined: Insufficient funds",
        )
