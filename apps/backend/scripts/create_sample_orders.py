"""
Script to create sample orders using imported CCWonline products.

Usage:
    python scripts/create_sample_orders.py --count 10
"""

import asyncio
import sys
import random
from pathlib import Path
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.db.demo_models import Customer, Product, Order, OrderItem, OrderStatus
from src.config.database import get_async_db
from sqlalchemy import select


async def create_sample_orders(count: int = 10):
    """Create sample orders with CCWonline products."""

    async for db in get_async_db():
        try:
            # Fetch customers
            result = await db.execute(select(Customer).where(Customer.is_active == True).limit(20))
            customers = result.scalars().all()

            if not customers:
                print("[X] No customers found in database")
                return

            # Fetch CCWonline products (exclude test products)
            result = await db.execute(
                select(Product)
                .where(Product.is_active == True)
                .where(Product.sku.notlike('CLAUDE-%'))
                .where(Product.sku.notlike('E2E-%'))
                .where(Product.sku.notlike('EQ-%'))
            )
            products = result.scalars().all()

            if not products:
                print("[X] No CCWonline products found")
                return

            print(f"[>] Creating {count} sample orders using {len(products)} CCWonline products...")
            print(f"[>] Using {len(customers)} customers\n")

            order_statuses = [
                (OrderStatus.CONFIRMED, 40),
                (OrderStatus.PROCESSING, 30),
                (OrderStatus.SHIPPED, 20),
                (OrderStatus.DELIVERED, 10),
            ]

            created_count = 0

            for i in range(count):
                try:
                    # Random customer
                    customer = random.choice(customers)

                    # Random status (weighted)
                    status = random.choices(
                        [s[0] for s in order_statuses],
                        weights=[s[1] for s in order_statuses]
                    )[0]

                    # Random date in last 30 days
                    days_ago = random.randint(0, 30)
                    order_date = datetime.now() - timedelta(days=days_ago)

                    # Generate order number
                    order_number = f"ORD-2026-{1000 + i + 41:04d}"  # Continue from existing

                    # Select 1-5 random products
                    num_products = random.randint(1, 5)
                    order_products = random.sample(products, min(num_products, len(products)))

                    # Create order items
                    order_items = []
                    line_total = Decimal('0')

                    for product in order_products:
                        quantity = random.randint(1, 5)
                        unit_price = product.price
                        item_line_total = unit_price * quantity

                        order_item = OrderItem(
                            id=uuid4(),
                            product_id=product.id,
                            quantity=quantity,
                            unit_price=unit_price,
                            line_total=item_line_total,
                            created_at=order_date
                        )
                        order_items.append(order_item)
                        line_total += item_line_total

                    # Calculate tax and total
                    tax = line_total * Decimal('0.1')  # 10% GST
                    total = line_total + tax

                    # Create order
                    order = Order(
                        id=uuid4(),
                        order_number=order_number,
                        customer_id=customer.id,
                        order_date=order_date,
                        status=status,
                        subtotal=line_total,
                        tax=tax,
                        total=total,
                        notes=f"Sample order with {len(order_items)} CCWonline product(s)",
                        created_at=order_date,
                        updated_at=order_date
                    )

                    # Add to session
                    db.add(order)

                    # Add items with order_id
                    for item in order_items:
                        item.order_id = order.id
                        db.add(item)

                    created_count += 1

                    # Print order summary
                    product_names = [p.name[:40] for p in order_products]
                    print(f"[+] {order_number} | {customer.company_name[:30]:<30} | {status.value:<10} | ${total:>10.2f} | {len(order_items)} items")

                except Exception as e:
                    print(f"[X] Error creating order {i+1}: {str(e)}")

            # Commit all orders
            await db.commit()
            print(f"\n[OK] Successfully created {created_count} sample orders")

        finally:
            await db.close()
        break


if __name__ == "__main__":
    count = 10  # Default: 10 orders

    if "--count" in sys.argv:
        idx = sys.argv.index("--count")
        count = int(sys.argv[idx + 1])

    print(f"{'='*80}")
    print(f"Create Sample Orders with CCWonline Products")
    print(f"{'='*80}")
    print(f"Orders to create: {count}")
    print(f"{'='*80}\n")

    asyncio.run(create_sample_orders(count))
