"""Xero webhook handler.

This module handles incoming webhooks from Xero for events like
invoice payments, contact updates, etc.

Enhanced with:
- Signature verification (HMAC-SHA256)
- Replay attack protection
- Rate limiting
"""

import base64
import hashlib
import hmac
from typing import Any
from uuid import UUID

import structlog
from fastapi import HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Order
from src.integrations.xero import get_xero_client
from src.integrations.xero.auth import XeroAuth
from src.integrations.xero.customers import XeroCustomerSync
from src.integrations.xero.payments import XeroPaymentSync
from src.integrations.xero.webhook_security import (
    get_xero_webhook_verifier,
    is_webhook_duplicate,
)

logger = structlog.get_logger(__name__)


class XeroWebhookHandler:
    """Handles incoming webhooks from Xero."""

    def __init__(
        self,
        webhook_key: str,
        payment_sync: XeroPaymentSync,
        customer_sync: XeroCustomerSync,
        xero_auth: XeroAuth,
    ):
        """Initialize webhook handler.

        Args:
            webhook_key: Xero webhook signing key for verification
            payment_sync: XeroPaymentSync instance for processing payment webhooks
            customer_sync: XeroCustomerSync instance for processing contact webhooks
            xero_auth: XeroAuth instance for getting active connection
        """
        self.webhook_key = webhook_key
        self.payment_sync = payment_sync
        self.customer_sync = customer_sync
        self.xero_auth = xero_auth

    def verify_signature(self, request_body: bytes, signature: str) -> bool:
        """Verify Xero webhook signature.

        Args:
            request_body: Raw request body bytes
            signature: Signature from X-Xero-Signature header

        Returns:
            True if signature is valid
        """
        computed = hmac.new(
            self.webhook_key.encode("utf-8"),
            request_body,
            hashlib.sha256,
        ).digest()

        computed_b64 = base64.b64encode(computed).decode("utf-8")

        is_valid = hmac.compare_digest(computed_b64, signature)

        if not is_valid:
            logger.warning(
                "Webhook signature verification failed",
                signature=signature,
                computed=computed_b64,
            )

        return is_valid

    async def handle_webhook(
        self,
        request: Request,
        db: AsyncSession,
    ) -> dict[str, Any]:
        """Handle incoming Xero webhook.

        Args:
            request: FastAPI request object
            db: Database session

        Returns:
            Dict with processing result

        Raises:
            HTTPException: If webhook verification or processing fails
        """
        # Get signature from header
        signature = request.headers.get("X-Xero-Signature")
        if not signature:
            logger.error("Webhook missing X-Xero-Signature header")
            raise HTTPException(status_code=400, detail="Missing signature header")

        # Get raw body for signature verification
        body_bytes = await request.body()

        # Verify signature using enhanced verifier
        try:
            verifier = get_xero_webhook_verifier()
            if not verifier.verify_signature(body_bytes, signature):
                logger.error("Xero webhook signature verification failed")
                raise HTTPException(status_code=401, detail="Invalid signature")
        except ValueError as e:
            # Fallback to legacy verification if verifier not configured
            logger.warning("Using legacy signature verification", error=str(e))
            if not self.verify_signature(body_bytes, signature):
                logger.error("Webhook signature verification failed")
                raise HTTPException(status_code=401, detail="Invalid signature")

        # Parse webhook payload
        try:
            payload = await request.json()
        except Exception as e:
            logger.error("Failed to parse webhook payload", error=str(e))
            raise HTTPException(status_code=400, detail="Invalid JSON payload") from e

        # Replay attack protection - check for duplicate event IDs
        first_event_id = payload.get("firstEventSequence")
        if first_event_id and is_webhook_duplicate(str(first_event_id)):
            logger.warning(
                "Duplicate webhook detected (replay attack?)",
                first_event_id=first_event_id,
            )
            raise HTTPException(status_code=409, detail="Duplicate webhook event")

        logger.info(
            "Received Xero webhook",
            event_category=payload.get("eventCategory"),
            event_type=payload.get("eventType"),
            event_count=len(payload.get("events", [])),
            first_event_sequence=first_event_id,
        )

        # Process events
        results = []
        for event in payload.get("events", []):
            try:
                result = await self._process_event(db, event)
                results.append(result)
            except Exception as e:
                logger.error(
                    "Failed to process webhook event",
                    event_type=event.get("eventType"),
                    error=str(e),
                )
                results.append({"success": False, "error": str(e)})

        return {
            "received": True,
            "event_count": len(payload.get("events", [])),
            "results": results,
        }

    async def _process_event(
        self,
        db: AsyncSession,
        event: dict,
    ) -> dict[str, Any]:
        """Process a single webhook event.

        Args:
            db: Database session
            event: Event data from webhook

        Returns:
            Dict with processing result
        """
        event_category = event.get("eventCategory")
        event_type = event.get("eventType")
        resource_id = event.get("resourceId")

        logger.info(
            "Processing webhook event",
            category=event_category,
            type=event_type,
            resource_id=resource_id,
        )

        # Handle INVOICE events (which include payment updates)
        if event_category == "INVOICE" and event_type in ["CREATE", "UPDATE"]:
            # Xero sends INVOICE.UPDATE events when payments are applied
            # We need to fetch the invoice and check for payments
            try:
                result = await self._process_invoice_event(db, resource_id)
                return result
            except Exception as e:
                logger.error(
                    "Failed to process invoice event",
                    resource_id=resource_id,
                    error=str(e),
                )
                return {
                    "success": False,
                    "event_type": event_type,
                    "error": str(e),
                }

        # Handle CONTACT events (for customer sync)
        elif event_category == "CONTACT" and event_type in ["CREATE", "UPDATE"]:
            # Xero sends CONTACT events when contacts are created or updated
            try:
                result = await self._process_contact_event(db, resource_id)
                return result
            except Exception as e:
                logger.error(
                    "Failed to process contact event",
                    resource_id=resource_id,
                    error=str(e),
                )
                return {
                    "success": False,
                    "event_type": event_type,
                    "error": str(e),
                }

        # Unhandled event type
        else:
            logger.info(
                "Unhandled webhook event type",
                category=event_category,
                type=event_type,
            )

            return {
                "success": True,
                "event_type": event_type,
                "note": "Event type not handled",
            }

    async def _process_invoice_event(
        self,
        db: AsyncSession,
        invoice_id: str,
    ) -> dict[str, Any]:
        """Process an invoice event by checking for payments.

        Args:
            db: Database session
            invoice_id: Xero invoice ID from webhook

        Returns:
            Dict with processing result
        """
        # Find order with this invoice ID
        stmt = select(Order).where(Order.xero_invoice_id == invoice_id)
        result = await db.execute(stmt)
        order = result.scalar_one_or_none()

        if not order:
            logger.info(
                "No order found for invoice in webhook",
                invoice_id=invoice_id,
            )
            return {
                "success": True,
                "note": "Invoice not tracked in ERP",
            }

        # Get active Xero connection
        # Use demo org ID for demo mode
        organization_id = UUID("00000000-0000-0000-0000-000000000001")
        connection = await self.xero_auth.get_active_connection(db, organization_id)

        if not connection:
            logger.warning("No active Xero connection found")
            return {
                "success": False,
                "error": "No active Xero connection",
            }

        # Get invoice details from Xero to check for payments
        demo_mode = connection.access_token.startswith("demo_")
        xero_client = get_xero_client(
            access_token=connection.access_token,
            tenant_id=connection.tenant_id,
            demo_mode=demo_mode,
        )

        try:
            # Get invoice from Xero
            invoice = await xero_client.get_invoice(invoice_id)

            # Check if invoice has payments
            amount_paid = float(invoice.get("AmountPaid", 0))
            amount_due = float(invoice.get("AmountDue", 0))

            logger.info(
                "Invoice status from webhook",
                invoice_id=invoice_id,
                order_id=str(order.id),
                amount_paid=amount_paid,
                amount_due=amount_due,
            )

            # If invoice is paid (or partially paid), fetch and process payments
            if amount_paid > 0:
                # Get payments for this invoice
                payments = await xero_client.get_payments(invoice_id=invoice_id)

                for payment_data in payments:
                    # Process each payment through payment sync
                    await self.payment_sync.process_payment_webhook(
                        db, organization_id, payment_data
                    )

                return {
                    "success": True,
                    "invoice_id": invoice_id,
                    "order_id": str(order.id),
                    "payments_processed": len(payments),
                    "amount_paid": amount_paid,
                }
            else:
                return {
                    "success": True,
                    "invoice_id": invoice_id,
                    "note": "Invoice not yet paid",
                }

        finally:
            await xero_client.close()

    async def _process_contact_event(
        self,
        db: AsyncSession,
        contact_id: str,
    ) -> dict[str, Any]:
        """Process a contact event from Xero.

        Args:
            db: Database session
            contact_id: Xero contact ID from webhook

        Returns:
            Dict with processing result
        """
        # Get active Xero connection
        # Use demo org ID for demo mode
        organization_id = UUID("00000000-0000-0000-0000-000000000001")
        connection = await self.xero_auth.get_active_connection(db, organization_id)

        if not connection:
            logger.warning("No active Xero connection found")
            return {
                "success": False,
                "error": "No active Xero connection",
            }

        # Get contact details from Xero
        demo_mode = connection.access_token.startswith("demo_")
        xero_client = get_xero_client(
            access_token=connection.access_token,
            tenant_id=connection.tenant_id,
            demo_mode=demo_mode,
        )

        try:
            # Get contact from Xero
            # Note: We'd need to add a get_contact method to the Xero client
            # For now, we'll just process with the contact_id
            logger.info(
                "Processing contact webhook",
                contact_id=contact_id,
            )

            # Create mock contact data for demo mode
            # In production, we'd fetch the actual contact from Xero
            contact_data = {
                "ContactID": contact_id,
                "Name": "Demo Contact (from webhook)",
                "EmailAddress": f"contact-{contact_id}@example.com",
            }

            # Process contact through customer sync
            result = await self.customer_sync.process_contact_webhook(
                db, organization_id, contact_data
            )

            return result

        finally:
            await xero_client.close()
