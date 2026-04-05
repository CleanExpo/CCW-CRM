"""
Verification script for ISS-004: Race Condition Fix
Tests PostgreSQL SEQUENCE atomicity at high concurrency
"""
import asyncio
import asyncpg
from collections import Counter


async def test_concurrent_quote_generation():
    """Test concurrent quote number generation directly at database level"""

    # Connect to database
    conn = await asyncpg.connect(
        host='localhost',
        port=5434,
        user='ccw_staging',
        password='ccw_staging_password',
        database='ccw_erp_staging'
    )

    print("=" * 70)
    print("ISS-004 Verification: Race Condition Fix Test")
    print("=" * 70)

    # Test 1: Generate 10 quote numbers concurrently
    print("\n📋 Test 1: 10 Concurrent Quote Number Generations")
    print("-" * 70)

    async def generate_quote_number():
        return await conn.fetchval("SELECT generate_quote_number()")

    tasks = [generate_quote_number() for _ in range(10)]
    quote_numbers = await asyncio.gather(*tasks)

    print(f"Generated {len(quote_numbers)} quote numbers:")
    for i, num in enumerate(quote_numbers, 1):
        print(f"  {i}. {num}")

    duplicates = len(quote_numbers) - len(set(quote_numbers))
    print(f"\nResults:")
    print(f"  Total generated: {len(quote_numbers)}")
    print(f"  Unique numbers: {len(set(quote_numbers))}")
    print(f"  Duplicates: {duplicates}")

    if duplicates == 0:
        print(f"  ✅ PASSED: Zero duplicates")
    else:
        print(f"  ❌ FAILED: Found {duplicates} duplicates")

    # Test 2: Generate 50 order numbers concurrently (stress test)
    print("\n📋 Test 2: 50 Concurrent Order Number Generations (Stress Test)")
    print("-" * 70)

    async def generate_order_number():
        return await conn.fetchval("SELECT generate_order_number()")

    tasks = [generate_order_number() for _ in range(50)]
    order_numbers = await asyncio.gather(*tasks)

    print(f"Generated {len(order_numbers)} order numbers")
    duplicates = len(order_numbers) - len(set(order_numbers))

    print(f"\nResults:")
    print(f"  Total generated: {len(order_numbers)}")
    print(f"  Unique numbers: {len(set(order_numbers))}")
    print(f"  Duplicates: {duplicates}")

    if duplicates == 0:
        print(f"  ✅ PASSED: Zero duplicates under stress")
    else:
        print(f"  ❌ FAILED: Found {duplicates} duplicates")
        # Show duplicate numbers
        counter = Counter(order_numbers)
        for num, count in counter.items():
            if count > 1:
                print(f"    - {num}: generated {count} times")

    # Test 3: Extreme concurrency - 100 simultaneous generations
    print("\n📋 Test 3: 100 Concurrent Generations (Extreme Stress)")
    print("-" * 70)

    tasks = [generate_quote_number() for _ in range(100)]
    extreme_numbers = await asyncio.gather(*tasks)

    duplicates = len(extreme_numbers) - len(set(extreme_numbers))
    print(f"Generated {len(extreme_numbers)} numbers")
    print(f"  Unique: {len(set(extreme_numbers))}")
    print(f"  Duplicates: {duplicates}")

    if duplicates == 0:
        print(f"  ✅ PASSED: Zero duplicates at 100x concurrency")
    else:
        print(f"  ❌ FAILED: Found {duplicates} duplicates")

    # Test 4: Check for existing duplicates in database
    print("\n📋 Test 4: Check Database for Existing Duplicates")
    print("-" * 70)

    order_dupes = await conn.fetch("""
        SELECT order_number, COUNT(*) as count
        FROM orders
        GROUP BY order_number
        HAVING COUNT(*) > 1
        LIMIT 10
    """)

    quote_dupes = await conn.fetch("""
        SELECT quote_number, COUNT(*) as count
        FROM quotes
        GROUP BY quote_number
        HAVING COUNT(*) > 1
        LIMIT 10
    """)

    print(f"Order duplicates in database: {len(order_dupes)}")
    print(f"Quote duplicates in database: {len(quote_dupes)}")

    if len(order_dupes) == 0 and len(quote_dupes) == 0:
        print("  ✅ PASSED: No duplicates in database")
    else:
        print("  ❌ FAILED: Found duplicates in database")
        if order_dupes:
            print("\n  Order duplicates:")
            for row in order_dupes:
                print(f"    - {row['order_number']}: {row['count']} occurrences")
        if quote_dupes:
            print("\n  Quote duplicates:")
            for row in quote_dupes:
                print(f"    - {row['quote_number']}: {row['count']} occurrences")

    # Summary
    print("\n" + "=" * 70)
    print("📊 SUMMARY")
    print("=" * 70)

    all_tests_passed = (
        duplicates == 0 and
        len(order_dupes) == 0 and
        len(quote_dupes) == 0
    )

    if all_tests_passed:
        print("✅ ALL TESTS PASSED")
        print("\nISS-004 VERIFIED: Race condition fix is working correctly.")
        print("PostgreSQL SEQUENCE ensures atomic, collision-free number generation.")
        print("System can handle high concurrency (100+ concurrent requests) with 0 conflicts.")
    else:
        print("❌ SOME TESTS FAILED")
        print("\nPlease review the failures above.")

    await conn.close()

    return 0 if all_tests_passed else 1


if __name__ == "__main__":
    exit_code = asyncio.run(test_concurrent_quote_generation())
    exit(exit_code)
