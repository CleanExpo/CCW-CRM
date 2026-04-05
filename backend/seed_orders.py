"""Quick script to seed 5 varied client orders for demo."""
import asyncio
import random
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import AsyncSessionLocal
from src.db.demo_models import Customer, Order, OrderItem, OrderStatus, Product


async def seed_orders() -> None:
    """Create 5 varied orders."""
    print("\n[SEED] Creating 5 varied demo orders...\n")

    async with AsyncSessionLocal() as db:
        # Get all customers and products
        customers_result = await db.execute(select(Customer))
        customers = list(customers_result.scalars().all())

        products_result = await db.execute(select(Product))
        products = list(products_result.scalars().all())

        if not customers or not products:
            print("[ERROR] No customers or products found. Run seed_demo.py first.")
            return

        # Create 5 diverse orders
        order_configs = [
            {
                "status": OrderStatus.PENDING,
                "days_ago": 2,
                "items_count": 3,
                "description": "Recent pending order",
            },
            {
                "status": OrderStatus.CONFIRMED,
                "days_ago": 5,
                "items_count": 5,
                "description": "Confirmed order from last week",
            },
            {
                "status": OrderStatus.PROCESSING,
                "days_ago": 10,
                "items_count": 7,
                "description": "Large order being processed",
            },
            {
                "status": OrderStatus.SHIPPED,
                "days_ago": 15,
                "items_count": 4,
                "description": "Shipped order",
            },
            {
                "status": OrderStatus.DELIVERED,
                "days_ago": 30,
                "items_count": 6,
                "description": "Completed delivery from last month",
            },
        ]

        order_number = 10000
        now = datetime.now(UTC)

        for config in order_configs:
            order_date = now - timedelta(days=config["days_ago"])
            customer = random.choice(customers)

            order = Order(
                order_number=f"SO-{order_number:06d}",
                customer_id=customer.id,
                status=config["status"],
                order_date=order_date,
                total=Decimal(0),
            )
            db.add(order)
            await db.flush()

            # Add line items
            selected_products = random.sample(products, min(config["items_count"], len(products)))
            total = Decimal(0)

            for product in selected_products:
                quantity = random.randint(1, 10)
                unit_price = product.price
                line_total = (Decimal(quantity) * unit_price).quantize(Decimal("0.01"))

                order_item = OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    quantity=quantity,
                    unit_price=unit_price,
                    line_total=line_total,
                )
                db.add(order_item)
                total += line_total

            # Update order total
            order.total = total

            await db.commit()

            print(f"[OK] Created {config['description']}")
            print(f"     Order: {order.order_number}")
            print(f"     Customer: {customer.company_name}")
            print(f"     Status: {order.status.value}")
            print(f"     Total: ${order.total:,.2f} ({len(selected_products)} items)")
            print()

            order_number += 1

    print("[SEED] Successfully created 5 varied demo orders!\n")


if __name__ == "__main__":
    asyncio.run(seed_orders())
