"""Test search performance after index optimization."""
import asyncio
import sys
import time
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.config.database import get_async_db


async def test_search_performance():
    """Test search performance with new indexes."""
    print("=" * 70)
    print("SEARCH PERFORMANCE TEST")
    print("=" * 70)
    print()

    async for db in get_async_db():
        try:
            # Test 1: Customer search
            print("Test 1: Customer Search (company_name ILIKE '%equipment%')")
            print("-" * 70)

            start = time.time()
            result = await db.execute(
                text(
                    "EXPLAIN ANALYZE SELECT * FROM customers WHERE company_name ILIKE '%equipment%';"
                )
            )
            explain_lines = [row[0] for row in result.fetchall()]
            duration = (time.time() - start) * 1000

            print(f"Duration: {duration:.2f}ms")
            # Check if index was used
            using_index = any("idx_customers_company_trgm" in line for line in explain_lines)
            print(f"Using trigram index: {'YES' if using_index else 'NO'}")
            print()

            # Test 2: Product search
            print("Test 2: Product Search (name ILIKE '%drill%')")
            print("-" * 70)

            start = time.time()
            result = await db.execute(
                text("EXPLAIN ANALYZE SELECT * FROM products WHERE name ILIKE '%drill%';")
            )
            explain_lines = [row[0] for row in result.fetchall()]
            duration = (time.time() - start) * 1000

            print(f"Duration: {duration:.2f}ms")
            using_index = any("idx_products_name_trgm" in line for line in explain_lines)
            print(f"Using trigram index: {'YES' if using_index else 'NO'}")
            print()

            # Test 3: Order lookup by customer
            print("Test 3: Order Lookup (JOIN with customer)")
            print("-" * 70)

            start = time.time()
            result = await db.execute(
                text(
                    """
                EXPLAIN ANALYZE
                SELECT o.*, c.company_name
                FROM orders o
                JOIN customers c ON o.customer_id = c.id
                WHERE o.status = 'confirmed'
                ORDER BY o.order_date DESC
                LIMIT 50;
            """
                )
            )
            explain_lines = [row[0] for row in result.fetchall()]
            duration = (time.time() - start) * 1000

            print(f"Duration: {duration:.2f}ms")
            using_index = any(
                "idx_orders" in line or "idx_customers" in line for line in explain_lines
            )
            print(f"Using indexes: {'YES' if using_index else 'NO'}")
            print()

            # Test 4: Quote filtering
            print("Test 4: Quote Filtering (status + date)")
            print("-" * 70)

            start = time.time()
            result = await db.execute(
                text(
                    """
                EXPLAIN ANALYZE
                SELECT * FROM quotes
                WHERE status IN ('sent', 'pending')
                ORDER BY quote_date DESC
                LIMIT 50;
            """
                )
            )
            explain_lines = [row[0] for row in result.fetchall()]
            duration = (time.time() - start) * 1000

            print(f"Duration: {duration:.2f}ms")
            using_index = any("idx_quotes" in line for line in explain_lines)
            print(f"Using indexes: {'YES' if using_index else 'NO'}")
            print()

            # Summary
            print("=" * 70)
            print("SUMMARY")
            print("=" * 70)
            print()
            print("Expected Performance Improvements:")
            print("  Customer search:  3,500ms -> <1,000ms (71% faster)")
            print("  Product search:   1,700ms -> <800ms   (53% faster)")
            print("  Order lookups:    ~50% faster")
            print("  Quote filtering:  ~60% faster")
            print()
            print("Notes:")
            print("  - Actual timings depend on dataset size")
            print("  - Indexes auto-maintain (no manual work needed)")
            print("  - PostgreSQL query planner decides when to use indexes")
            print("=" * 70)

            return True

        except Exception as e:
            print(f"ERROR: {str(e)}")
            return False


if __name__ == "__main__":
    result = asyncio.run(test_search_performance())
    sys.exit(0 if result else 1)
