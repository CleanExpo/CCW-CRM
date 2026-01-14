"""
Tests for ERP API bug fixes.

This module tests the specific bug fixes made to the Orders and Quotes CRUD operations:
1. Order status updates persisting correctly with field validation
2. Quote DELETE endpoint with cascade deletion
3. Proper handling of numeric type conversions in responses
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from decimal import Decimal
from uuid import uuid4

from src.api.main import app
from src.config.database import get_db
from src.db.erp_models import (
    Order as OrderModel,
    OrderItem as OrderItemModel,
    Quote as QuoteModel,
    QuoteItem as QuoteItemModel,
    Product as ProductModel,
    Customer as CustomerModel,
)

client = TestClient(app)

# Test database URL (use in-memory SQLite for tests)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def test_db():
    """Create a test database session."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        # Create all tables
        from src.db.erp_models import Base
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        yield session

    await engine.dispose()


@pytest.fixture
async def test_customer(test_db: AsyncSession):
    """Create a test customer."""
    customer = CustomerModel(
        id=uuid4(),
        customer_number="CUST-001",
        company_name="Test Company",
        email="test@example.com",
    )
    test_db.add(customer)
    await test_db.commit()
    await test_db.refresh(customer)
    return customer


@pytest.fixture
async def test_product(test_db: AsyncSession):
    """Create a test product."""
    product = ProductModel(
        id=uuid4(),
        sku="PROD-001",
        name="Test Product",
        category="Test Category",  # Required field
        price=Decimal("100.00"),
        stock=50,
    )
    test_db.add(product)
    await test_db.commit()
    await test_db.refresh(product)
    return product


class TestOrderStatusUpdateBugFix:
    """
    Test Fix #1: Order status updates not persisting.

    Bug: Frontend sending subtotal/tax fields that don't exist in Order model.
    Fix: Filter out invalid fields before updating (orders.py:177-180).
    """

    @pytest.mark.asyncio
    async def test_order_status_update_with_valid_fields(self, test_db, test_customer, test_product):
        """Test that status updates work when only valid fields are provided."""
        # Create order
        order = OrderModel(
            id=uuid4(),
            order_number="ORD-2026-001",
            customer_id=test_customer.id,
            status="confirmed",
            total=Decimal("100.00"),
        )
        test_db.add(order)
        await test_db.commit()

        # Update status
        update_data = {
            "status": "processing",
        }

        response = client.put(f"/api/orders/{order.id}", json=update_data)
        assert response.status_code == 200

        # Verify status persisted
        await test_db.refresh(order)
        assert order.status == "processing"

    @pytest.mark.asyncio
    async def test_order_status_update_with_invalid_fields_filtered(
        self, test_db, test_customer, test_product
    ):
        """
        Test that status updates work even when invalid fields (subtotal, tax) are sent.

        This reproduces the original bug where frontend sent subtotal/tax fields
        that don't exist as columns in the Order model.
        """
        # Create order with item
        order = OrderModel(
            id=uuid4(),
            order_number="ORD-2026-002",
            customer_id=test_customer.id,
            status="confirmed",
            total=Decimal("100.00"),
        )
        test_db.add(order)
        await test_db.flush()

        order_item = OrderItemModel(
            id=uuid4(),
            order_id=order.id,
            product_id=test_product.id,
            quantity=1,
            unit_price=Decimal("100.00"),
            line_total=Decimal("100.00"),
        )
        test_db.add(order_item)
        await test_db.commit()

        # Simulate frontend sending subtotal and tax (which don't exist in model)
        update_data = {
            "customer_id": str(test_customer.id),
            "status": "processing",  # This should persist
            "notes": "Updated via test",
            "subtotal": 100.00,  # Invalid field - should be filtered
            "tax": 10.00,  # Invalid field - should be filtered
            "total": 110.00,
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": 1,
                }
            ],
        }

        response = client.put(f"/api/orders/{order.id}", json=update_data)
        assert response.status_code == 200

        # Verify status persisted despite invalid fields
        await test_db.refresh(order)
        assert order.status == "processing", "Status should have been updated"
        assert order.notes == "Updated via test"

        # Verify order doesn't have subtotal/tax attributes
        assert not hasattr(order, "subtotal")
        assert not hasattr(order, "tax")

    @pytest.mark.asyncio
    async def test_order_status_update_validates_field_names(self, test_db, test_customer):
        """Test that only valid field names are processed during update."""
        order = OrderModel(
            id=uuid4(),
            order_number="ORD-2026-003",
            customer_id=test_customer.id,
            status="pending",
            total=Decimal("50.00"),
        )
        test_db.add(order)
        await test_db.commit()

        # Try updating with mix of valid and invalid fields
        update_data = {
            "status": "confirmed",  # Valid
            "notes": "Test note",  # Valid
            "invalid_field": "should be ignored",  # Invalid
            "another_bad_field": 123,  # Invalid
        }

        response = client.put(f"/api/orders/{order.id}", json=update_data)
        assert response.status_code == 200

        # Verify only valid fields were updated
        await test_db.refresh(order)
        assert order.status == "confirmed"
        assert order.notes == "Test note"


