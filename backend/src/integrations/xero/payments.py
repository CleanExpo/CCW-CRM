"""Xero payment synchronization logic.

This module handles syncing payments from Xero back to the ERP,
updating order statuses when invoices are paid.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Order, OrderStatus
from src.db.xero_models import Payment
from src.integrations.xero.auth import XeroAuth
from src.integrations.xero.client import XeroClient

logger = structlog.get_logger(__name__)


class XeroPaymentSync:
    """Handles synchronization of payments from Xero to ERP."""

    def __init__(self, xero_auth: XeroAuth):
        """Initialize payment sync handler.

        Args:
            xero_auth: XeroAuth instance for managing authentication
        """
        self.xero_auth = xero_auth

    async def sync_payment_for_order(
        self,
        db: AsyncSession,
        organization_id: UUID,
        order_id: UUID,
    ) -> dict | None:
        """Check Xero for payments on an order's invoice and sync.

        Args:
            db: Database session
            organization_id: Organization UUID
            order_id: Order UUID to check

        Returns:
            Payment data if found, None otherwise

        Raises:
            ValueError: If order not found or no Xero invoice
        """
        # Get active Xero connection
        connection = await self.xero_auth.get_active_connection(db, organization_id)
        if not connection:
            raise ValueError("No active Xero connection found for organization")

        # Get order
        stmt = select(Order).where(Order.id == order_id)
        result = await db.execute(stmt)
        order = result.scalar_one_or_none()

        if not order:
            raise ValueError(f"Order {order_id} not found")

        if not order.xero_invoice_id:
            raise ValueError(f"Order {order_id} has no Xero invoice ID")

        # Initialize Xero client
        from src.integrations.xero import get_xero_client
        demo_mode = connection.access_token.startswith("demo_")
        xero_client = get_xero_client(
            access_token=connection.access_token,
            tenant_id=connection.tenant_id,
            demo_mode=demo_mode,
        )

        try:
            # Get payments for this invoice from Xero
            payments = await xero_client.get_payments(invoice_id=order.xero_invoice_id)

            if not payments:
                logger.info(
                    "No payments found for order",
                    order_id=str(order_id),
                    invoice_id=order.xero_invoice_id,
                )
                return None

            # Process each payment
            for payment_data in payments:
                # Check if already exists
                payment_id = payment_data.get("PaymentID")
                stmt = select(Payment).where(Payment.xero_payment_id == payment_id)
                result = await db.execute(stmt)
                existing = result.scalar_one_or_none()

                if existing:
                    continue

                # Create new payment record
                await self._create_payment_record(db, order, payment_data)

                # Update order status
                if order.status in [OrderStatus.CONFIRMED, OrderStatus.PROCESSING]:
                    order.status = OrderStatus.DELIVERED

            await db.commit()

            logger.info(
                "Synced payments for order",
                order_id=str(order_id),
                payment_count=len(payments),
            )

            return {
                "order_id": str(order_id),
                "payments_found": len(payments),
            }

        finally:
            await xero_client.close()

    async def process_payment_webhook(
        self,
        db: AsyncSession,
        organization_id: UUID,
        xero_payment_data: dict,
    ) -> dict:
        """Process a payment webhook from Xero.

        Args:
            db: Database session
            organization_id: Organization UUID
            xero_payment_data: Payment data from Xero webhook

        Returns:
            Dict with processing result

        Raises:
            ValueError: If payment processing fails
        """
        payment_id = xero_payment_data.get("PaymentID")
        invoice_id = xero_payment_data.get("Invoice", {}).get("InvoiceID")
        amount = float(xero_payment_data.get("Amount", 0))
        xero_payment_data.get("Date")

        logger.info(
            "Processing payment webhook",
            payment_id=payment_id,
            invoice_id=invoice_id,
            amount=amount,
        )

        if not payment_id or not invoice_id:
            raise ValueError("Payment webhook missing required fields")

        # Check if payment already exists
        stmt = select(Payment).where(Payment.xero_payment_id == payment_id)
        result = await db.execute(stmt)
        existing_payment = result.scalar_one_or_none()

        if existing_payment:
            logger.info(
                "Payment already processed",
                payment_id=payment_id,
            )
            return {
                "success": True,
                "already_processed": True,
                "payment_id": payment_id,
            }

        # Find order by xero_invoice_id
        stmt = select(Order).where(Order.xero_invoice_id == invoice_id)
        result = await db.execute(stmt)
        order = result.scalar_one_or_none()

        if not order:
            logger.warning(
                "No order found for Xero invoice",
                invoice_id=invoice_id,
                payment_id=payment_id,
            )
            return {
                "success": False,
                "error": f"No order found with xero_invoice_id={invoice_id}",
            }

        # Create payment record
        await self._create_payment_record(db, order, xero_payment_data)

        # Update order status to indicate payment received
        old_status = order.status
        if order.status in [OrderStatus.CONFIRMED, OrderStatus.PROCESSING]:
            order.status = OrderStatus.DELIVERED  # Consider order delivered once paid
            logger.info(
                "Updated order status after payment",
                order_id=str(order.id),
                old_status=old_status.value,
                new_status=order.status.value,
            )

        await db.commit()

        logger.info(
            "Successfully processed payment webhook",
            payment_id=payment_id,
            order_id=str(order.id),
            amount=amount,
        )

        return {
            "success": True,
            "payment_id": payment_id,
            "order_id": str(order.id),
            "order_number": order.order_number,
            "amount": amount,
            "old_status": old_status.value,
            "new_status": order.status.value,
        }

    async def _create_payment_record(
        self,
        db: AsyncSession,
        order: Order,
        xero_payment_data: dict,
    ) -> Payment:
        """Create a payment record in the database.

        Args:
            db: Database session
            order: Order model instance
            xero_payment_data: Payment data from Xero

        Returns:
            Created Payment instance
        """
        payment_date_str = xero_payment_data.get("Date")
        payment_date = (
            datetime.fromisoformat(payment_date_str.replace("Z", "+00:00"))
            if payment_date_str
            else datetime.now(UTC)
        )

        payment = Payment(
            order_id=order.id,
            xero_payment_id=xero_payment_data["PaymentID"],
            amount=float(xero_payment_data.get("Amount", 0)),
            payment_date=payment_date,
            payment_method="other",  # Xero doesn't provide payment method in webhook
            reference=xero_payment_data.get("Reference"),
        )

        db.add(payment)

        logger.info(
            "Created payment record",
            payment_id=payment.xero_payment_id,
            order_id=str(order.id),
            amount=payment.amount,
        )

        return payment

    async def poll_recent_payments(
        self,
        db: AsyncSession,
        organization_id: UUID,
        hours_back: int = 24,
    ) -> dict:
        """Poll Xero for recent payments and sync them.

        This is a fallback mechanism when webhooks are not available or fail.

        Args:
            db: Database session
            organization_id: Organization UUID
            hours_back: Number of hours to look back for payments

        Returns:
            Dict with sync statistics

        Raises:
            ValueError: If no active Xero connection
        """
        # Get active Xero connection
        connection = await self.xero_auth.get_active_connection(db, organization_id)
        if not connection:
            raise ValueError("No active Xero connection found for organization")

        xero_client = XeroClient(
            access_token=connection.access_token,
            tenant_id=connection.tenant_id,
        )

        try:
            # Get recent payments from Xero
            modified_after = datetime.now(UTC) - timedelta(hours=hours_back)
            payments = await xero_client.get_payments(
                modified_after=modified_after.date()
            )

            logger.info(
                "Retrieved recent payments from Xero",
                count=len(payments),
                hours_back=hours_back,
            )

            synced = 0
            skipped = 0

            for payment_data in payments:
                try:
                    result = await self.process_payment_webhook(
                        db, organization_id, payment_data
                    )

                    if result.get("success"):
                        if not result.get("already_processed"):
                            synced += 1
                        else:
                            skipped += 1

                except Exception as e:
                    logger.error(
                        "Failed to process payment from polling",
                        payment_id=payment_data.get("PaymentID"),
                        error=str(e),
                    )

            await db.commit()

            logger.info(
                "Payment polling completed",
                synced=synced,
                skipped=skipped,
                total=len(payments),
            )

            return {
                "total": len(payments),
                "synced": synced,
                "skipped": skipped,
            }

        finally:
            await xero_client.close()
