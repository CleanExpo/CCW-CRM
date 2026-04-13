"""
Test data fixtures for API tests.

These fixtures use the existing seeded data from seed_demo.py.
No new data is created - tests use the pre-seeded database.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.container_models import Container
from src.db.demo_models import (
    Customer,
    Order,
    Product,
    Quote,
)
from src.db.inventory_models import (
    InboundShipment,
    PurchaseOrder,
    Supplier,
)
from src.db.models import User
from src.db.service_models import ServiceRequest


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


# ==================== Individual Sample Fixtures ====================
# These return single IDs for use in smoke tests


@pytest.fixture(scope="function")
async def sample_product_id(test_products: list[Product]) -> str:
    """Get a sample product ID for testing."""
    return str(test_products[0].id)


@pytest.fixture(scope="function")
async def sample_customer_id(test_customers: list[Customer]) -> str:
    """Get a sample customer ID for testing."""
    return str(test_customers[0].id)


@pytest.fixture(scope="function")
async def sample_order_id(test_orders: list[Order]) -> str:
    """Get a sample order ID for testing."""
    return str(test_orders[0].id)


@pytest.fixture(scope="function")
async def sample_quote_id(test_quotes: list[Quote]) -> str:
    """Get a sample quote ID for testing."""
    return str(test_quotes[0].id)


@pytest.fixture(scope="function")
async def sample_supplier_id(db_session: AsyncSession) -> str:
    """Get a sample supplier ID for testing."""
    result = await db_session.execute(select(Supplier).limit(1))
    supplier = result.scalar_one_or_none()
    if not supplier:
        pytest.fail("No suppliers found in database. Run seed script first.")
    return str(supplier.id)


@pytest.fixture(scope="function")
async def sample_po_id(db_session: AsyncSession) -> str:
    """Get a sample purchase order ID for testing."""
    result = await db_session.execute(select(PurchaseOrder).limit(1))
    po = result.scalar_one_or_none()
    if not po:
        pytest.fail("No purchase orders found in database. Run seed script first.")
    return str(po.id)


@pytest.fixture(scope="function")
async def sample_shipment_id(db_session: AsyncSession) -> str:
    """Get a sample shipment ID for testing."""
    result = await db_session.execute(select(InboundShipment).limit(1))
    shipment = result.scalar_one_or_none()
    if not shipment:
        # Return a fake ID if no shipments exist (endpoint may not be implemented)
        return "00000000-0000-0000-0000-000000000000"
    return str(shipment.id)


@pytest.fixture(scope="function")
async def sample_container_id(db_session: AsyncSession) -> str:
    """Get a sample container ID for testing."""
    result = await db_session.execute(select(Container).limit(1))
    container = result.scalar_one_or_none()
    if not container:
        # Return a fake ID if no containers exist
        return "00000000-0000-0000-0000-000000000000"
    return str(container.id)


@pytest.fixture(scope="function")
async def sample_service_request_id(db_session: AsyncSession) -> str:
    """Get a sample service request ID for testing."""
    result = await db_session.execute(select(ServiceRequest).limit(1))
    service_request = result.scalar_one_or_none()
    if not service_request:
        # Return a fake ID if no service requests exist
        return "00000000-0000-0000-0000-000000000000"
    return str(service_request.id)


# ==================== Deletable Fixtures ====================
# These return IDs of items that can be safely deleted in tests


@pytest.fixture(scope="function")
async def deletable_product_id(test_products: list[Product]) -> str:
    """Get a deletable product ID for testing (uses last product in list)."""
    if len(test_products) < 2:
        pytest.fail("Need at least 2 products for delete tests")
    return str(test_products[-1].id)


@pytest.fixture(scope="function")
async def deletable_customer_id(test_customers: list[Customer]) -> str:
    """Get a deletable customer ID for testing (uses last customer in list)."""
    if len(test_customers) < 2:
        pytest.fail("Need at least 2 customers for delete tests")
    return str(test_customers[-1].id)


@pytest.fixture(scope="function")
async def deletable_order_id(test_orders: list[Order]) -> str:
    """Get a deletable order ID for testing (uses last order in list)."""
    if len(test_orders) < 2:
        pytest.fail("Need at least 2 orders for delete tests")
    return str(test_orders[-1].id)


@pytest.fixture(scope="function")
async def deletable_quote_id(test_quotes: list[Quote]) -> str:
    """Get a deletable quote ID for testing (uses last quote in list)."""
    if len(test_quotes) < 2:
        pytest.fail("Need at least 2 quotes for delete tests")
    return str(test_quotes[-1].id)


@pytest.fixture(scope="function")
async def deletable_supplier_id(db_session: AsyncSession) -> str:
    """Get a deletable supplier ID for testing."""
    result = await db_session.execute(select(Supplier).offset(1).limit(1))
    supplier = result.scalar_one_or_none()
    if not supplier:
        pytest.fail("Need at least 2 suppliers for delete tests")
    return str(supplier.id)


@pytest.fixture(scope="function")
async def deletable_po_id(db_session: AsyncSession) -> str:
    """Get a deletable purchase order ID for testing."""
    result = await db_session.execute(select(PurchaseOrder).offset(1).limit(1))
    po = result.scalar_one_or_none()
    if not po:
        pytest.fail("Need at least 2 purchase orders for delete tests")
    return str(po.id)
