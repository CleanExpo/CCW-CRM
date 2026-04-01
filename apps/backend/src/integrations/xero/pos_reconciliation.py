"""
Xero POS Reconciliation Service.

Creates Xero invoices from POS transactions and handles reconciliation:
- Walk-in sales (no order/customer - uses Cash Sales contact)
- Order-based sales (links to existing order customer)
- Automatic invoice creation after payment capture
- Payment reconciliation linking
"""

from datetime import datetime
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.demo_models import Customer, Order, Product
from src.db.pos_models import POSTransaction
from src.integrations.xero.auth import XeroAuth
from src.integrations.xero.client import XeroAPIError, XeroClient
from src.integrations.xero.demo_client import DemoXeroClient


def __get_xero_client(access_token: str, tenant_id: str, demo_mode: bool = False) -> XeroClient | DemoXeroClient:
    """Get appropriate Xero client (local to avoid circular import)."""
    if demo_mode:
        return DemoXeroClient(access_token, tenant_id)
    return XeroClient(access_token, tenant_id)

logger = structlog.get_logger(__name__)


class POSXeroReconciliation:
    """
    Handles Xero reconciliation for POS transactions.

    Creates invoices for:
    1. Walk-in sales (no customer) - Uses generic "Cash Sales" contact
    2. Customer sales - Uses/creates customer contact
    3. Order-based sales - Uses order customer

    Features:
    - Auto-create invoices when payment is captured
    - Link payments to invoices
    - Track reconciliation status
    """

    # Default contact for walk-in cash sales
    CASH_SALES_CONTACT_NAME = "Cash Sales - Walk-in"
    CASH_SALES_CONTACT_EMAIL = "cash.sales@internal.pos"

    def __init__(self, xero_auth: XeroAuth):
        """Initialize POS Xero reconciliation handler.

        Args:
            xero_auth: XeroAuth instance for managing authentication
        """
        self.xero_auth = xero_auth

    async def create_invoice_from_pos_transaction(
        self,
        db: AsyncSession,
        organization_id: UUID,
        pos_transaction_id: UUID,
    ) -> dict:
        """
        Create Xero invoice from a POS transaction.

        Args:
            db: Database session
            organization_id: Organization UUID
            pos_transaction_id: POS transaction UUID

        Returns:
            Dict with invoice creation result

        Raises:
            ValueError: If transaction not found or invalid
            XeroAPIError: If Xero API call fails
        """
        # Get active Xero connection
        connection = await self.xero_auth.get_active_connection(db, organization_id)
        if not connection:
            raise ValueError("No active Xero connection found for organization")

        # Get POS transaction with related data
        stmt = (
            select(POSTransaction)
            .where(POSTransaction.id == pos_transaction_id)
            .options(
                selectinload(POSTransaction.location),
                selectinload(POSTransaction.sales_staff),
            )
        )
        result = await db.execute(stmt)
        pos_txn = result.unique().scalar_one_or_none()

        if not pos_txn:
            raise ValueError(f"POS transaction {pos_transaction_id} not found")

        if pos_txn.payment_status != "captured":
            raise ValueError(
                f"POS transaction must be captured to create invoice (current: {pos_txn.payment_status})"
            )

        if pos_txn.xero_invoice_id:
            logger.info(
                "POS transaction already has Xero invoice",
                pos_transaction_id=str(pos_transaction_id),
                xero_invoice_id=pos_txn.xero_invoice_id,
            )
            return {
                "success": True,
                "already_exists": True,
                "xero_invoice_id": pos_txn.xero_invoice_id,
            }

        # Initialize Xero client
        demo_mode = connection.access_token.startswith("demo_")
        xero_client = _get_xero_client(
            access_token=connection.access_token,
            tenant_id=connection.tenant_id,
            demo_mode=demo_mode,
        )

        try:
            # Step 1: Get or create contact
            if pos_txn.order_id:
                # Order-based sale - use order's customer
                order = await self._get_order_with_customer(db, pos_txn.order_id)
                contact = await self._get_or_create_contact(xero_client, order.customer)
                description = f"Order {order.order_number}"
            else:
                # Walk-in sale - use Cash Sales contact
                contact = await self._get_or_create_cash_sales_contact(xero_client)
                description = f"Walk-in Sale at {pos_txn.location.name}"

            # Step 2: Build line items
            line_items = await self._build_line_items(db, pos_txn, description)

            # Step 3: Create invoice
            invoice = await xero_client.create_invoice(
                contact_id=contact["ContactID"],
                invoice_number=pos_txn.transaction_number,
                line_items=line_items,
                due_date=datetime.now().date(),  # Immediate payment
                reference=self._build_reference(pos_txn),
            )

            # Step 4: Approve invoice (AUTHORISED status)
            approved_invoice = await xero_client.approve_invoice(invoice["InvoiceID"])

            # Step 5: Create payment (since POS is already paid)
            payment = await xero_client.create_payment(
                invoice_id=approved_invoice["InvoiceID"],
                amount=float(pos_txn.amount),
                date=datetime.now().date(),
                reference=pos_txn.payment_gateway_ref or pos_txn.transaction_number,
            )

            # Step 6: Update POS transaction with Xero links
            pos_txn.xero_invoice_id = approved_invoice["InvoiceID"]
            pos_txn.reconciliation_status = "matched"
            pos_txn.reconciled_at = datetime.now()

            logger.info(
                "Created Xero invoice from POS transaction",
                pos_transaction_id=str(pos_transaction_id),
                transaction_number=pos_txn.transaction_number,
                invoice_id=approved_invoice["InvoiceID"],
                invoice_number=approved_invoice["InvoiceNumber"],
                payment_id=payment.get("PaymentID"),
            )

            # Update connection last_synced_at
            connection.last_synced_at = datetime.now()
            await db.commit()

            return {
                "success": True,
                "pos_transaction_id": str(pos_transaction_id),
                "transaction_number": pos_txn.transaction_number,
                "xero_invoice_id": approved_invoice["InvoiceID"],
                "xero_invoice_number": approved_invoice["InvoiceNumber"],
                "xero_payment_id": payment.get("PaymentID"),
                "amount": float(pos_txn.amount),
                "status": "paid",
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

    async def _get_order_with_customer(self, db: AsyncSession, order_id: UUID) -> Order:
        """Get order with customer data."""
        stmt = (
            select(Order)
            .where(Order.id == order_id)
            .options(
                selectinload(Order.customer),
                selectinload(Order.order_items),
            )
        )
        result = await db.execute(stmt)
        order = result.unique().scalar_one_or_none()

        if not order:
            raise ValueError(f"Order {order_id} not found")

        # Load products for line items
        if order.order_items:
            product_ids = [item.product_id for item in order.order_items]
            products_stmt = select(Product).where(Product.id.in_(product_ids))
            products_result = await db.execute(products_stmt)
            products = {p.id: p for p in products_result.scalars().all()}
            for item in order.order_items:
                item.product = products.get(item.product_id)

        return order

    async def _get_or_create_contact(
        self,
        xero_client: XeroClient,
        customer: Customer,
    ) -> dict:
        """Get existing Xero contact or create new one for customer."""
        # Try to find existing contact by email
        existing_contact = await xero_client.get_contact_by_email(customer.email)

        if existing_contact:
            logger.debug(
                "Found existing Xero contact",
                contact_id=existing_contact["ContactID"],
                email=customer.email,
            )
            return existing_contact

        # Create new contact
        address = {
            "street": customer.address or "",
            "city": customer.city or "",
            "state": customer.state or "",
            "postal_code": customer.postcode or "",
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

    async def _get_or_create_cash_sales_contact(self, xero_client: XeroClient) -> dict:
        """Get or create the Cash Sales contact for walk-in sales."""
        existing_contact = await xero_client.get_contact_by_email(self.CASH_SALES_CONTACT_EMAIL)

        if existing_contact:
            return existing_contact

        # Create Cash Sales contact
        contact = await xero_client.create_contact(
            name=self.CASH_SALES_CONTACT_NAME,
            email=self.CASH_SALES_CONTACT_EMAIL,
        )

        logger.info(
            "Created Cash Sales contact for walk-in sales",
            contact_id=contact["ContactID"],
        )

        return contact

    async def _build_line_items(
        self,
        db: AsyncSession,
        pos_txn: POSTransaction,
        description: str,
    ) -> list[dict]:
        """Build line items for Xero invoice."""
        if pos_txn.order_id:
            # Order-based sale - use order line items
            order = await self._get_order_with_customer(db, pos_txn.order_id)
            line_items = []
            for item in order.order_items:
                line_items.append({
                    "description": f"{item.product.name} (SKU: {item.product.sku})",
                    "quantity": float(item.quantity),
                    "unit_amount": float(item.unit_price),
                })
            return line_items
        else:
            # Walk-in sale - single line item with total amount
            return [{
                "description": description,
                "quantity": 1.0,
                "unit_amount": float(pos_txn.amount),
            }]

    def _build_reference(self, pos_txn: POSTransaction) -> str:
        """Build reference string for Xero invoice."""
        parts = [pos_txn.transaction_number]

        if pos_txn.location:
            parts.append(f"Location: {pos_txn.location.name}")

        if pos_txn.payment_method:
            parts.append(f"Payment: {pos_txn.payment_method.upper()}")

        if pos_txn.payment_gateway_ref:
            parts.append(f"Gateway Ref: {pos_txn.payment_gateway_ref}")

        return " | ".join(parts)

    async def bulk_create_invoices(
        self,
        db: AsyncSession,
        organization_id: UUID,
        max_transactions: int = 100,
    ) -> dict:
        """
        Bulk create Xero invoices for captured POS transactions.

        Args:
            db: Database session
            organization_id: Organization UUID
            max_transactions: Maximum transactions to process

        Returns:
            Dict with processing statistics
        """
        # Get active Xero connection
        connection = await self.xero_auth.get_active_connection(db, organization_id)
        if not connection:
            raise ValueError("No active Xero connection found for organization")

        # Find captured transactions without Xero invoice
        stmt = (
            select(POSTransaction)
            .where(
                POSTransaction.payment_status == "captured",
                POSTransaction.xero_invoice_id.is_(None),
            )
            .limit(max_transactions)
        )
        result = await db.execute(stmt)
        transactions = result.scalars().all()

        logger.info(
            "Starting bulk Xero invoice creation",
            organization_id=str(organization_id),
            total_transactions=len(transactions),
        )

        created = 0
        failed = 0
        errors = []

        for txn in transactions:
            try:
                await self.create_invoice_from_pos_transaction(
                    db, organization_id, txn.id
                )
                created += 1
            except Exception as e:
                failed += 1
                errors.append({
                    "transaction_id": str(txn.id),
                    "transaction_number": txn.transaction_number,
                    "error": str(e),
                })
                logger.error(
                    "Failed to create Xero invoice",
                    transaction_id=str(txn.id),
                    transaction_number=txn.transaction_number,
                    error=str(e),
                )

        logger.info(
            "Bulk Xero invoice creation completed",
            created=created,
            failed=failed,
            total=len(transactions),
        )

        return {
            "total": len(transactions),
            "created": created,
            "failed": failed,
            "errors": errors if errors else None,
        }