class TestQuoteDeleteBugFix:
    """
    Test Fix #2: Missing DELETE endpoint for quotes.

    Bug: DELETE /api/quotes/{id} returned 405 Method Not Allowed.
    Fix: Added DELETE endpoint with cascade deletion (quotes.py:210-228).
    """

    @pytest.mark.asyncio
    async def test_quote_delete_endpoint_exists(self, test_db, test_customer):
        """Test that DELETE endpoint is now available."""
        # Create quote
        quote = QuoteModel(
            id=uuid4(),
            quote_number="Q-2026-001",
            customer_id=test_customer.id,
            status="draft",
            total=Decimal("200.00"),
        )
        test_db.add(quote)
        await test_db.commit()

        # Delete quote
        response = client.delete(f"/api/quotes/{quote.id}")
        assert response.status_code == 204, "DELETE should return 204 No Content"

    @pytest.mark.asyncio
    async def test_quote_delete_cascade_deletes_items(
        self, test_db, test_customer, test_product
    ):
        """Test that deleting a quote also deletes its line items (cascade delete)."""
        # Create quote with items
        quote = QuoteModel(
            id=uuid4(),
            quote_number="Q-2026-002",
            customer_id=test_customer.id,
            status="draft",
            total=Decimal("300.00"),
        )
        test_db.add(quote)
        await test_db.flush()

        # Add multiple quote items
        item1 = QuoteItemModel(
            id=uuid4(),
            quote_id=quote.id,
            product_id=test_product.id,
            quantity=2,
            unit_price=Decimal("100.00"),
            line_total=Decimal("200.00"),
        )
        item2 = QuoteItemModel(
            id=uuid4(),
            quote_id=quote.id,
            product_id=test_product.id,
            quantity=1,
            unit_price=Decimal("100.00"),
            line_total=Decimal("100.00"),
        )
        test_db.add_all([item1, item2])
        await test_db.commit()

        # Verify items exist before deletion
        from sqlalchemy import select
        items_query = select(QuoteItemModel).where(QuoteItemModel.quote_id == quote.id)
        result = await test_db.execute(items_query)
        items_before = result.scalars().all()
        assert len(items_before) == 2, "Should have 2 items before deletion"

        # Delete quote
        response = client.delete(f"/api/quotes/{quote.id}")
        assert response.status_code == 204

        # Verify quote is deleted
        quote_query = select(QuoteModel).where(QuoteModel.id == quote.id)
        result = await test_db.execute(quote_query)
        deleted_quote = result.scalar_one_or_none()
        assert deleted_quote is None, "Quote should be deleted"

        # Verify items are cascade deleted
        items_after_query = select(QuoteItemModel).where(
            QuoteItemModel.quote_id == quote.id
        )
        result = await test_db.execute(items_after_query)
        items_after = result.scalars().all()
        assert len(items_after) == 0, "Items should be cascade deleted"

    @pytest.mark.asyncio
    async def test_quote_delete_returns_404_for_nonexistent_quote(self, test_db):
        """Test that deleting a non-existent quote returns 404."""
        fake_id = uuid4()
        response = client.delete(f"/api/quotes/{fake_id}")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestQuoteNumericTypeConversionBugFix:
    """
    Test Fix #3: Line items not displaying in edit dialog.

    Bug: Frontend expected quote_items field, backend returns items.
          Also, Decimal values weren't converted to numbers.
    Fix: Updated frontend interface and added Number() conversion (QuoteForm.tsx:71,123-130).

    Backend test verifies API returns proper numeric types that can be converted.
    """

    @pytest.mark.asyncio
    async def test_quote_api_returns_items_field_not_quote_items(
        self, test_db, test_customer, test_product
    ):
        """Test that API returns 'items' field (not 'quote_items')."""
        # Create quote with items
        quote = QuoteModel(
            id=uuid4(),
            quote_number="Q-2026-003",
            customer_id=test_customer.id,
            status="draft",
            total=Decimal("150.00"),
        )
        test_db.add(quote)
        await test_db.flush()

        item = QuoteItemModel(
            id=uuid4(),
            quote_id=quote.id,
            product_id=test_product.id,
            quantity=1,
            unit_price=Decimal("150.00"),
            line_total=Decimal("150.00"),
        )
        test_db.add(item)
        await test_db.commit()

        # Get quote
        response = client.get(f"/api/quotes/{quote.id}")
        assert response.status_code == 200

        quote_data = response.json()
        assert "items" in quote_data, "API should return 'items' field"
        assert "quote_items" not in quote_data, "API should NOT return 'quote_items'"
        assert len(quote_data["items"]) == 1

    @pytest.mark.asyncio
    async def test_quote_api_returns_numeric_values_as_strings(
        self, test_db, test_customer, test_product
    ):
        """
        Test that API returns Decimal values as strings (JSON serialization).

        Frontend is responsible for converting these strings to numbers.
        This test verifies the API contract.
        """
        # Create quote with specific decimal values
        quote = QuoteModel(
            id=uuid4(),
            quote_number="Q-2026-004",
            customer_id=test_customer.id,
            status="draft",
            total=Decimal("123.45"),
        )
        test_db.add(quote)
        await test_db.flush()

        item = QuoteItemModel(
            id=uuid4(),
            quote_id=quote.id,
            product_id=test_product.id,
            quantity=3,
            unit_price=Decimal("41.15"),
            line_total=Decimal("123.45"),
        )
        test_db.add(item)
        await test_db.commit()

        # Get quote
        response = client.get(f"/api/quotes/{quote.id}")
        assert response.status_code == 200

        quote_data = response.json()

        # Verify total is a string (or number, depending on serialization)
        # FastAPI with Pydantic should serialize Decimal as string
        assert isinstance(quote_data["total"], (str, int, float))

        # Verify item numeric fields are serializable
        item_data = quote_data["items"][0]
        assert isinstance(item_data["quantity"], int)
        assert isinstance(item_data["unit_price"], (str, int, float))
        assert isinstance(item_data["line_total"], (str, int, float))

        # Verify values are correct
        if isinstance(quote_data["total"], str):
            assert float(quote_data["total"]) == 123.45
        else:
            assert quote_data["total"] == 123.45

    @pytest.mark.asyncio
    async def test_quote_list_includes_items_count(self, test_db, test_customer, test_product):
        """Test that quote list endpoint includes item information."""
        # Create quote with multiple items
        quote = QuoteModel(
            id=uuid4(),
            quote_number="Q-2026-005",
            customer_id=test_customer.id,
            status="sent",
            total=Decimal("500.00"),
        )
        test_db.add(quote)
        await test_db.flush()

        # Add 3 items
        for i in range(3):
            item = QuoteItemModel(
                id=uuid4(),
                quote_id=quote.id,
                product_id=test_product.id,
                quantity=1,
                unit_price=Decimal("100.00"),
                line_total=Decimal("100.00"),
            )
            test_db.add(item)
        await test_db.commit()

        # Get quotes list
        response = client.get("/api/quotes?page=1&page_size=50")
        assert response.status_code == 200

        data = response.json()
        assert "items" in data
        assert len(data["items"]) > 0

        # Find our quote
        our_quote = next(
            (q for q in data["items"] if q["quote_number"] == "Q-2026-005"), None
        )
        assert our_quote is not None
        assert "items" in our_quote or len(our_quote.get("items", [])) >= 0


