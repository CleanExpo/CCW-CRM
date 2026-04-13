"""
Concurrent test to verify sequence-based number generation is race-condition-free.

This test creates orders and quotes concurrently to verify that:
1. All generated numbers are unique (no duplicates)
2. No conflicts occur even with high concurrency
3. Sequences are atomic and thread-safe
"""

import asyncio
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from src.api.main import app
from src.config.database import get_async_db
from src.db.demo_models import Customer as CustomerModel
from src.db.demo_models import Product as ProductModel


@pytest.mark.asyncio
async def test_concurrent_order_number_generation():
    """Test that order numbers are unique under concurrent creation."""

    # Setup: Create a customer and product
    async for db in get_async_db():
        # Get or create customer
        customer_query = select(CustomerModel).limit(1)
        result = await db.execute(customer_query)
        customer = result.scalar_one_or_none()

        if not customer:
            customer = CustomerModel(
                id=uuid4(),
                customer_number=f"CUST-{uuid4().hex[:8].upper()}",
                company_name="Test Company",
                contact_name="Test Contact",
                email="test@example.com",
                phone="555-1234",
                address="123 Test St",
                city="Test City",
                state="CA",
                postal_code="12345",
                country="USA",
            )
            db.add(customer)
            await db.commit()

        # Get or create product
        product_query = select(ProductModel).limit(1)
        result = await db.execute(product_query)
        product = result.scalar_one_or_none()

        if not product:
            product = ProductModel(
                id=uuid4(),
                sku=f"SKU-{uuid4().hex[:8].upper()}",
                name="Test Product",
                category="HAND_TOOLS",
                price=99.99,
                cost=50.00,
                stock=10000,
            )
            db.add(product)
            await db.commit()

        customer_id = str(customer.id)
        product_id = str(product.id)
        break

    # Create 20 orders concurrently
    num_concurrent = 20

    async def create_order(index: int) -> dict:
        """Create a single order via API."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Login first
            login_response = await client.post(
                "/api/auth/login",
                json={"email": "admin@demo.com", "password": "demo123"}
            )
            assert login_response.status_code == 200
            token = login_response.json()["access_token"]

            # Create order
            response = await client.post(
                "/api/orders",
                json={
                    "customer_id": customer_id,
                    "status": "draft",
                    "notes": f"Concurrent test order {index}",
                    "items": [
                        {
                            "product_id": product_id,
                            "quantity": 1,
                        }
                    ]
                },
                headers={"Authorization": f"Bearer {token}"}
            )

            assert response.status_code == 201, f"Order {index} creation failed: {response.status_code} - {response.text}"
            return response.json()

    # Execute all order creations concurrently
    tasks = [create_order(i) for i in range(num_concurrent)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Verify results
    order_numbers = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            pytest.fail(f"Order {i} creation raised exception: {result}")

        order_numbers.append(result["order_number"])

    # Verify all order numbers are unique
    assert len(order_numbers) == num_concurrent, f"Expected {num_concurrent} orders, got {len(order_numbers)}"
    assert len(set(order_numbers)) == num_concurrent, f"Duplicate order numbers detected: {order_numbers}"

    print(f"\n✅ Created {num_concurrent} orders concurrently - all numbers unique:")
    for num in sorted(order_numbers):
        print(f"   {num}")


@pytest.mark.asyncio
async def test_concurrent_quote_number_generation():
    """Test that quote numbers are unique under concurrent creation."""

    # Setup: Create a customer and product
    async for db in get_async_db():
        # Get or create customer
        customer_query = select(CustomerModel).limit(1)
        result = await db.execute(customer_query)
        customer = result.scalar_one_or_none()

        if not customer:
            customer = CustomerModel(
                id=uuid4(),
                customer_number=f"CUST-{uuid4().hex[:8].upper()}",
                company_name="Test Company",
                contact_name="Test Contact",
                email="test@example.com",
                phone="555-1234",
                address="123 Test St",
                city="Test City",
                state="CA",
                postal_code="12345",
                country="USA",
            )
            db.add(customer)
            await db.commit()

        # Get or create product
        product_query = select(ProductModel).limit(1)
        result = await db.execute(product_query)
        product = result.scalar_one_or_none()

        if not product:
            product = ProductModel(
                id=uuid4(),
                sku=f"SKU-{uuid4().hex[:8].upper()}",
                name="Test Product",
                category="HAND_TOOLS",
                price=99.99,
                cost=50.00,
                stock=10000,
            )
            db.add(product)
            await db.commit()

        customer_id = str(customer.id)
        product_id = str(product.id)
        break

    # Create 20 quotes concurrently
    num_concurrent = 20

    async def create_quote(index: int) -> dict:
        """Create a single quote via API."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Login first
            login_response = await client.post(
                "/api/auth/login",
                json={"email": "admin@demo.com", "password": "demo123"}
            )
            assert login_response.status_code == 200
            token = login_response.json()["access_token"]

            # Create quote
            valid_until = (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat()
            response = await client.post(
                "/api/quotes",
                json={
                    "customer_id": customer_id,
                    "status": "draft",
                    "valid_until": valid_until,
                    "notes": f"Concurrent test quote {index}",
                    "items": [
                        {
                            "product_id": product_id,
                            "quantity": 1,
                        }
                    ]
                },
                headers={"Authorization": f"Bearer {token}"}
            )

            assert response.status_code == 201, f"Quote {index} creation failed: {response.status_code} - {response.text}"
            return response.json()

    # Execute all quote creations concurrently
    tasks = [create_quote(i) for i in range(num_concurrent)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Verify results
    quote_numbers = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            pytest.fail(f"Quote {i} creation raised exception: {result}")

        quote_numbers.append(result["quote_number"])

    # Verify all quote numbers are unique
    assert len(quote_numbers) == num_concurrent, f"Expected {num_concurrent} quotes, got {len(quote_numbers)}"
    assert len(set(quote_numbers)) == num_concurrent, f"Duplicate quote numbers detected: {quote_numbers}"

    print(f"\n✅ Created {num_concurrent} quotes concurrently - all numbers unique:")
    for num in sorted(quote_numbers):
        print(f"   {num}")


@pytest.mark.asyncio
async def test_high_concurrency_mixed_operations():
    """Test order and quote creation under high concurrency (50 operations)."""

    # Setup: Create a customer and product
    async for db in get_async_db():
        # Get or create customer
        customer_query = select(CustomerModel).limit(1)
        result = await db.execute(customer_query)
        customer = result.scalar_one_or_none()

        if not customer:
            customer = CustomerModel(
                id=uuid4(),
                customer_number=f"CUST-{uuid4().hex[:8].upper()}",
                company_name="Test Company",
                contact_name="Test Contact",
                email="test@example.com",
                phone="555-1234",
                address="123 Test St",
                city="Test City",
                state="CA",
                postal_code="12345",
                country="USA",
            )
            db.add(customer)
            await db.commit()

        # Get or create product
        product_query = select(ProductModel).limit(1)
        result = await db.execute(product_query)
        product = result.scalar_one_or_none()

        if not product:
            product = ProductModel(
                id=uuid4(),
                sku=f"SKU-{uuid4().hex[:8].upper()}",
                name="Test Product",
                category="HAND_TOOLS",
                price=99.99,
                cost=50.00,
                stock=10000,
            )
            db.add(product)
            await db.commit()

        customer_id = str(customer.id)
        product_id = str(product.id)
        break

    num_orders = 25
    num_quotes = 25

    async def create_order(index: int) -> tuple[str, str]:
        """Create an order and return type and number."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            login_response = await client.post(
                "/api/auth/login",
                json={"email": "admin@demo.com", "password": "demo123"}
            )
            token = login_response.json()["access_token"]

            response = await client.post(
                "/api/orders",
                json={
                    "customer_id": customer_id,
                    "status": "draft",
                    "notes": f"High concurrency order {index}",
                    "items": [{"product_id": product_id, "quantity": 1}]
                },
                headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 201
            return ("order", response.json()["order_number"])

    async def create_quote(index: int) -> tuple[str, str]:
        """Create a quote and return type and number."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            login_response = await client.post(
                "/api/auth/login",
                json={"email": "admin@demo.com", "password": "demo123"}
            )
            token = login_response.json()["access_token"]

            valid_until = (datetime.now(timezone.utc) + timedelta(days=30)).date().isoformat()
            response = await client.post(
                "/api/quotes",
                json={
                    "customer_id": customer_id,
                    "status": "draft",
                    "valid_until": valid_until,
                    "notes": f"High concurrency quote {index}",
                    "items": [{"product_id": product_id, "quantity": 1}]
                },
                headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 201
            return ("quote", response.json()["quote_number"])

    # Mix orders and quotes
    tasks = []
    tasks.extend([create_order(i) for i in range(num_orders)])
    tasks.extend([create_quote(i) for i in range(num_quotes)])

    # Execute all concurrently
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Verify results
    order_numbers = []
    quote_numbers = []

    for result in results:
        if isinstance(result, Exception):
            pytest.fail(f"Operation raised exception: {result}")

        op_type, number = result
        if op_type == "order":
            order_numbers.append(number)
        else:
            quote_numbers.append(number)

    # Verify all numbers are unique
    assert len(order_numbers) == num_orders
    assert len(quote_numbers) == num_quotes
    assert len(set(order_numbers)) == num_orders, "Duplicate order numbers detected"
    assert len(set(quote_numbers)) == num_quotes, "Duplicate quote numbers detected"

    print(f"\n✅ Created {num_orders} orders and {num_quotes} quotes concurrently (50 total)")
    print(f"   All order numbers unique: {len(set(order_numbers))} unique")
    print(f"   All quote numbers unique: {len(set(quote_numbers))} unique")
    print(f"   Sample order numbers: {', '.join(sorted(order_numbers)[:5])}")
    print(f"   Sample quote numbers: {', '.join(sorted(quote_numbers)[:5])}")
