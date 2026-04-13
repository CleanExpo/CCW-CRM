"""Benchmark search performance before/after indexes."""
import asyncio
import sys
import time
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import or_, select

from src.config.database import AsyncSessionLocal
from src.db.demo_models import Customer, Product


async def benchmark_customer_search():
    """Benchmark customer wildcard search."""
    async with AsyncSessionLocal() as session:
        # Warm-up query
        await session.execute(select(Customer).limit(1))

        # Test query: customer search with ILIKE (typical user search)
        start = time.time()
        query = select(Customer).where(
            or_(
                Customer.company_name.ilike('%construction%'),
                Customer.contact_name.ilike('%construction%')
            )
        ).limit(50)
        result = await session.execute(query)
        customers = result.scalars().all()
        elapsed = (time.time() - start) * 1000  # Convert to ms

        print(f"  Customer search: {elapsed:7.2f}ms ({len(customers):3d} results)")
        return elapsed


async def benchmark_product_search():
    """Benchmark product filtered search."""
    async with AsyncSessionLocal() as session:
        # Warm-up query
        await session.execute(select(Product).limit(1))

        # Test query: product search with filters (typical catalog search)
        start = time.time()
        query = select(Product).where(
            Product.name.ilike('%drill%'),
            Product.is_active == True,
        ).limit(50)
        result = await session.execute(query)
        products = result.scalars().all()
        elapsed = (time.time() - start) * 1000

        print(f"  Product search:  {elapsed:7.2f}ms ({len(products):3d} results)")
        return elapsed


async def benchmark_product_sku_search():
    """Benchmark product SKU search."""
    async with AsyncSessionLocal() as session:
        # Warm-up query
        await session.execute(select(Product).limit(1))

        # Test query: SKU search (common in order entry)
        start = time.time()
        query = select(Product).where(
            Product.sku.ilike('%tool%')
        ).limit(50)
        result = await session.execute(query)
        products = result.scalars().all()
        elapsed = (time.time() - start) * 1000

        print(f"  SKU search:      {elapsed:7.2f}ms ({len(products):3d} results)")
        return elapsed


async def main():
    """Run all benchmarks."""
    print("\n" + "="*70)
    print(" SEARCH PERFORMANCE BENCHMARK")
    print("="*70 + "\n")

    # Run each benchmark 5 times and average
    customer_times = []
    product_times = []
    sku_times = []

    for i in range(5):
        print(f"Run {i+1}/5:")
        customer_times.append(await benchmark_customer_search())
        product_times.append(await benchmark_product_search())
        sku_times.append(await benchmark_product_sku_search())
        print()
        await asyncio.sleep(0.5)  # Brief pause between runs

    # Calculate averages
    avg_customer = sum(customer_times) / len(customer_times)
    avg_product = sum(product_times) / len(product_times)
    avg_sku = sum(sku_times) / len(sku_times)

    # Calculate min/max for stability assessment
    min_customer, max_customer = min(customer_times), max(customer_times)
    min_product, max_product = min(product_times), max(product_times)
    min_sku, max_sku = min(sku_times), max(sku_times)

    print("="*70)
    print(" AVERAGE RESULTS")
    print("="*70)
    print(f"Customer search:  {avg_customer:7.2f}ms  (range: {min_customer:.2f}-{max_customer:.2f}ms)")
    print(f"Product search:   {avg_product:7.2f}ms  (range: {min_product:.2f}-{max_product:.2f}ms)")
    print(f"SKU search:       {avg_sku:7.2f}ms  (range: {min_sku:.2f}-{max_sku:.2f}ms)")
    print("="*70 + "\n")

    # Performance assessment
    print("PERFORMANCE TARGETS:")
    print(f"  Customer search: {avg_customer:7.2f}ms / 1,000ms target = {(avg_customer/1000)*100:.1f}%")
    print(f"  Product search:  {avg_product:7.2f}ms /   800ms target = {(avg_product/800)*100:.1f}%")
    print(f"  SKU search:      {avg_sku:7.2f}ms /   500ms target = {(avg_sku/500)*100:.1f}%")

    if avg_customer < 1000 and avg_product < 800 and avg_sku < 500:
        print("\n✅ ALL TARGETS MET")
    else:
        print("\n⚠️  Some targets not met - indexes may need tuning")

    print()


if __name__ == "__main__":
    asyncio.run(main())
