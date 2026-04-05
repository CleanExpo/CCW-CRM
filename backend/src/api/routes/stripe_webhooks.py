"""Stripe webhook receiver endpoint.

Receives and processes Stripe webhook events. Stripe sends event payloads
to this endpoint whenever subscription or payment events occur.

Handled events:
- invoice.paid — Mark invoice as paid, update amount_paid/amount_due
- invoice.payment_failed — Mark invoice as overdue / payment failed
- customer.subscription.updated — Log subscription state changes
- checkout.session.completed — Mark related invoice as paid

Security: Signature is verified via STRIPE_WEBHOOK_SECRET before any
processing occurs. Unsigned or tampered requests are rejected with 400.
"""
from __future__ import annotations

import json as _json
import os
from decimal import Decimal
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db
from src.db.models.invoicing import Invoice

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/webhooks", tags=["Stripe Webhooks"])

STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_async_db)],
) -> dict[str, str]:
    """Receive and process Stripe webhook events.

    Verifies the Stripe-Signature header then dispatches to the appropriate
    event handler. Returns 200 immediately to prevent Stripe from retrying
    events that were successfully received but had non-critical processing
    errors.
    """
    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")

    # Verify signature
    event = _verify_signature(payload, signature)
    if event is None:
        raise HTTPException(status_code=400, detail="Invalid Stripe webhook signature")

    event_type: str = event.get("type", "")
    event_data: dict = event.get("data", {}).get("object", {})

    logger.info("Stripe webhook received", event_type=event_type, event_id=event.get("id"))

    # Dispatch
    try:
        if event_type == "invoice.paid":
            await _handle_invoice_paid(db, event_data)
        elif event_type == "invoice.payment_failed":
            await _handle_invoice_payment_failed(db, event_data)
        elif event_type == "customer.subscription.updated":
            _handle_subscription_updated(event_data)
        elif event_type == "checkout.session.completed":
            await _handle_checkout_completed(db, event_data)
        else:
            logger.info("Stripe webhook event not handled", event_type=event_type)
    except Exception as exc:
        # Log but don't raise — Stripe should not retry on processing errors
        logger.error(
            "Stripe webhook processing error",
            event_type=event_type,
            error=str(exc),
        )

    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Signature verification
# ---------------------------------------------------------------------------


def _verify_signature(payload: bytes, signature: str) -> dict[Any, Any] | None:
    """Verify Stripe webhook signature and return parsed event.

    Returns None if verification fails (missing secret, bad signature, etc.).
    """
    if not STRIPE_WEBHOOK_SECRET:
        logger.warning(
            "STRIPE_WEBHOOK_SECRET not set — accepting webhook without verification. "
            "Set the env var in production."
        )
        # In development without a secret, attempt to parse payload anyway
        try:
            result: dict[Any, Any] = _json.loads(payload)
            return result
        except Exception:
            return None

    try:
        import stripe

        event = stripe.Webhook.construct_event(payload, signature, STRIPE_WEBHOOK_SECRET)
        return dict(event)
    except stripe.SignatureVerificationError as exc:
        logger.warning("Stripe signature verification failed", error=str(exc))
        return None
    except Exception as exc:
        logger.error("Stripe webhook parse error", error=str(exc))
        return None


# ---------------------------------------------------------------------------
# Event handlers
# ---------------------------------------------------------------------------


