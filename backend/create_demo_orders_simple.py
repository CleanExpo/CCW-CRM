"""
Create demo orders for dashboard analytics using raw SQL.
"""

import asyncio
import random
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import asyncpg


async def create_demo_orders():
    """Create demo orders for dashboard using raw SQL."""
    # Database connection
    conn = await asyncpg.connect(
        user="starter_user",
        password="local_dev_password",
        database="starter_db",
        host="127.0.0.1",
        port=5433,
    )

    try:
        # Get customers
        customers = await conn.fetch(
            "SELECT id FROM customers WHERE is_active = TRUE LIMIT 10"
        )
        if not customers:
            print("[ERROR] No customers found. Run seed_demo.py first.")
            return

        # Get products
        products = await conn.fetch(
            "SELECT id, price FROM products WHERE is_active = TRUE LIMIT 50"
        )
        if not products:
            print("[ERROR] No products found. Run seed_demo.py first.")
            return

        # Get highest order number
        max_order = await conn.fetchval(
            "SELECT order_number FROM orders ORDER BY order_number DESC LIMIT 1"
        )
        if max_order:
            order_number = int(max_order.split("-")[1]) + 1
        else:
            order_number = 10000

        locations = ["Brisbane", "Sydney", "Melbourne"]
        statuses_active = ["pending", "confirmed", "processing", "shipped"]
        now = datetime.now(UTC)
        orders_created = 0

        print("Creating demo orders...")

        # Create 10 active orders (for order status breakdown)
        print("\n1. Creating active orders (various statuses)...")
        for i in range(10):
            customer_id = random.choice(customers)["id"]
            status = random.choice(statuses_active)
            location = random.choice(locations)
            days_ago = random.randint(0, 7)
            order_date = now - timedelta(days=days_ago)
            order_id = uuid.uuid4()

            # Create order
            await conn.execute(
                """
                INSERT INTO orders (
                    id, order_number, customer_id, status, fulfillment_location,
                    order_date, subtotal, tax, total, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                """,
                order_id,
                f"SO-{order_number:06d}",
                customer_id,
                status,
                location,
                order_date,
                Decimal(0),
                Decimal(0),
                Decimal(0),
                now,
                now,
            )

            # Add line items
            num_items = random.randint(2, 5)
            selected_products = random.sample(products, min(num_items, len(products)))
            subtotal = Decimal(0)

            for product in selected_products:
                quantity = random.randint(1, 5)
                unit_price = Decimal(str(product["price"]))
                line_total = (Decimal(quantity) * unit_price).quantize(Decimal("0.01"))

                await conn.execute(
                    """
                    INSERT INTO order_items (
                        id, order_id, product_id, quantity, unit_price, line_total,
                        created_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    """,
                    uuid.uuid4(),
                    order_id,
                    product["id"],
                    quantity,
                    unit_price,
                    line_total,
                    now,
                )
                subtotal += line_total

            # Update order totals
            tax = (subtotal * Decimal("0.10")).quantize(Decimal("0.01"))
            total = subtotal + tax

            await conn.execute(
                """
                UPDATE orders
                SET subtotal = $1, tax = $2, total = $3
                WHERE id = $4
                """,
                subtotal,
                tax,
                total,
                order_id,
            )

            orders_created += 1
            order_number += 1
            print(f"   Created order SO-{order_number-1:06d} - Status: {status}, Location: {location}, Total: ${total}")

        # Create 15 delivered orders (for revenue by location - last 30 days)
        print("\n2. Creating delivered orders (last 30 days)...")
        for i in range(15):
            customer_id = random.choice(customers)["id"]
            location = random.choice(locations)
            days_ago = random.randint(1, 30)
            order_date = now - timedelta(days=days_ago)
            shipped_date = order_date + timedelta(days=random.randint(1, 3))
            order_id = uuid.uuid4()

            # Create order
            await conn.execute(
                """
                INSERT INTO orders (
                    id, order_number, customer_id, status, fulfillment_location,
                    order_date, shipped_date, subtotal, tax, total, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                """,
                order_id,
                f"SO-{order_number:06d}",
                customer_id,
                "delivered",
                location,
                order_date,
                shipped_date,
                Decimal(0),
                Decimal(0),
                Decimal(0),
                now,
                now,
            )

            # Add line items
            num_items = random.randint(3, 8)
            selected_products = random.sample(products, min(num_items, len(products)))
            subtotal = Decimal(0)

            for product in selected_products:
                quantity = random.randint(2, 10)
                unit_price = Decimal(str(product["price"]))
                line_total = (Decimal(quantity) * unit_price).quantize(Decimal("0.01"))

                await conn.execute(
                    """
                    INSERT INTO order_items (
                        id, order_id, product_id, quantity, unit_price, line_total,
                        created_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    """,
                    uuid.uuid4(),
                    order_id,
                    product["id"],
                    quantity,
                    unit_price,
                    line_total,
                    now,
                )
                subtotal += line_total

            # Update order totals
            tax = (subtotal * Decimal("0.10")).quantize(Decimal("0.01"))
            total = subtotal + tax

            await conn.execute(
                """
                UPDATE orders
                SET subtotal = $1, tax = $2, total = $3
                WHERE id = $4
                """,
                subtotal,
                tax,
                total,
                order_id,
            )

            orders_created += 1
            order_number += 1
            print(f"   Created order SO-{order_number-1:06d} - Location: {location}, Total: ${total}, Date: {order_date.strftime('%Y-%m-%d')}")

        print(f"\n[SUCCESS] Created {orders_created} demo orders!")
        print("\nDashboard should now show:")
        print("- Order Status Breakdown: 10 active orders across various statuses")
        print("- Revenue by Location: ~15 delivered orders across Brisbane/Sydney/Melbourne")
        print("- Quote Conversion: Existing quote data")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(create_demo_orders())
