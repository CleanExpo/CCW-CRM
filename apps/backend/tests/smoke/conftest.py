"""Fixtures for smoke tests."""

import time

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import (
    Customer,
    Order,
    Product,
    Quote,
)


# Add timestamp for unique test data
@pytest.fixture(scope="session", autouse=True)
def add_timestamp():
    """Add timestamp to pytest for unique test data generation."""
    pytest.timestamp = int(time.time())


@pytest_asyncio.fixture(scope="function")
async def sample_product_id(db_session: AsyncSession) -> str:
    """Get a sample product ID from database."""
    result = await db_session.execute(
        select(Product).where(Product.is_active == True).limit(1)
    )
    product = result.scalar_one_or_none()
    if product:
        return str(product.id)
    # Fallback: create a test product
    test_product = Product(
        sku=f"SMOKE-TEST-{pytest.timestamp}",
        name="Smoke Test Product",
        category="HAND_TOOLS",
        price=99.99,
        cost=50.00,
        stock=100,
    )
    db_session.add(test_product)
    await db_session.commit()
    await db_session.refresh(test_product)
    return str(test_product.id)


@pytest_asyncio.fixture(scope="function")
async def deletable_product_id(db_session: AsyncSession) -> str:
    """Create a product that can be safely deleted."""
    test_product = Product(
        sku=f"DELETE-ME-{pytest.timestamp}-{time.time_ns()}",
        name="Deletable Test Product",
        category="HAND_TOOLS",
        price=1.00,
        cost=0.50,
        stock=1,
    )
    db_session.add(test_product)
    await db_session.commit()
    await db_session.refresh(test_product)
    return str(test_product.id)


@pytest_asyncio.fixture(scope="function")
async def sample_customer_id(db_session: AsyncSession) -> str:
    """Get a sample customer ID from database."""
    result = await db_session.execute(
        select(Customer).where(Customer.is_active == True).limit(1)
    )
    customer = result.scalar_one_or_none()
    if customer:
        return str(customer.id)
    # Fallback: create a test customer
    test_customer = Customer(
        customer_number=f"SMOKE-{pytest.timestamp}",
        company_name="Smoke Test Company",
        contact_name="Test Contact",
        email=f"smoke-test-{pytest.timestamp}@example.com",
    )
    db_session.add(test_customer)
    await db_session.commit()
    await db_session.refresh(test_customer)
    return str(test_customer.id)


@pytest_asyncio.fixture(scope="function")
async def deletable_customer_id(db_session: AsyncSession) -> str:
    """Create a customer that can be safely deleted."""
    test_customer = Customer(
        customer_number=f"DELETE-CUST-{pytest.timestamp}-{time.time_ns()}",
        company_name="Deletable Test Customer",
        contact_name="Delete Me",
        email=f"delete-{pytest.timestamp}-{time.time_ns()}@example.com",
    )
    db_session.add(test_customer)
    await db_session.commit()
    await db_session.refresh(test_customer)
    return str(test_customer.id)


@pytest_asyncio.fixture(scope="function")
async def sample_order_id(db_session: AsyncSession, sample_customer_id: str) -> str:
    """Get a sample order ID from database."""
    result = await db_session.execute(select(Order).limit(1))
    order = result.scalar_one_or_none()
    if order:
        return str(order.id)
    # Fallback: create a test order
    test_order = Order(
        order_number=f"SMOKE-ORD-{pytest.timestamp}",
        customer_id=sample_customer_id,
        status="draft",
        total=0,
    )
    db_session.add(test_order)
    await db_session.commit()
    await db_session.refresh(test_order)
    return str(test_order.id)


@pytest_asyncio.fixture(scope="function")
async def deletable_order_id(db_session: AsyncSession, sample_customer_id: str) -> str:
    """Create an order that can be safely deleted."""
    test_order = Order(
        order_number=f"SMOKE-ORD-{pytest.timestamp}",
        customer_id=sample_customer_id,
        status="draft",
    )
    db_session.add(test_order)
    await db_session.commit()
    await db_session.refresh(test_order)
    return str(test_order.id)


@pytest_asyncio.fixture(scope="function")
async def sample_quote_id(db_session: AsyncSession, sample_customer_id: str) -> str:
    """Get a sample quote ID from database."""
    result = await db_session.execute(select(Quote).limit(1))
    quote = result.scalar_one_or_none()
    if quote:
        return str(quote.id)
    # Fallback: create a test quote
    test_quote = Quote(
        quote_number=f"SMOKE-Q-{pytest.timestamp}",
        customer_id=sample_customer_id,
        status="draft",
        total=0,
    )
    db_session.add(test_quote)
    await db_session.commit()
    await db_session.refresh(test_quote)
    return str(test_quote.id)


@pytest_asyncio.fixture(scope="function")
async def deletable_quote_id(db_session: AsyncSession, sample_customer_id: str) -> str:
    """Create a quote that can be safely deleted."""
    test_quote = Quote(
        quote_number=f"SMOKE-Q-{pytest.timestamp}",
        customer_id=sample_customer_id,
        status="draft",
    )
    db_session.add(test_quote)
    await db_session.commit()
    await db_session.refresh(test_quote)
    return str(test_quote.id)


@pytest_asyncio.fixture(scope="function")
async def sample_supplier_id(db_session: AsyncSession) -> str:
    """Return dummy supplier ID (supplier model not in demo database)."""
    return "00000000-0000-0000-0000-000000000010"


@pytest_asyncio.fixture(scope="function")
async def deletable_supplier_id(db_session: AsyncSession) -> str:
    """Return dummy supplier ID (supplier model not in demo database)."""
    return "00000000-0000-0000-0000-000000000011"


@pytest_asyncio.fixture(scope="function")
async def sample_po_id(db_session: AsyncSession) -> str:
    """Get a sample purchase order ID - returns dummy ID if none exist."""
    return "00000000-0000-0000-0000-000000000003"


@pytest_asyncio.fixture(scope="function")
async def deletable_po_id(db_session: AsyncSession) -> str:
    """Return dummy ID for deletable PO."""
    return "00000000-0000-0000-0000-000000000004"


@pytest_asyncio.fixture(scope="function")
async def sample_shipment_id(db_session: AsyncSession) -> str:
    """Return dummy shipment ID."""
    return "00000000-0000-0000-0000-000000000005"


@pytest_asyncio.fixture(scope="function")
async def sample_container_id(db_session: AsyncSession) -> str:
    """Return dummy container ID."""
    return "00000000-0000-0000-0000-000000000006"


@pytest_asyncio.fixture(scope="function")
async def sample_service_request_id(db_session: AsyncSession) -> str:
    """Return dummy service request ID."""
    return "00000000-0000-0000-0000-000000000007"
