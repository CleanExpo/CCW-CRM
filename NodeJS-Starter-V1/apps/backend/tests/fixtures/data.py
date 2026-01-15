"""
Test data fixtures for API tests.

These fixtures use the existing seeded data from seed_demo.py.
No new data is created - tests use the pre-seeded database.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import (
    Customer,
    Order,
    Product,
    Quote,
)
from src.db.models import User


@pytest.fixture(scope="function")
async def test_users(db_session: AsyncSession) -> list[User]:
    """Fetch existing test users from seeded database."""
    result = await db_session.execute(
        select(User).where(
            User.email.in_(["admin@demo.com", "sales@demo.com", "warehouse@demo.com"])
        )
    )
    users = list(result.scalars().all())

    if not users:
        pytest.fail(
            "Test users not found in database. Run 'python seed_demo.py' to seed the database first."
        )

    return users


@pytest.fixture(scope="function")
async def test_products(db_session: AsyncSession) -> list[Product]:
    """Fetch existing test products from seeded database."""
    result = await db_session.execute(select(Product).limit(20))
    products = list(result.scalars().all())

    if not products:
        pytest.fail(
            "Test products not found in database. Run 'python seed_demo.py' to seed the database first."
        )

    return products


@pytest.fixture(scope="function")
async def test_customers(db_session: AsyncSession) -> list[Customer]:
    """Fetch existing test customers from seeded database."""
    result = await db_session.execute(select(Customer).limit(10))
    customers = list(result.scalars().all())

    if not customers:
        pytest.fail(
            "Test customers not found in database. Run 'python seed_demo.py' to seed the database first."
        )

    return customers


@pytest.fixture(scope="function")
async def test_orders(db_session: AsyncSession) -> list[Order]:
    """Fetch existing test orders from seeded database."""
    result = await db_session.execute(select(Order).limit(10))
    orders = list(result.scalars().all())

    if not orders:
        pytest.fail(
            "Test orders not found in database. Run 'python seed_demo.py' to seed the database first."
        )

    return orders


@pytest.fixture(scope="function")
async def test_quotes(db_session: AsyncSession) -> list[Quote]:
    """Fetch existing test quotes from seeded database."""
    result = await db_session.execute(select(Quote).limit(10))
    quotes = list(result.scalars().all())

    if not quotes:
        pytest.fail(
            "Test quotes not found in database. Run 'python seed_demo.py' to seed the database first."
        )

    return quotes


@pytest.fixture(scope="function")
async def seed_all_test_data(
    test_users: list[User],
    test_products: list[Product],
    test_customers: list[Customer],
    test_orders: list[Order],
    test_quotes: list[Quote],
) -> dict:
    """
    Convenience fixture that ensures all test data is loaded.

    Returns a dictionary with all test data for easy access.
    """
    return {
        "users": test_users,
        "products": test_products,
        "customers": test_customers,
        "orders": test_orders,
        "quotes": test_quotes,
    }
