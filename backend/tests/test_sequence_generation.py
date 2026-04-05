"""
Test PostgreSQL SEQUENCE-based number generation for race-condition-free operation.

This test verifies that the database-level SEQUENCE functions generate unique
order and quote numbers even under concurrent load.
"""

import asyncio
import pytest
from sqlalchemy import text
from src.config.database import get_async_db


@pytest.mark.asyncio
async def test_concurrent_order_number_sequence():
    """Test order_number sequence generates unique numbers under concurrent access."""

    num_concurrent = 50

    async def generate_order_number() -> str:
        """Generate a single order number via database function."""
        async for db in get_async_db():
            result = await db.execute(text("SELECT generate_order_number()"))
            number = result.scalar()
            return number

    # Generate numbers concurrently
    tasks = [generate_order_number() for _ in range(num_concurrent)]
    numbers = await asyncio.gather(*tasks)

    # Verify all numbers are unique
    assert len(numbers) == num_concurrent, f"Expected {num_concurrent} numbers, got {len(numbers)}"
    assert len(set(numbers)) == num_concurrent, f"Duplicate numbers detected: {sorted(numbers)}"

    print(f"\n✅ Generated {num_concurrent} order numbers concurrently - all unique")
    print(f"   Sample: {', '.join(sorted(numbers)[:10])}")
    print(f"   Last: {sorted(numbers)[-1]}")


@pytest.mark.asyncio
async def test_concurrent_quote_number_sequence():
    """Test quote_number sequence generates unique numbers under concurrent access."""

    num_concurrent = 50

    async def generate_quote_number() -> str:
        """Generate a single quote number via database function."""
        async for db in get_async_db():
            result = await db.execute(text("SELECT generate_quote_number()"))
            number = result.scalar()
            return number

    # Generate numbers concurrently
    tasks = [generate_quote_number() for _ in range(num_concurrent)]
    numbers = await asyncio.gather(*tasks)

    # Verify all numbers are unique
    assert len(numbers) == num_concurrent, f"Expected {num_concurrent} numbers, got {len(numbers)}"
    assert len(set(numbers)) == num_concurrent, f"Duplicate numbers detected: {sorted(numbers)}"

    print(f"\n✅ Generated {num_concurrent} quote numbers concurrently - all unique")
    print(f"   Sample: {', '.join(sorted(numbers)[:10])}")
    print(f"   Last: {sorted(numbers)[-1]}")


@pytest.mark.asyncio
async def test_high_concurrency_mixed_sequences():
    """Test both sequences under very high concurrency (100 operations)."""

    num_order_ops = 50
    num_quote_ops = 50

    async def generate_order_number() -> tuple[str, str]:
        """Generate order number and return type."""
        async for db in get_async_db():
            result = await db.execute(text("SELECT generate_order_number()"))
            return ("order", result.scalar())

    async def generate_quote_number() -> tuple[str, str]:
        """Generate quote number and return type."""
        async for db in get_async_db():
            result = await db.execute(text("SELECT generate_quote_number()"))
            return ("quote", result.scalar())

    # Mix order and quote generations
    tasks = []
    tasks.extend([generate_order_number() for _ in range(num_order_ops)])
    tasks.extend([generate_quote_number() for _ in range(num_quote_ops)])

    # Execute all concurrently
    results = await asyncio.gather(*tasks)

    # Separate by type
    order_numbers = [num for type_, num in results if type_ == "order"]
    quote_numbers = [num for type_, num in results if type_ == "quote"]

    # Verify uniqueness
    assert len(order_numbers) == num_order_ops
    assert len(quote_numbers) == num_quote_ops
    assert len(set(order_numbers)) == num_order_ops, "Duplicate order numbers"
    assert len(set(quote_numbers)) == num_quote_ops, "Duplicate quote numbers"

    print(f"\n✅ Generated {num_order_ops} order + {num_quote_ops} quote numbers concurrently (100 total)")
    print(f"   All order numbers unique: {len(set(order_numbers))} / {num_order_ops}")
    print(f"   All quote numbers unique: {len(set(quote_numbers))} / {num_quote_ops}")
    print(f"   Sample orders: {', '.join(sorted(order_numbers)[:5])}")
    print(f"   Sample quotes: {', '.join(sorted(quote_numbers)[:5])}")


@pytest.mark.asyncio
async def test_sequence_format():
    """Verify that generated numbers follow the expected format."""

    async for db in get_async_db():
        # Generate order number
        order_result = await db.execute(text("SELECT generate_order_number()"))
        order_num = order_result.scalar()

        # Generate quote number
        quote_result = await db.execute(text("SELECT generate_quote_number()"))
        quote_num = quote_result.scalar()

        # Verify format: ORD-YYYY-NNNNNN and Q-YYYY-NNNNNN
        # Format: ORD-2026-000001 (15 chars) and Q-2026-000001 (13 chars)
        assert order_num.startswith("ORD-2026-"), f"Invalid order format: {order_num}"
        assert len(order_num) == 15, f"Invalid order length: {order_num} (expected 15 chars: ORD-YYYY-NNNNNN)"

        assert quote_num.startswith("Q-2026-"), f"Invalid quote format: {quote_num}"
        assert len(quote_num) == 13, f"Invalid quote length: {quote_num} (expected 13 chars: Q-YYYY-NNNNNN)"

        print(f"\n✅ Number format validation passed")
        print(f"   Order: {order_num} (format: ORD-YYYY-NNNNNN, 15 chars)")
        print(f"   Quote: {quote_num} (format: Q-YYYY-NNNNNN, 13 chars)")
        break