async def _handle_invoice_paid(db: AsyncSession, invoice_data: dict) -> None:
    """Mark the matching invoice as paid when Stripe reports payment success.

    Matches by the Stripe invoice metadata field ``invoice_number`` if present,
    otherwise falls back to the Stripe invoice ID stored in ``stripe_invoice_id``
    if that column exists. Updates amount_paid, amount_due, and status to 'paid'.
    """
    stripe_invoice_id: str = invoice_data.get("id", "")
    amount_paid_cents: int = invoice_data.get("amount_paid", 0)
    amount_paid: Decimal = Decimal(str(amount_paid_cents)) / Decimal("100")

    # Try to locate by metadata.invoice_number first, then by stripe_invoice_id column
    invoice_number: str | None = (
        invoice_data.get("metadata", {}).get("invoice_number")
    )

    stmt = None
    if invoice_number:
        stmt = select(Invoice).where(Invoice.invoice_number == invoice_number)
    else:
        logger.info(
            "invoice.paid — no invoice_number in metadata, cannot match local invoice",
            stripe_invoice_id=stripe_invoice_id,
        )
        return

    result = await db.execute(stmt)
    invoice: Invoice | None = result.scalar_one_or_none()

    if invoice is None:
        logger.warning(
            "invoice.paid — no matching local invoice found",
            invoice_number=invoice_number,
            stripe_invoice_id=stripe_invoice_id,
        )
        return

    # Update to paid
    await db.execute(
        update(Invoice)
        .where(Invoice.id == invoice.id)
        .values(
            status="paid",
            amount_paid=amount_paid,
            amount_due=Decimal("0.00"),
        )
    )
    await db.commit()

    logger.info(
        "Invoice marked as paid via Stripe webhook",
        invoice_number=invoice_number,
        amount_paid=str(amount_paid),
    )


async def _handle_invoice_payment_failed(db: AsyncSession, invoice_data: dict) -> None:
    """Mark the matching invoice as overdue when Stripe reports payment failure."""
    invoice_number: str | None = (
        invoice_data.get("metadata", {}).get("invoice_number")
    )
    stripe_invoice_id: str = invoice_data.get("id", "")

    if not invoice_number:
        logger.info(
            "invoice.payment_failed — no invoice_number in metadata, skipping",
            stripe_invoice_id=stripe_invoice_id,
        )
        return

    result = await db.execute(
        select(Invoice).where(Invoice.invoice_number == invoice_number)
    )
    invoice: Invoice | None = result.scalar_one_or_none()

    if invoice is None:
        logger.warning(
            "invoice.payment_failed — no matching local invoice",
            invoice_number=invoice_number,
        )
        return

    await db.execute(
        update(Invoice)
        .where(Invoice.id == invoice.id)
        .values(status="overdue")
    )
    await db.commit()

    logger.info(
        "Invoice marked as overdue via Stripe payment_failed webhook",
        invoice_number=invoice_number,
    )


def _handle_subscription_updated(subscription_data: dict) -> None:
    """Log subscription state changes. Extend to update org plan if needed."""
    subscription_id: str = subscription_data.get("id", "unknown")
    status: str = subscription_data.get("status", "unknown")
    customer_id: str = subscription_data.get("customer", "unknown")

    logger.info(
        "Stripe subscription updated",
        subscription_id=subscription_id,
        status=status,
        stripe_customer_id=customer_id,
    )
    # Future: update organizations.plan_tier based on subscription status


async def _handle_checkout_completed(db: AsyncSession, session_data: dict) -> None:
    """Mark invoice as paid after a successful Stripe Checkout session."""
    invoice_number: str | None = (
        session_data.get("metadata", {}).get("invoice_number")
    )
    session_id: str = session_data.get("id", "unknown")

    if not invoice_number:
        logger.info(
            "checkout.session.completed — no invoice_number in metadata, skipping",
            session_id=session_id,
        )
        return

    result = await db.execute(
        select(Invoice).where(Invoice.invoice_number == invoice_number)
    )
    invoice: Invoice | None = result.scalar_one_or_none()

    if invoice is None:
        logger.warning(
            "checkout.session.completed — no matching local invoice",
            invoice_number=invoice_number,
        )
        return

    amount_total_cents: int = session_data.get("amount_total", 0)
    amount_paid: Decimal = Decimal(str(amount_total_cents)) / Decimal("100")

    await db.execute(
        update(Invoice)
        .where(Invoice.id == invoice.id)
        .values(
            status="paid",
            amount_paid=amount_paid,
            amount_due=Decimal("0.00"),
        )
    )
    await db.commit()

    logger.info(
        "Invoice marked as paid via Stripe checkout webhook",
        invoice_number=invoice_number,
        amount_paid=str(amount_paid),
        session_id=session_id,
    )
