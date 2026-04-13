"""Unit tests for order/quote number generation."""
import asyncio

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.routes.orders import generate_order_number
from src.api.routes.quotes import generate_quote_number
from src.config.database import AsyncSessionLocal


@pytest.fixture
async def db():
    """Provide a database session for tests."""
    async with AsyncSessionLocal() as session:
        yield session


@pytest.mark.asyncio
async def test_order_number_format(db: AsyncSession):
    """Test order number format is correct."""
    order_num = await generate_order_number(db)
    assert order_num.startswith("ORD-2026-"), f"Order number {order_num} should start with ORD-2026-"
    # Length: ORD-YYYY-NNNNNN = 3 + 1 + 4 + 1 + 6 = 15 characters
    assert len(order_num) == 15, f"Order number {order_num} should be 15 characters (ORD-2026-000001)"


@pytest.mark.asyncio
async def test_quote_number_format(db: AsyncSession):
    """Test quote number format is correct."""
    quote_num = await generate_quote_number(db)
    assert quote_num.startswith("Q-2026-"), f"Quote number {quote_num} should start with Q-2026-"
    # Length: Q-YYYY-NNNNNN = 1 + 1 + 4 + 1 + 6 = 13 characters
    assert len(quote_num) == 13, f"Quote number {quote_num} should be 13 characters (Q-2026-000001)"


@pytest.mark.asyncio
async def test_order_number_uniqueness_sequential(db: AsyncSession):
    """Test 100 sequential order number generations are all unique."""
    numbers = []
    for _ in range(100):
        num = await generate_order_number(db)
        numbers.append(num)

    assert len(numbers) == len(set(numbers)), "All order numbers should be unique"


@pytest.mark.asyncio
async def test_quote_number_uniqueness_sequential(db: AsyncSession):
    """Test 100 sequential quote number generations are all unique."""
    numbers = []
    for _ in range(100):
        num = await generate_quote_number(db)
        numbers.append(num)

    assert len(numbers) == len(set(numbers)), "All quote numbers should be unique"


@pytest.mark.asyncio
async def test_order_number_uniqueness_concurrent(db: AsyncSession):
    """Test 100 concurrent order number generations are all unique."""

    async def generate():
        # Create a new session for each concurrent request
        async with AsyncSessionLocal() as session:
            return await generate_order_number(session)

    numbers = await asyncio.gather(*[generate() for _ in range(100)])
    assert len(numbers) == len(set(numbers)), f"All order numbers should be unique, got {len(set(numbers))}/{len(numbers)}"


@pytest.mark.asyncio
async def test_quote_number_uniqueness_concurrent(db: AsyncSession):
    """Test 100 concurrent quote number generations are all unique."""

    async def generate():
        # Create a new session for each concurrent request
        async with AsyncSessionLocal() as session:
            return await generate_quote_number(session)

    numbers = await asyncio.gather(*[generate() for _ in range(100)])
    assert len(numbers) == len(set(numbers)), f"All quote numbers should be unique, got {len(set(numbers))}/{len(numbers)}"


@pytest.mark.asyncio
async def test_order_number_incremental(db: AsyncSession):
    """Test order numbers increment properly."""
    num1 = await generate_order_number(db)
    num2 = await generate_order_number(db)

    # Extract numeric portion (last 6 digits)
    num1_int = int(num1.split('-')[-1])
    num2_int = int(num2.split('-')[-1])

    assert num2_int == num1_int + 1, f"Second number {num2_int} should be {num1_int + 1}"


@pytest.mark.asyncio
async def test_quote_number_incremental(db: AsyncSession):
    """Test quote numbers increment properly."""
    num1 = await generate_quote_number(db)
    num2 = await generate_quote_number(db)

    # Extract numeric portion (last 6 digits)
    num1_int = int(num1.split('-')[-1])
    num2_int = int(num2.split('-')[-1])

    assert num2_int == num1_int + 1, f"Second number {num2_int} should be {num1_int + 1}"


@pytest.mark.asyncio
async def test_stress_test_1000_concurrent(db: AsyncSession):
    """Stress test: 1000 concurrent order/quote generations."""

    async def generate_both():
        async with AsyncSessionLocal() as session:
            order_num = await generate_order_number(session)
            quote_num = await generate_quote_number(session)
            return order_num, quote_num

    results = await asyncio.gather(*[generate_both() for _ in range(1000)])

    order_nums = [r[0] for r in results]
    quote_nums = [r[1] for r in results]

    # Verify all order numbers are unique
    assert len(order_nums) == len(set(order_nums)), f"All order numbers should be unique: {len(set(order_nums))}/1000"

    # Verify all quote numbers are unique
    assert len(quote_nums) == len(set(quote_nums)), f"All quote numbers should be unique: {len(set(quote_nums))}/1000"

    print("\n✅ Stress test passed: 1000 concurrent generations, all unique")