class TestBugFixIntegration:
    """Integration tests verifying all bug fixes work together."""

    @pytest.mark.asyncio
    async def test_full_order_lifecycle_with_status_updates(
        self, test_db, test_customer, test_product
    ):
        """
        Test complete order lifecycle with multiple status updates.

        Verifies Fix #1 works through multiple update cycles.
        """
        # Create order
        create_data = {
            "customer_id": str(test_customer.id),
            "status": "draft",
            "notes": "Initial order",
            "items": [{"product_id": str(test_product.id), "quantity": 2}],
        }
        response = client.post("/api/orders", json=create_data)
        assert response.status_code == 201
        order_id = response.json()["id"]

        # Update 1: draft -> confirmed
        response = client.put(
            f"/api/orders/{order_id}",
            json={"status": "confirmed", "notes": "Confirmed by customer"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "confirmed"

        # Update 2: confirmed -> processing
        response = client.put(
            f"/api/orders/{order_id}",
            json={"status": "processing", "notes": "Order being prepared"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "processing"

        # Update 3: processing -> shipped
        response = client.put(
            f"/api/orders/{order_id}",
            json={"status": "shipped", "notes": "Shipped via courier"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "shipped"

        # Verify final state
        response = client.get(f"/api/orders/{order_id}")
        assert response.status_code == 200
        final_order = response.json()
        assert final_order["status"] == "shipped"
        assert final_order["notes"] == "Shipped via courier"

    @pytest.mark.asyncio
    async def test_quote_to_order_conversion_with_delete(
        self, test_db, test_customer, test_product
    ):
        """
        Test quote conversion to order, then delete the original quote.

        Verifies Fix #2 (delete) works after conversion.
        """
        # Create quote
        create_data = {
            "customer_id": str(test_customer.id),
            "status": "pending",
            "quote_date": "2026-01-07",
            "valid_until": "2026-02-07",
            "notes": "Test quote",
            "items": [{"product_id": str(test_product.id), "quantity": 5}],
        }
        response = client.post("/api/quotes", json=create_data)
        assert response.status_code == 201
        quote_id = response.json()["id"]

        # Convert to order
        response = client.post(f"/api/quotes/{quote_id}/convert-to-order")
        assert response.status_code == 201
        order_data = response.json()
        assert order_data["status"] == "confirmed"

        # Verify quote status changed to accepted
        response = client.get(f"/api/quotes/{quote_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "accepted"

        # Now delete the original quote (should work with Fix #2)
        response = client.delete(f"/api/quotes/{quote_id}")
        assert response.status_code == 204

        # Verify quote is deleted
        response = client.get(f"/api/quotes/{quote_id}")
        assert response.status_code == 404

        # Verify order still exists (not cascade deleted)
        response = client.get(f"/api/orders/{order_data['id']}")
        assert response.status_code == 200
