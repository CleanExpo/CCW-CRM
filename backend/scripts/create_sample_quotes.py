"""
Script to create sample quotes using imported CCWonline products.

Usage:
    python scripts/create_sample_quotes.py --count 10
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

from src.db.demo_models import Customer, Product, Quote, QuoteItem, QuoteStatus
from src.config.database import get_async_db
from sqlalchemy import select


async def create_sample_quotes(count: int = 10):
    """Create sample quotes with CCWonline products."""

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

            print(f"[>] Creating {count} sample quotes using {len(products)} CCWonline products...")
            print(f"[>] Using {len(customers)} customers\n")

            quote_statuses = [
                (QuoteStatus.DRAFT, 20),
                (QuoteStatus.PENDING, 15),
                (QuoteStatus.SENT, 30),
                (QuoteStatus.ACCEPTED, 20),
                (QuoteStatus.REJECTED, 10),
                (QuoteStatus.EXPIRED, 5),
            ]

            created_count = 0

            for i in range(count):
                try:
                    # Random customer
                    customer = random.choice(customers)

                    # Random status (weighted)
                    status = random.choices(
                        [s[0] for s in quote_statuses],
                        weights=[s[1] for s in quote_statuses]
                    )[0]

                    # Random date in last 30 days
                    days_ago = random.randint(0, 30)
                    quote_date = datetime.now() - timedelta(days=days_ago)

                    # Valid until date (7-30 days after quote date)
                    valid_days = random.randint(7, 30)
                    valid_until = quote_date + timedelta(days=valid_days)

                    # Generate quote number (Q-2026-NNN format)
                    quote_number = f"Q-2026-{1000 + i + 31:04d}"  # Continue from existing

                    # Select 1-5 random products
                    num_products = random.randint(1, 5)
                    quote_products = random.sample(products, min(num_products, len(products)))

                    # Create quote items
                    quote_items = []
                    line_total = Decimal('0')

                    for product in quote_products:
                        quantity = random.randint(1, 5)
                        unit_price = product.price
                        item_line_total = unit_price * quantity

                        quote_item = QuoteItem(
                            id=uuid4(),
                            product_id=product.id,
                            quantity=quantity,
                            unit_price=unit_price,
                            line_total=item_line_total,
                            created_at=quote_date
                        )
                        quote_items.append(quote_item)
                        line_total += item_line_total

                    # Calculate tax and total
                    tax = line_total * Decimal('0.1')  # 10% GST
                    total = line_total + tax

                    # Create quote
                    quote = Quote(
                        id=uuid4(),
                        quote_number=quote_number,
                        customer_id=customer.id,
                        quote_date=quote_date,
                        valid_until=valid_until,
                        status=status,
                        subtotal=line_total,
                        tax=tax,
                        total=total,
                        notes=f"Sample quote with {len(quote_items)} CCWonline product(s)",
                        created_at=quote_date,
                        updated_at=quote_date
                    )

                    # Add to session
                    db.add(quote)

                    # Add items with quote_id
                    for item in quote_items:
                        item.quote_id = quote.id
                        db.add(item)

                    created_count += 1

                    # Print quote summary
                    product_names = [p.name[:40] for p in quote_products]
                    print(f"[+] {quote_number} | {customer.company_name[:30]:<30} | {status.value:<10} | ${total:>10.2f} | {len(quote_items)} items")

                except Exception as e:
                    print(f"[X] Error creating quote {i+1}: {str(e)}")

            # Commit all quotes
            await db.commit()
            print(f"\n[OK] Successfully created {created_count} sample quotes")

        finally:
            await db.close()
        break


if __name__ == "__main__":
    count = 10  # Default: 10 quotes

    if "--count" in sys.argv:
        idx = sys.argv.index("--count")
        count = int(sys.argv[idx + 1])

    print(f"{'='*80}")
    print(f"Create Sample Quotes with CCWonline Products")
    print(f"{'='*80}")
    print(f"Quotes to create: {count}")
    print(f"{'='*80}\n")

    asyncio.run(create_sample_quotes(count))
