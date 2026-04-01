"""Xero invoice synchronization logic.

This module handles syncing orders from the ERP to Xero as invoices,
including contact creation and line item mapping.
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.db.demo_models import Customer, Order, OrderItem, OrderStatus
from src.db.xero_models import XeroConnection
from src.integrations.xero.auth import XeroAuth
from src.integrations.xero.client import XeroAPIError, XeroClient
from src.integrations.xero import get_xero_client

logger = structlog.get_logger(__name__)


class XeroInvoiceSync:
    """Handles synchronization of orders to Xero invoices."""

    def __init__(self, xero_auth: XeroAuth):
        """Initialize invoice sync handler.

        Args:
            xero_auth: XeroAuth instance for managing authentication
        """
        self.xero_auth = xero_auth

    async def sync_order_to_invoice(
        self,
        db: AsyncSession,
        organization_id: UUID,
        order_id: UUID,
    ) -> dict:
        """Sync an order to Xero as an invoice.

        Args:
            db: Database session
            organization_id: Organization UUID
            order_id: Order UUID to sync

        Returns:
            Dict with sync result and invoice details

        Raises:
            ValueError: If order not found or invalid
            XeroAPIError: If Xero API call fails
        """
        # Get active Xero connection
        connection = await self.xero_auth.get_active_connection(db, organization_id)
        if not connection:
            raise ValueError("No active Xero connection found for organization")

        # Get order with customer and line items eagerly loaded
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

        if order and order.order_items:
            # Manually load products for order items
            from src.db.demo_models import Product
            product_ids = [item.product_id for item in order.order_items]
            products_stmt = select(Product).where(Product.id.in_(product_ids))
            products_result = await db.execute(products_stmt)
            products = {p.id: p for p in products_result.scalars().all()}
            # Attach products to items manually
            for item in order.order_items:
                item.product = products.get(item.product_id)

        if not order:
            raise ValueError(f"Order {order_id} not found")

        if order.status not in [OrderStatus.CONFIRMED, OrderStatus.PROCESSING]:
            raise ValueError(
                f"Order must be confirmed or processing to sync to Xero (current: {order.status})"
            )

        if not order.order_items:
            raise ValueError("Order has no line items")

        # Initialize Xero client (use demo client if access token starts with "demo_")
        demo_mode = connection.access_token.startswith("demo_")
        xero_client = get_xero_client(
            access_token=connection.access_token,
            tenant_id=connection.tenant_id,
            demo_mode=demo_mode,
        )

        try:
            # Step 1: Create or get Xero contact for customer
            contact = await self._get_or_create_contact(xero_client, order.customer)

            # Step 2: Create invoice in Xero
            invoice = await self._create_invoice(
                xero_client,
                contact_id=contact["ContactID"],
                order=order,
            )

            # Step 3: Approve invoice (make it AUTHORISED)
            approved_invoice = await xero_client.approve_invoice(invoice["InvoiceID"])

            # Step 4: Update order with Xero invoice ID and sync status
            order.xero_invoice_id = approved_invoice["InvoiceID"]
            order.xero_synced_at = datetime.now()
            order.xero_sync_status = "synced"

            logger.info(
                "Order synced to Xero invoice",
                order_id=str(order_id),
                order_number=order.order_number,
                invoice_id=approved_invoice["InvoiceID"],
                invoice_number=approved_invoice["InvoiceNumber"],
                total=approved_invoice["Total"],
            )

            # Update connection last_synced_at
            connection.last_synced_at = datetime.now()
            await db.commit()

            return {
                "success": True,
                "order_id": str(order_id),
                "order_number": order.order_number,
                "xero_invoice_id": approved_invoice["InvoiceID"],
                "xero_invoice_number": approved_invoice["InvoiceNumber"],
                "total": float(approved_invoice["Total"]),
                "status": approved_invoice["Status"],
            }

        except XeroAPIError as e:
            logger.error(
                "Failed to sync order to Xero",
                order_id=str(order_id),
                error=str(e),
                status_code=e.status_code,
            )
            raise

        finally:
            await xero_client.close()

    async def _get_or_create_contact(
        self,
        xero_client: XeroClient,
        customer: Customer,
    ) -> dict:
        """Get existing Xero contact or create new one.

        Args:
            xero_client: XeroClient instance
            customer: Customer model instance

        Returns:
            Xero contact data

        Raises:
            XeroAPIError: If contact creation fails
        """
        # Try to find existing contact by email
        existing_contact = await xero_client.get_contact_by_email(customer.email)

        if existing_contact:
            logger.info(
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
            "country": "Australia",  # Default to Australia
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

    async def _create_invoice(
        self,
        xero_client: XeroClient,
        contact_id: str,
        order: Order,
    ) -> dict:
        """Create invoice in Xero from order.

        Args:
            xero_client: XeroClient instance
            contact_id: Xero contact ID
            order: Order model instance

        Returns:
            Xero invoice data

        Raises:
            XeroAPIError: If invoice creation fails
        """
        # Map order items to Xero line items
        line_items = []
        for item in order.order_items:
            line_items.append(
                {
                    "description": f"{item.product.name} (SKU: {item.product.sku})",
                    "quantity": float(item.quantity),
                    "unit_amount": float(item.unit_price),
                }
            )

        # Set due date (default: 30 days from order date)
        due_date = order.order_date.date() + timedelta(days=30)

        invoice = await xero_client.create_invoice(
            contact_id=contact_id,
            invoice_number=order.order_number,
            line_items=line_items,
            due_date=due_date,
            reference=order.notes or f"Order {order.order_number}",
        )

        return invoice

    async def bulk_sync_unsynced_orders(
        self,
        db: AsyncSession,
        organization_id: UUID,
        max_orders: int = 100,
    ) -> dict:
        """Bulk sync unsynced orders to Xero.

        Args:
            db: Database session
            organization_id: Organization UUID
            max_orders: Maximum number of orders to sync

        Returns:
            Dict with sync statistics

        Raises:
            ValueError: If no active Xero connection
        """
        # Get active Xero connection
        connection = await self.xero_auth.get_active_connection(db, organization_id)
        if not connection:
            raise ValueError("No active Xero connection found for organization")

        # Find unsynced orders (status = CONFIRMED or PROCESSING)
        # Note: This query assumes xero_invoice_id column exists
        # For now, we'll just get confirmed/processing orders
        stmt = (
            select(Order)
            .where(Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.PROCESSING]))
            .limit(max_orders)
        )
        result = await db.execute(stmt)
        orders = result.scalars().all()

        logger.info(
            "Starting bulk sync",
            organization_id=str(organization_id),
            total_orders=len(orders),
        )

        synced = 0
        failed = 0
        errors = []

        for order in orders:
            try:
                await self.sync_order_to_invoice(db, organization_id, order.id)
                synced += 1
            except Exception as e:
                failed += 1
                errors.append(
                    {
                        "order_id": str(order.id),
                        "order_number": order.order_number,
                        "error": str(e),
                    }
                )
                logger.error(
                    "Failed to sync order",
                    order_id=str(order.id),
                    order_number=order.order_number,
                    error=str(e),
                )

        logger.info(
            "Bulk sync completed",
            synced=synced,
            failed=failed,
            total=len(orders),
        )

        return {
            "total": len(orders),
            "synced": synced,
            "failed": failed,
            "errors": errors if errors else None,
        }

    async def get_invoice_details(
        self,
        db: AsyncSession,
        organization_id: UUID,
        order_id: UUID,
    ) -> Optional[dict]:
        """Get Xero invoice details for an order.

        Args:
            db: Database session
            organization_id: Organization UUID
            order_id: Order UUID

        Returns:
            Xero invoice data or None if not synced

        Raises:
            ValueError: If no active Xero connection
            XeroAPIError: If invoice retrieval fails
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

        # Note: This assumes xero_invoice_id column exists on Order
        # For now, we'll return None
        # TODO: Implement after adding xero_invoice_id column
        logger.warning(
            "Cannot retrieve invoice details - xero_invoice_id column not yet added",
            order_id=str(order_id),
        )

        return None
