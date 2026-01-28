"""POS-Xero reconciliation service.

This module handles automatic reconciliation between POS transactions,
bank feeds, and Xero invoices/payments. Key features:
- Auto-create Xero invoices from POS transactions
- Auto-reconcile when bank feed matches POS transaction
- Save accounts team 10+ hours/week on manual reconciliation
"""

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.demo_models import Customer, Order, OrderItem, OrderStatus, Product
from src.db.pos_models import BankFeed, POSTransaction
from src.integrations.xero.auth import XeroAuth
from src.integrations.xero.client import XeroAPIError
from src.integrations.xero import get_xero_client

logger = structlog.get_logger(__name__)


class POSXeroReconciliation:
    """Handles reconciliation between POS transactions, bank feeds, and Xero."""

    def __init__(self, xero_auth: XeroAuth):
        """Initialize POS-Xero reconciliation service.

        Args:
            xero_auth: XeroAuth instance for managing authentication
        """
        self.xero_auth = xero_auth

    async def create_xero_invoice_from_pos_transaction(
        self,
        db: AsyncSession,
        organization_id: UUID,
        pos_transaction_id: UUID,
    ) -> dict:
        """Create Xero invoice from POS transaction.

        This is called when a POS transaction is captured successfully.
        Creates a corresponding invoice in Xero and links it to the transaction.

        Args:
            db: Database session
            organization_id: Organization UUID
            pos_transaction_id: POS transaction UUID

        Returns:
            Dict with invoice details

        Raises:
            ValueError: If transaction not found or invalid
            XeroAPIError: If Xero API call fails
        """
        # Get active Xero connection
        connection = await self.xero_auth.get_active_connection(db, organization_id)
        if not connection:
            raise ValueError("No active Xero connection found for organization")

        # Get POS transaction with order eagerly loaded
        stmt = (
            select(POSTransaction)
            .where(POSTransaction.id == pos_transaction_id)
            .options(selectinload(POSTransaction.order))
        )
        result = await db.execute(stmt)
        pos_txn = result.scalar_one_or_none()

        if not pos_txn:
            raise ValueError(f"POS transaction {pos_transaction_id} not found")

        if pos_txn.payment_status != "captured":
            raise ValueError(
                f"Cannot create invoice for transaction with status: {pos_txn.payment_status}"
            )

        if pos_txn.xero_invoice_id:
            logger.info(
                "POS transaction already has Xero invoice",
                pos_transaction_id=str(pos_transaction_id),
                xero_invoice_id=pos_txn.xero_invoice_id,
            )
            return {
                "already_exists": True,
                "xero_invoice_id": pos_txn.xero_invoice_id,
            }

        # Get or create order for this transaction
        if not pos_txn.order_id:
            # Walk-in sale without pre-existing order - create one
            order = await self._create_order_from_pos_transaction(db, pos_txn)
            pos_txn.order_id = order.id
            await db.flush()
        else:
            # Load existing order with items
            stmt = (
                select(Order)
                .where(Order.id == pos_txn.order_id)
                .options(
                    selectinload(Order.customer),
                    selectinload(Order.order_items),
                )
            )
            result = await db.execute(stmt)
            order = result.scalar_one_or_none()

            if not order:
                raise ValueError(f"Order {pos_txn.order_id} not found")

            # Load products for order items
            if order.order_items:
                product_ids = [item.product_id for item in order.order_items]
                products_stmt = select(Product).where(Product.id.in_(product_ids))
                products_result = await db.execute(products_stmt)
                products = {p.id: p for p in products_result.scalars().all()}
                for item in order.order_items:
                    item.product = products.get(item.product_id)

        # Initialize Xero client
        demo_mode = connection.access_token.startswith("demo_")
        xero_client = get_xero_client(
            access_token=connection.access_token,
            tenant_id=connection.tenant_id,
            demo_mode=demo_mode,
        )

        try:
            # Step 1: Get or create Xero contact
            contact = await self._get_or_create_contact(xero_client, order.customer)

            # Step 2: Create invoice
            line_items = []
            for item in order.order_items:
                line_items.append(
                    {
                        "description": f"{item.product.name} (SKU: {item.product.sku})",
                        "quantity": float(item.quantity),
                        "unit_amount": float(item.unit_price),
                    }
                )

            invoice = await xero_client.create_invoice(
                contact_id=contact["ContactID"],
                invoice_number=pos_txn.transaction_number,
                line_items=line_items,
                due_date=datetime.now(UTC).date(),  # Due immediately for POS
                reference=f"POS {pos_txn.transaction_number} - {pos_txn.payment_method}",
            )

            # Step 3: Approve invoice
            approved_invoice = await xero_client.approve_invoice(invoice["InvoiceID"])

            # Step 4: Update POS transaction and order
            pos_txn.xero_invoice_id = approved_invoice["InvoiceID"]
            order.xero_invoice_id = approved_invoice["InvoiceID"]
            order.xero_synced_at = datetime.now(UTC)
            order.xero_sync_status = "synced"

            connection.last_synced_at = datetime.now(UTC)
            await db.commit()

            logger.info(
                "Created Xero invoice from POS transaction",
                pos_transaction_id=str(pos_transaction_id),
                transaction_number=pos_txn.transaction_number,
                xero_invoice_id=approved_invoice["InvoiceID"],
                total=approved_invoice["Total"],
            )

            return {
                "success": True,
                "pos_transaction_id": str(pos_transaction_id),
                "transaction_number": pos_txn.transaction_number,
                "xero_invoice_id": approved_invoice["InvoiceID"],
                "xero_invoice_number": approved_invoice["InvoiceNumber"],
                "total": float(approved_invoice["Total"]),
            }

        except XeroAPIError as e:
            logger.error(
                "Failed to create Xero invoice from POS transaction",
                pos_transaction_id=str(pos_transaction_id),
                error=str(e),
                status_code=e.status_code,
            )
            raise

        finally:
            await xero_client.close()

    async def create_xero_payment_and_reconcile(
        self,
        db: AsyncSession,
        organization_id: UUID,
        pos_transaction_id: UUID,
        bank_feed_id: UUID,
    ) -> dict:
        """Create Xero payment and reconcile with bank feed.

        This is called when a bank feed transaction matches a POS transaction.
        Creates payment in Xero and marks both transactions as reconciled.

        Args:
            db: Database session
            organization_id: Organization UUID
            pos_transaction_id: POS transaction UUID
            bank_feed_id: Bank feed transaction UUID

        Returns:
            Dict with reconciliation details

        Raises:
            ValueError: If reconciliation fails validation
            XeroAPIError: If Xero API call fails
        """
        # Get active Xero connection
        connection = await self.xero_auth.get_active_connection(db, organization_id)
        if not connection:
            raise ValueError("No active Xero connection found for organization")

        # Get POS transaction
        stmt = select(POSTransaction).where(POSTransaction.id == pos_transaction_id)
        result = await db.execute(stmt)
        pos_txn = result.scalar_one_or_none()

        if not pos_txn:
            raise ValueError(f"POS transaction {pos_transaction_id} not found")

        # Get bank feed
        stmt = select(BankFeed).where(BankFeed.id == bank_feed_id)
        result = await db.execute(stmt)
        bank_feed = result.scalar_one_or_none()

        if not bank_feed:
            raise ValueError(f"Bank feed {bank_feed_id} not found")

        # Validate amounts match (within 10 cent tolerance)
        amount_diff = abs(float(pos_txn.amount) - float(bank_feed.credit or 0))
        if amount_diff > 0.10:
            raise ValueError(
                f"Amount mismatch: POS ${pos_txn.amount}, Bank ${bank_feed.credit}"
            )

        # Ensure invoice exists
        if not pos_txn.xero_invoice_id:
            raise ValueError("POS transaction has no Xero invoice. Create invoice first.")

        # Initialize Xero client
        demo_mode = connection.access_token.startswith("demo_")
        xero_client = get_xero_client(
            access_token=connection.access_token,
            tenant_id=connection.tenant_id,
            demo_mode=demo_mode,
        )

        try:
            # Create payment in Xero
            payment = await xero_client.create_payment(
                invoice_id=pos_txn.xero_invoice_id,
                account_code="200",  # Bank account code (should be configurable)
                amount=float(pos_txn.amount),
                date=bank_feed.transaction_date,
                reference=bank_feed.reference or pos_txn.transaction_number,
            )

            # Update POS transaction
            pos_txn.bank_statement_ref = bank_feed.reference
            pos_txn.reconciliation_status = "matched"
            pos_txn.reconciled_at = datetime.now(UTC)

            # Update bank feed
            bank_feed.matched_pos_transaction_id = pos_transaction_id
            bank_feed.match_confidence = Decimal("1.00")  # Perfect match
            bank_feed.match_status = "auto_matched"
            bank_feed.matched_at = datetime.now(UTC)

            connection.last_synced_at = datetime.now(UTC)
            await db.commit()

            logger.info(
                "Created Xero payment and reconciled with bank feed",
                pos_transaction_id=str(pos_transaction_id),
                bank_feed_id=str(bank_feed_id),
                xero_payment_id=payment["PaymentID"],
                amount=pos_txn.amount,
            )

            return {
                "success": True,
                "pos_transaction_id": str(pos_transaction_id),
                "bank_feed_id": str(bank_feed_id),
                "xero_payment_id": payment["PaymentID"],
                "amount": float(pos_txn.amount),
                "reconciliation_status": "matched",
            }

        except XeroAPIError as e:
            logger.error(
                "Failed to create Xero payment",
                pos_transaction_id=str(pos_transaction_id),
                bank_feed_id=str(bank_feed_id),
                error=str(e),
                status_code=e.status_code,
            )
            raise

        finally:
            await xero_client.close()

    async def auto_reconcile_unmatched_transactions(
        self,
        db: AsyncSession,
        organization_id: UUID,
        days_back: int = 7,
    ) -> dict:
        """Auto-reconcile unmatched POS transactions with bank feeds.

        Runs matching algorithm to find POS transactions and bank feeds
        that likely match, then creates Xero payments for high-confidence matches.

        Args:
            db: Database session
            organization_id: Organization UUID
            days_back: Number of days to look back

        Returns:
            Dict with reconciliation statistics
        """
        from datetime import timedelta

        cutoff_date = datetime.now(UTC).date() - timedelta(days=days_back)

        # Get unmatched POS transactions (captured, have invoice, not reconciled)
        pos_stmt = (
            select(POSTransaction)
            .where(
                POSTransaction.payment_status == "captured",
                POSTransaction.xero_invoice_id.isnot(None),
                POSTransaction.reconciliation_status == "pending",
                POSTransaction.created_at >= cutoff_date,
            )
        )
        pos_result = await db.execute(pos_stmt)
        pos_transactions = pos_result.scalars().all()

        # Get unmatched bank feeds (credits only, not matched)
        bank_stmt = (
            select(BankFeed)
            .where(
                BankFeed.match_status == "pending",
                BankFeed.credit.isnot(None),
                BankFeed.transaction_date >= cutoff_date,
            )
        )
        bank_result = await db.execute(bank_stmt)
        bank_feeds = bank_result.scalars().all()

        logger.info(
            "Starting auto-reconciliation",
            pos_transactions=len(pos_transactions),
            bank_feeds=len(bank_feeds),
            days_back=days_back,
        )

        matched = 0
        suggested = 0
        errors = []

        # Match transactions
        for pos_txn in pos_transactions:
            for bank_feed in bank_feeds:
                # Skip if already matched
                if bank_feed.match_status != "pending":
                    continue

                # Calculate match confidence
                confidence = self._calculate_match_confidence(pos_txn, bank_feed)

                # Auto-match if confidence >= 80%
                if confidence >= 0.8:
                    try:
                        await self.create_xero_payment_and_reconcile(
                            db, organization_id, pos_txn.id, bank_feed.id
                        )
                        matched += 1
                        break  # Move to next POS transaction
                    except Exception as e:
                        errors.append(
                            {
                                "pos_transaction_id": str(pos_txn.id),
                                "bank_feed_id": str(bank_feed.id),
                                "error": str(e),
                            }
                        )
                        logger.error(
                            "Failed to auto-reconcile",
                            pos_txn_id=str(pos_txn.id),
                            bank_feed_id=str(bank_feed.id),
                            error=str(e),
                        )

                # Suggest if confidence >= 60%
                elif confidence >= 0.6:
                    # Update bank feed with suggestion
                    bank_feed.matched_pos_transaction_id = pos_txn.id
                    bank_feed.match_confidence = Decimal(str(confidence))
                    bank_feed.match_status = "suggested"
                    suggested += 1

        await db.commit()

        logger.info(
            "Auto-reconciliation completed",
            matched=matched,
            suggested=suggested,
            errors=len(errors),
        )

        return {
            "total_pos_transactions": len(pos_transactions),
            "total_bank_feeds": len(bank_feeds),
            "auto_matched": matched,
            "suggested_matches": suggested,
            "errors": errors if errors else None,
        }

    def _calculate_match_confidence(
        self,
        pos_txn: POSTransaction,
        bank_feed: BankFeed,
    ) -> float:
        """Calculate confidence score for POS transaction and bank feed match.

        Args:
            pos_txn: POS transaction
            bank_feed: Bank feed transaction

        Returns:
            Confidence score between 0.0 and 1.0
        """
        confidence = 0.0

        # Amount match (±10 cents tolerance)
        amount_diff = abs(float(pos_txn.amount) - float(bank_feed.credit or 0))
        if amount_diff == 0:
            confidence += 0.5  # Exact match
        elif amount_diff <= 0.10:
            confidence += 0.3  # Close match

        # Date match (±3 days tolerance)
        from datetime import timedelta

        pos_date = pos_txn.created_at.date()
        bank_date = bank_feed.transaction_date

        date_diff = abs((pos_date - bank_date).days)
        if date_diff == 0:
            confidence += 0.3  # Same day
        elif date_diff <= 1:
            confidence += 0.2  # ±1 day
        elif date_diff <= 3:
            confidence += 0.1  # ±3 days

        # Reference match
        if bank_feed.reference and pos_txn.transaction_number:
            if pos_txn.transaction_number in bank_feed.reference:
                confidence += 0.2

        return min(confidence, 1.0)

    async def _create_order_from_pos_transaction(
        self,
        db: AsyncSession,
        pos_txn: POSTransaction,
    ) -> Order:
        """Create an order from a walk-in POS transaction.

        Args:
            db: Database session
            pos_txn: POS transaction

        Returns:
            Created Order instance
        """
        # For walk-in sales, we need a customer
        # If no customer_id, create a generic "Walk-in Customer"
        customer_id = None

        if not customer_id:
            # Check if "Walk-in Customer" exists
            stmt = select(Customer).where(Customer.email == "walkin@pos.internal")
            result = await db.execute(stmt)
            customer = result.scalar_one_or_none()

            if not customer:
                # Create walk-in customer
                customer = Customer(
                    customer_number="WALKIN-001",
                    company_name="Walk-in Customer",
                    contact_name="Walk-in",
                    email="walkin@pos.internal",
                    phone="N/A",
                    address="N/A",
                    city=pos_txn.resolved_location_code or "Unknown",
                    state="Queensland",
                    postal_code="0000",
                    country="Australia",
                    is_active=True,
                )
                db.add(customer)
                await db.flush()

            customer_id = customer.id

        # Create order
        order = Order(
            order_number=f"POS-{pos_txn.transaction_number}",
            customer_id=customer_id,
            order_date=pos_txn.created_at,
            status=OrderStatus.CONFIRMED,
            notes=f"POS walk-in sale - {pos_txn.payment_method}",
            total=pos_txn.amount,
        )
        db.add(order)
        await db.flush()

        # Note: For walk-in sales, line items would typically be entered at POS
        # This is a simplified version - in production, POS would send line items

        return order

    async def _get_or_create_contact(
        self,
        xero_client,
        customer: Customer,
    ) -> dict:
        """Get existing Xero contact or create new one.

        Args:
            xero_client: XeroClient instance
            customer: Customer model instance

        Returns:
            Xero contact data
        """
        # Try to find existing contact by email
        existing_contact = await xero_client.get_contact_by_email(customer.email)

        if existing_contact:
            return existing_contact

        # Create new contact
        address = {
            "street": customer.address or "",
            "city": customer.city or "",
            "state": customer.state or "",
            "postal_code": customer.postal_code or "",
            "country": "Australia",
        }

        contact = await xero_client.create_contact(
            name=customer.company_name,
            email=customer.email,
            phone=customer.phone,
            address=address,
        )

        logger.info(
            "Created new Xero contact",
            contact_id=contact["ContactID"],
            name=customer.company_name,
        )

        return contact
