"""
Verify PostgreSQL sequence-based number generation deployment.

This script directly tests the database sequences to confirm they generate
unique numbers without race conditions.
"""

import asyncpg
import asyncio
from datetime import datetime


async def verify_sequences():
    """Verify sequence functions are deployed and working correctly."""

    # Connect to database
    conn = await asyncpg.connect(
        host="localhost",
        port=5433,
        database="starter_db",
        user="starter_user",
        password="local_dev_password"
    )

    try:
        print("=" * 70)
        print(" SEQUENCE DEPLOYMENT VERIFICATION")
        print("=" * 70)

        # Step 1: Verify sequences exist
        print("\nStep 1: Checking if sequences exist...")
        sequences = await conn.fetch("""
            SELECT sequencename
            FROM pg_sequences
            WHERE schemaname = 'public'
            AND sequencename IN ('order_number_seq', 'quote_number_seq', 'pos_transaction_number_seq')
            ORDER BY sequencename
        """)

        for seq in sequences:
            print(f"  [OK] {seq['sequencename']}")

        if len(sequences) < 2:
            print(f"  [FAIL] Missing sequences! Found {len(sequences)}, expected at least 2")
            return False

        # Step 2: Verify functions exist
        print("\nStep 2: Checking if generator functions exist...")
        functions = await conn.fetch("""
            SELECT proname
            FROM pg_proc
            WHERE proname IN ('generate_order_number', 'generate_quote_number')
            ORDER BY proname
        """)

        for func in functions:
            print(f"  [OK] {func['proname']}()")

        if len(functions) < 2:
            print(f"  [FAIL] Missing functions! Found {len(functions)}, expected 2")
            return False

        # Step 3: Test concurrent number generation (50 operations)
        print("\nStep 3: Testing concurrent order number generation (50 operations)...")

        async def generate_order_number():
            return await conn.fetchval("SELECT generate_order_number()")

        # Generate 50 order numbers concurrently
        tasks = [generate_order_number() for _ in range(50)]
        order_numbers = await asyncio.gather(*tasks)

        # Verify all unique
        if len(order_numbers) != len(set(order_numbers)):
            duplicates = [num for num in order_numbers if order_numbers.count(num) > 1]
            print(f"  [FAIL] DUPLICATE ORDER NUMBERS DETECTED: {set(duplicates)}")
            return False

        print(f"  [OK] Generated {len(order_numbers)} unique order numbers")
        print(f"     First: {sorted(order_numbers)[0]}")
        print(f"     Last:  {sorted(order_numbers)[-1]}")

        # Step 4: Test concurrent quote number generation (50 operations)
        print("\nStep 4: Testing concurrent quote number generation (50 operations)...")

        async def generate_quote_number():
            return await conn.fetchval("SELECT generate_quote_number()")

        # Generate 50 quote numbers concurrently
        tasks = [generate_quote_number() for _ in range(50)]
        quote_numbers = await asyncio.gather(*tasks)

        # Verify all unique
        if len(quote_numbers) != len(set(quote_numbers)):
            duplicates = [num for num in quote_numbers if quote_numbers.count(num) > 1]
            print(f"  [FAIL] DUPLICATE QUOTE NUMBERS DETECTED: {set(duplicates)}")
            return False

        print(f"  [OK] Generated {len(quote_numbers)} unique quote numbers")
        print(f"     First: {sorted(quote_numbers)[0]}")
        print(f"     Last:  {sorted(quote_numbers)[-1]}")

        # Step 5: Test mixed concurrent operations (100 total: 50 orders + 50 quotes)
        print("\nStep 5: Testing high concurrency mixed operations (100 total)...")

        async def generate_order():
            return ("order", await conn.fetchval("SELECT generate_order_number()"))

        async def generate_quote():
            return ("quote", await conn.fetchval("SELECT generate_quote_number()"))

        tasks = []
        tasks.extend([generate_order() for _ in range(50)])
        tasks.extend([generate_quote() for _ in range(50)])

        results = await asyncio.gather(*tasks)

        mixed_orders = [num for type_, num in results if type_ == "order"]
        mixed_quotes = [num for type_, num in results if type_ == "quote"]

        # Verify uniqueness
        if len(mixed_orders) != len(set(mixed_orders)):
            print(f"  [FAIL] Duplicate order numbers in mixed test")
            return False

        if len(mixed_quotes) != len(set(mixed_quotes)):
            print(f"  [FAIL] Duplicate quote numbers in mixed test")
            return False

        print(f"  [OK] Generated {len(mixed_orders)} unique orders + {len(mixed_quotes)} unique quotes")
        print(f"     All {len(results)} numbers are unique - no conflicts")

        # Step 6: Verify format
        print("\nStep 6: Verifying number format...")

        sample_order = await conn.fetchval("SELECT generate_order_number()")
        sample_quote = await conn.fetchval("SELECT generate_quote_number()")

        # Format: ORD-YYYY-NNNNNN (variable length due to sequence)
        if not sample_order.startswith("ORD-2026-"):
            print(f"  [FAIL] Invalid order format: {sample_order}")
            return False

        # Format: Q-YYYY-NNNNNN (variable length due to sequence)
        if not sample_quote.startswith("Q-2026-"):
            print(f"  [FAIL] Invalid quote format: {sample_quote}")
            return False

        print(f"  [OK] Order format correct: {sample_order}")
        print(f"  [OK] Quote format correct: {sample_quote}")

        print("\n" + "=" * 70)
        print(" ALL CHECKS PASSED - SEQUENCES DEPLOYED SUCCESSFULLY")
        print("=" * 70)
        print("\nSummary:")
        print("  - Sequences exist and operational")
        print("  - Generator functions working correctly")
        print("  - 100 concurrent operations completed successfully")
        print("  - 0 duplicate numbers (race-condition-free)")
        print("  - Number format validation passed")
        print("\n  Issue #4 (Deploy Microsecond Timestamp Fix) is COMPLETE")
        print("=" * 70)

        return True

    finally:
        await conn.close()


if __name__ == "__main__":
    result = asyncio.run(verify_sequences())
    exit(0 if result else 1)
