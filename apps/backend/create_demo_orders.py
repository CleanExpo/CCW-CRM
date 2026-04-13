"""
Create demo orders for dashboard analytics.

Generates orders with:
- Various statuses (pending, confirmed, processing, shipped) for order status breakdown
- Fulfillment locations (Brisbane, Sydney, Melbourne) for revenue by location
- Recent dates (last 30 days) with delivered status to show revenue
"""

import asyncio
import os
import random
import sys
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config.database import AsyncSessionLocal


async def create_demo_orders():
    """Create demo orders for dashboard."""
    async with AsyncSessionLocal() as db:
        # Get customers and products
        customers_result = await db.execute(
            select(Customer).where(Customer.is_active == True).limit(10)
        )
        customers = list(customers_result.scalars().all())

        products_result = await db.execute(
            select(Product).where(Product.is_active == True).limit(50)
        )
        products = list(products_result.scalars().all())

        if not customers or not products:
            print("[ERROR] No customers or products found. Run seed_demo.py first.")
            return

        # Get the highest order number
        max_order_result = await db.execute(
            select(Order.order_number).order_by(Order.order_number.desc()).limit(1)
        )
        max_order = max_order_result.scalar()
        if max_order:
            order_number = int(max_order.split("-")[1]) + 1
        else:
            order_number = 10000

        locations = ["Brisbane", "Sydney", "Melbourne"]
        now = datetime.now(UTC)
        orders_created = 0

        print("Creating demo orders...")

        # Create 10 active orders (for order status breakdown)
        print("\n1. Creating active orders (various statuses)...")
        for i in range(10):
            customer = random.choice(customers)
            status = random.choice([
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED,
                OrderStatus.PROCESSING,
                OrderStatus.SHIPPED,
            ])
            location = random.choice(locations)

            # Recent date (within last 7 days)
            days_ago = random.randint(0, 7)
            order_date = now - timedelta(days=days_ago)

            order = Order(
                order_number=f"SO-{order_number:06d}",
                customer_id=customer.id,
                status=status,
                fulfillment_location=location,
                order_date=order_date,
                subtotal=Decimal(0),
                tax=Decimal(0),
                total=Decimal(0),
            )
            db.add(order)
            await db.flush()

            # Add 2-5 line items
            num_items = random.randint(2, 5)
            selected_products = random.sample(products, min(num_items, len(products)))
            subtotal = Decimal(0)

            for product in selected_products:
                quantity = random.randint(1, 5)
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
                subtotal += line_total

            # Calculate tax and total
            tax = (subtotal * Decimal("0.10")).quantize(Decimal("0.01"))
            total = subtotal + tax

            order.subtotal = subtotal
            order.tax = tax
            order.total = total

            orders_created += 1
            order_number += 1
            print(f"   Created order {order.order_number} - Status: {status.value}, Location: {location}, Total: ${total}")

        # Create 15 delivered orders (for revenue by location - last 30 days)
        print("\n2. Creating delivered orders (last 30 days)...")
        for i in range(15):
            customer = random.choice(customers)
            location = random.choice(locations)

            # Random date within last 30 days
            days_ago = random.randint(1, 30)
            order_date = now - timedelta(days=days_ago)
            shipped_date = order_date + timedelta(days=random.randint(1, 3))

            order = Order(
                order_number=f"SO-{order_number:06d}",
                customer_id=customer.id,
                status=OrderStatus.DELIVERED,
                fulfillment_location=location,
                order_date=order_date,
                shipped_date=shipped_date,
                subtotal=Decimal(0),
                tax=Decimal(0),
                total=Decimal(0),
            )
            db.add(order)
            await db.flush()

            # Add 3-8 line items (larger orders for revenue)
            num_items = random.randint(3, 8)
            selected_products = random.sample(products, min(num_items, len(products)))
            subtotal = Decimal(0)

            for product in selected_products:
                quantity = random.randint(2, 10)
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
                subtotal += line_total

            # Calculate tax and total
            tax = (subtotal * Decimal("0.10")).quantize(Decimal("0.01"))
            total = subtotal + tax

            order.subtotal = subtotal
            order.tax = tax
            order.total = total

            orders_created += 1
            order_number += 1
            print(f"   Created order {order.order_number} - Location: {location}, Total: ${total}, Date: {order_date.strftime('%Y-%m-%d')}")

        await db.commit()
        print(f"\n[SUCCESS] Created {orders_created} demo orders!")
        print("\nDashboard should now show:")
        print("- Order Status Breakdown: 10 active orders across various statuses")
        print("- Revenue by Location: ~15 delivered orders across Brisbane/Sydney/Melbourne")
        print("- Quote Conversion: Existing quote data")


if __name__ == "__main__":
    asyncio.run(create_demo_orders())
