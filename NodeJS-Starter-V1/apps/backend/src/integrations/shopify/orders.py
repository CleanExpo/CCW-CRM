"""Shopify order import logic.

Handles importing orders from Shopify into the ERP system.
Maps Shopify orders to local Order and OrderItem records.
"""

import uuid
from datetime import datetime
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Customer, Order, OrderItem, OrderStatus, Product
from src.db.shopify_models import ShopifyOrderMapping
from src.integrations.shopify.client import ShopifyClient

logger = structlog.get_logger(__name__)


class ShopifyOrderImporter:
    """Import orders from Shopify into the ERP system."""

    def __init__(self, db: AsyncSession, client: ShopifyClient) -> None:
        """Initialize importer.

        Args:
            db: Database session
            client: Shopify API client
        """
        self.db = db
        self.client = client

    async def import_order(self, shopify_order_id: int) -> Order:
        """Import a single order from Shopify.

        Args:
            shopify_order_id: Shopify order ID to import

        Returns:
            Created Order instance

        Raises:
            ValueError: If order cannot be imported
        """
        logger.info("importing_shopify_order", order_id=shopify_order_id)

        # Check if already imported
        stmt = select(ShopifyOrderMapping).where(
            ShopifyOrderMapping.shopify_order_id == shopify_order_id
        )
        result = await self.db.execute(stmt)
        existing_mapping = result.scalars().first()

        if existing_mapping:
            logger.info(
                "order_already_imported",
                order_id=shopify_order_id,
                erp_order_id=existing_mapping.order_id,
            )
            # Fetch and return existing order
            stmt = select(Order).where(Order.id == existing_mapping.order_id)
            result = await self.db.execute(stmt)
            existing_order = result.scalars().first()
            if existing_order:
                return existing_order
            raise ValueError(f"Mapped order {existing_mapping.order_id} not found")

        # Fetch order from Shopify
        shopify_data = await self.client.get_order(shopify_order_id)
        shopify_order = shopify_data.get("order")

        if not shopify_order:
            raise ValueError(f"Order {shopify_order_id} not found in Shopify")

        # Create/get customer
        customer = await self._get_or_create_customer(shopify_order)

        # Create order
        order = await self._create_order(shopify_order, customer.id)

        # Create order items
        await self._create_order_items(shopify_order, order.id)

        # Create mapping
        await self._create_mapping(shopify_order, order.id)

        await self.db.commit()

        logger.info(
            "order_imported_successfully",
            shopify_order_id=shopify_order_id,
            erp_order_id=order.id,
        )

        return order

    async def import_recent_orders(
        self,
        limit: int = 50,
        created_after: str | None = None,
    ) -> list[Order]:
        """Import recent orders from Shopify.

        Args:
            limit: Maximum number of orders to import
            created_after: ISO 8601 date string to filter orders

        Returns:
            List of imported Order instances
        """
        logger.info("importing_recent_orders", limit=limit)

        shopify_data = await self.client.get_orders(
            status="any",
            limit=limit,
            created_at_min=created_after,
        )

        shopify_orders = shopify_data.get("orders", [])
        imported_orders = []

        for shopify_order in shopify_orders:
            try:
                order = await self.import_order(shopify_order["id"])
                imported_orders.append(order)
            except Exception as e:
                logger.error(
                    "failed_to_import_order",
                    shopify_order_id=shopify_order["id"],
                    error=str(e),
                )
                continue

        logger.info(
            "bulk_import_completed",
            total_orders=len(shopify_orders),
            imported=len(imported_orders),
        )

        return imported_orders

    async def _get_or_create_customer(self, shopify_order: dict[str, Any]) -> Customer:
        """Get existing customer or create new one from Shopify order.

        Args:
            shopify_order: Shopify order data

        Returns:
            Customer instance
        """
        shopify_customer = shopify_order.get("customer", {})
        email = shopify_customer.get("email") or shopify_order.get("email")

        if not email:
            raise ValueError("Order has no customer email")

        # Try to find existing customer by email
        stmt = select(Customer).where(Customer.email == email)
        result = await self.db.execute(stmt)
        customer = result.scalars().first()

        if customer:
            return customer

        # Create new customer
        shipping_address = shopify_order.get("shipping_address", {})
        billing_address = shopify_order.get("billing_address", {})
        address_data = shipping_address or billing_address

        # Generate unique customer number
        stmt = select(Customer).order_by(Customer.created_at.desc())
        result = await self.db.execute(stmt)
        last_customer = result.scalars().first()

        if last_customer and last_customer.customer_number:
            # Extract number and increment
            try:
                last_num = int(last_customer.customer_number.split("-")[-1])
                next_num = last_num + 1
            except (ValueError, IndexError):
                next_num = 1
        else:
            next_num = 1

        customer_number = f"CUST-{next_num:05d}"

        customer = Customer(
            id=uuid.uuid4(),
            customer_number=customer_number,
            company_name=(
                shopify_customer.get("first_name", "")
                + " "
                + shopify_customer.get("last_name", "")
            ).strip()
            or "Shopify Customer",
            contact_name=(
                shopify_customer.get("first_name", "")
                + " "
                + shopify_customer.get("last_name", "")
            ).strip(),
            email=email,
            phone=shopify_customer.get("phone") or address_data.get("phone"),
            address=address_data.get("address1"),
            city=address_data.get("city"),
            state=address_data.get("province"),
            postcode=address_data.get("zip"),
            is_active=True,
        )

        self.db.add(customer)
        await self.db.flush()

        logger.info("customer_created", customer_id=customer.id, email=email)

        return customer

    async def _create_order(
        self,
        shopify_order: dict[str, Any],
        customer_id: uuid.UUID,
    ) -> Order:
        """Create Order from Shopify data.

        Args:
            shopify_order: Shopify order data
            customer_id: Local customer ID

        Returns:
            Created Order instance
        """
        # Generate order number
        stmt = select(Order).order_by(Order.created_at.desc())
        result = await self.db.execute(stmt)
        last_order = result.scalars().first()

        year = datetime.now().year
        if last_order and last_order.order_number:
            try:
                parts = last_order.order_number.split("-")
                last_year = int(parts[1])
                last_num = int(parts[2])
                next_num = last_num + 1 if last_year == year else 1
            except (ValueError, IndexError):
                next_num = 1
        else:
            next_num = 1

        order_number = f"ORD-{year}-{next_num:03d}"

        # Map financial status to order status
        financial_status = shopify_order.get("financial_status", "pending")
        fulfillment_status = shopify_order.get("fulfillment_status")

        if shopify_order.get("cancelled_at"):
            status = OrderStatus.CANCELLED
        elif fulfillment_status == "fulfilled":
            status = OrderStatus.DELIVERED
        elif fulfillment_status:
            status = OrderStatus.PROCESSING
        elif financial_status == "paid":
            status = OrderStatus.CONFIRMED
        else:
            status = OrderStatus.PENDING

        order = Order(
            id=uuid.uuid4(),
            order_number=order_number,
            customer_id=customer_id,
            order_date=datetime.fromisoformat(
                shopify_order["created_at"].replace("Z", "+00:00")
            ),
            status=status,
            notes=shopify_order.get("note") or "Imported from Shopify",
            total=float(shopify_order.get("total_price", 0)),
        )

        self.db.add(order)
        await self.db.flush()

        logger.info(
            "order_created",
            order_id=order.id,
            order_number=order_number,
            total=order.total,
        )

        return order

    async def _create_order_items(
        self,
        shopify_order: dict[str, Any],
        order_id: uuid.UUID,
    ) -> list[OrderItem]:
        """Create OrderItems from Shopify line items.

        Args:
            shopify_order: Shopify order data
            order_id: Local order ID

        Returns:
            List of created OrderItem instances
        """
        line_items = shopify_order.get("line_items", [])
        order_items = []

        for line_item in line_items:
            sku = line_item.get("sku")

            # Try to find product by SKU
            product = None
            if sku:
                stmt = select(Product).where(Product.sku == sku)
                result = await self.db.execute(stmt)
                product = result.scalars().first()

            # If product not found, log warning and skip or create placeholder
            if not product:
                logger.warning(
                    "product_not_found_for_line_item",
                    sku=sku,
                    title=line_item.get("title"),
                )
                # For demo, we'll skip items without matching products
                # In production, you might want to create placeholder products
                continue

            quantity = line_item.get("quantity", 1)
            unit_price = float(line_item.get("price", 0))

            order_item = OrderItem(
                id=uuid.uuid4(),
                order_id=order_id,
                product_id=product.id,
                quantity=quantity,
                unit_price=unit_price,
                subtotal=quantity * unit_price,
            )

            self.db.add(order_item)
            order_items.append(order_item)

        await self.db.flush()

        logger.info(
            "order_items_created",
            order_id=order_id,
            item_count=len(order_items),
        )

        return order_items

    async def _create_mapping(
        self,
        shopify_order: dict[str, Any],
        order_id: uuid.UUID,
    ) -> ShopifyOrderMapping:
        """Create ShopifyOrderMapping record.

        Args:
            shopify_order: Shopify order data
            order_id: Local order ID

        Returns:
            Created mapping instance
        """
        mapping = ShopifyOrderMapping(
            id=uuid.uuid4(),
            order_id=order_id,
            shopify_order_id=shopify_order["id"],
            shopify_order_number=shopify_order["order_number"],
            shopify_order_name=shopify_order["name"],
            financial_status=shopify_order.get("financial_status"),
            fulfillment_status=shopify_order.get("fulfillment_status"),
            shopify_data=shopify_order,
            import_status="imported",
        )

        self.db.add(mapping)
        await self.db.flush()

        logger.info(
            "mapping_created",
            order_id=order_id,
            shopify_order_id=shopify_order["id"],
        )

        return mapping
