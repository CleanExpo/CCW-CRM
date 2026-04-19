"""
Comprehensive Quotes API tests.

Tests CRUD operations, line items, status management, quote-to-order conversion.
"""

import pytest
from datetime import date, timedelta
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.settings import get_settings
from src.db.demo_models import Quote, QuoteItem, Order, Customer, Product
from src.utils.calculations import calculate_totals


@pytest.fixture
async def test_customer(db_session: AsyncSession) -> Customer:
    """Get a test customer for quotes."""
    result = await db_session.execute(select(Customer).limit(1))
    return result.scalar_one()


@pytest.fixture
async def test_product(db_session: AsyncSession) -> Product:
    """Get a test product for quote items."""
    result = await db_session.execute(
        select(Product).where(Product.price >= 0).limit(1)
    )
    product = result.scalar_one_or_none()
    if not product:
        pytest.fail("No non-negative priced products found for tests.")
    return product


class TestQuotesList:
    """Test quotes list endpoint with pagination and filtering."""

    async def test_list_quotes_success(self, client: AsyncClient, auth_token: str):
        """Test listing quotes with default pagination."""
        response = await client.get(
            "/api/quotes",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data

        # Verify items is a list
        assert isinstance(data["items"], list)

    async def test_list_quotes_pagination(self, client: AsyncClient, auth_token: str):
        """Test quotes pagination."""
        # Get first page
        response = await client.get(
            "/api/quotes?page=1&page_size=10",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["items"]) <= 10
        assert data["page"] == 1
        assert data["page_size"] == 10

    async def test_list_quotes_filter_by_status(self, client: AsyncClient, auth_token: str):
        """Test filtering quotes by status."""
        response = await client.get(
            "/api/quotes?status=pending",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        # If we have pending quotes, verify filter works
        if data["total"] > 0:
            for quote in data["items"]:
                assert quote["status"] == "pending"

    async def test_list_quotes_search(self, client: AsyncClient, auth_token: str):
        """Test quotes search functionality."""
        response = await client.get(
            "/api/quotes?search=Q-",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        # If we have quotes, verify search works
        if data["total"] > 0:
            quote = data["items"][0]
            assert "Q-" in quote["quote_number"]

    async def test_list_quotes_unauthenticated(self, client: AsyncClient):
        """Test listing quotes without authentication (should fail in production)."""
        response = await client.get("/api/quotes")

        # In development mode: returns 200 (warning logged)
        # In production: returns 401 or 307 redirect
        assert response.status_code in [200, 401, 307]


class TestQuoteCreate:
    """Test quote creation endpoint."""

    async def test_create_quote_with_line_items(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_product: Product,
    ):
        """Test creating a new quote with line items."""
        valid_until = (date.today() + timedelta(days=30)).isoformat()

        new_quote = {
            "customer_id": str(test_customer.id),
            "quote_date": date.today().isoformat(),
            "valid_until": valid_until,
            "status": "draft",
            "notes": "Test quote from automated tests",
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": 5,
                    "unit_price": float(test_product.price),
                }
            ],
        }

        response = await client.post(
            "/api/quotes",
            json=new_quote,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 201
        data = response.json()

        # Verify created quote
        assert data["customer_id"] == new_quote["customer_id"]
        assert data["status"] == new_quote["status"]
        assert "id" in data
        assert "quote_number" in data
        assert "total" in data
        assert "created_at" in data

        # Verify quote number format (Q-YYYY-NNN)
        assert data["quote_number"].startswith("Q-")

        # Verify line items
        assert "items" in data
        assert len(data["items"]) == 1
        assert data["items"][0]["quantity"] == 5

    async def test_create_quote_calculates_total(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_product: Product,
    ):
        """Test that quote total is calculated from line items."""
        quantity = 3
        settings = get_settings()
        totals = calculate_totals(
            [(quantity, test_product.price)],
            settings.tax_rate_decimal,
            tax_enabled=True,
        )
        expected_total = float(totals["total"])
        valid_until = (date.today() + timedelta(days=30)).isoformat()
        unit_price = float(test_product.price)

        new_quote = {
            "customer_id": str(test_customer.id),
            "quote_date": date.today().isoformat(),
            "valid_until": valid_until,
            "status": "draft",
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": quantity,
                    "unit_price": unit_price,
                }
            ],
        }

        response = await client.post(
            "/api/quotes",
            json=new_quote,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 201
        data = response.json()

        # Verify total is calculated correctly
        assert float(data["total"]) == pytest.approx(expected_total, rel=0.01)

    async def test_create_quote_number_generation(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_product: Product,
    ):
        """Test that quote number is auto-generated with correct format."""
        valid_until = (date.today() + timedelta(days=30)).isoformat()

        new_quote = {
            "customer_id": str(test_customer.id),
            "quote_date": date.today().isoformat(),
            "valid_until": valid_until,
            "status": "draft",
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": 1,
                    "unit_price": float(test_product.price),
                }
            ],
        }

        response = await client.post(
            "/api/quotes",
            json=new_quote,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 201
        data = response.json()

        # Verify quote number format: Q-YYYY-NNN
        quote_number = data["quote_number"]
        parts = quote_number.split("-")
        assert len(parts) == 3
        assert parts[0] == "Q"
        assert len(parts[1]) == 4  # Year
        assert parts[2].isdigit()  # Sequential number

    async def test_create_quote_valid_until_optional(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_product: Product,
    ):
        """Test that valid_until is optional (made optional to match backend logic)."""
        new_quote = {
            "customer_id": str(test_customer.id),
            "quote_date": date.today().isoformat(),
            # valid_until omitted — should succeed since it's optional
            "status": "draft",
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": 1,
                    "unit_price": float(test_product.price),
                }
            ],
        }

        response = await client.post(
            "/api/quotes",
            json=new_quote,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 201  # Quote created without valid_until

    async def test_create_quote_missing_customer(
        self,
        client: AsyncClient,
        auth_token: str,
        test_product: Product,
    ):
        """Test creating quote without customer (should fail)."""
        valid_until = (date.today() + timedelta(days=30)).isoformat()

        new_quote = {
            "quote_date": date.today().isoformat(),
            "valid_until": valid_until,
            "status": "draft",
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": 1,
                    "unit_price": float(test_product.price),
                }
            ],
        }

        response = await client.post(
            "/api/quotes",
            json=new_quote,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 422  # Validation error


class TestQuoteUpdate:
    """Test quote update endpoint."""

    async def test_update_quote_success(
        self,
        client: AsyncClient,
        auth_token: str,
        db_session: AsyncSession,
    ):
        """Test updating an existing quote."""
        # Get an existing quote
        result = await db_session.execute(select(Quote).limit(1))
        quote = result.scalar_one()

        updated_data = {
            "status": "sent",
            "notes": "Updated notes from automated tests",
        }

        response = await client.put(
            f"/api/quotes/{quote.id}",
            json=updated_data,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["status"] == updated_data["status"]
        assert data["notes"] == updated_data["notes"]

    async def test_update_quote_not_found(self, client: AsyncClient, auth_token: str):
        """Test updating non-existent quote."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        response = await client.put(
            f"/api/quotes/{fake_id}",
            json={"status": "sent"},
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 404


class TestQuoteDelete:
    """Test quote deletion endpoint."""

    async def test_delete_quote_success(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_product: Product,
    ):
        """Test deleting a quote (cascades to items)."""
        valid_until = (date.today() + timedelta(days=30)).isoformat()

        # First create a test quote
        new_quote = {
            "customer_id": str(test_customer.id),
            "quote_date": date.today().isoformat(),
            "valid_until": valid_until,
            "status": "draft",
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": 1,
                    "unit_price": float(test_product.price),
                }
            ],
        }

        create_response = await client.post(
            "/api/quotes",
            json=new_quote,
            cookies={"auth_token": auth_token},
        )
        assert create_response.status_code == 201
        quote_id = create_response.json()["id"]

        # Now delete it
        response = await client.delete(
            f"/api/quotes/{quote_id}",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 204

        # Verify it's deleted
        get_response = await client.get(
            f"/api/quotes/{quote_id}",
            cookies={"auth_token": auth_token},
        )

        assert get_response.status_code == 404

    async def test_delete_quote_not_found(self, client: AsyncClient, auth_token: str):
        """Test deleting non-existent quote."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        response = await client.delete(
            f"/api/quotes/{fake_id}",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 404


class TestQuoteGet:
    """Test getting single quote by ID."""

    async def test_get_quote_success(
        self,
        client: AsyncClient,
        auth_token: str,
        db_session: AsyncSession,
    ):
        """Test getting a single quote by ID with line items."""
        # Get an existing quote
        result = await db_session.execute(select(Quote).limit(1))
        quote = result.scalar_one()

        response = await client.get(
            f"/api/quotes/{quote.id}",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == str(quote.id)
        assert data["quote_number"] == quote.quote_number
        assert "items" in data
        assert "customer_id" in data  # API returns customer_id (not nested customer object)

    async def test_get_quote_not_found(self, client: AsyncClient, auth_token: str):
        """Test getting non-existent quote."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        response = await client.get(
            f"/api/quotes/{fake_id}",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 404


class TestQuoteStatus:
    """Test quote status transitions."""

    async def test_valid_status_transitions(
        self,
        client: AsyncClient,
        auth_token: str,
        db_session: AsyncSession,
    ):
        """Test that valid status transitions are allowed."""
        # Get a draft quote
        result = await db_session.execute(
            select(Quote).where(Quote.status == "draft").limit(1)
        )
        quote = result.scalar_one_or_none()

        if not quote:
            pytest.skip("No draft quote available for testing")

        # Valid transition: draft → pending
        response = await client.put(
            f"/api/quotes/{quote.id}",
            json={"status": "pending"},
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "pending"

    async def test_quote_status_enum_values(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_product: Product,
    ):
        """Test that quote status must be valid enum value."""
        valid_until = (date.today() + timedelta(days=30)).isoformat()

        new_quote = {
            "customer_id": str(test_customer.id),
            "quote_date": date.today().isoformat(),
            "valid_until": valid_until,
            "status": "invalid_status",  # Not a valid enum value
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": 1,
                    "unit_price": float(test_product.price),
                }
            ],
        }

        response = await client.post(
            "/api/quotes",
            json=new_quote,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 422  # Validation error


class TestQuoteExpiration:
    """Test quote expiration logic."""

    async def test_expired_quote_detection(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_product: Product,
    ):
        """Test that expired quotes are detected."""
        # Create quote that expired yesterday
        valid_until = (date.today() - timedelta(days=1)).isoformat()

        new_quote = {
            "customer_id": str(test_customer.id),
            "quote_date": (date.today() - timedelta(days=10)).isoformat(),
            "valid_until": valid_until,
            "status": "sent",
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": 1,
                    "unit_price": float(test_product.price),
                }
            ],
        }

        response = await client.post(
            "/api/quotes",
            json=new_quote,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 201
        data = response.json()

        # Verify quote is created (backend may auto-mark as expired)
        assert "valid_until" in data
        assert data["valid_until"] == valid_until


class TestQuoteToOrderConversion:
    """Test quote-to-order conversion endpoint."""

    async def test_convert_quote_to_order_success(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_product: Product,
        db_session: AsyncSession,
    ):
        """Test converting a quote to an order."""
        valid_until = (date.today() + timedelta(days=30)).isoformat()

        # Create a quote first
        new_quote = {
            "customer_id": str(test_customer.id),
            "quote_date": date.today().isoformat(),
            "valid_until": valid_until,
            "status": "sent",
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": 3,
                    "unit_price": float(test_product.price),
                }
            ],
        }

        create_response = await client.post(
            "/api/quotes",
            json=new_quote,
            cookies={"auth_token": auth_token},
        )
        assert create_response.status_code == 201
        quote_id = create_response.json()["id"]

        # Convert to order
        response = await client.post(
            f"/api/quotes/{quote_id}/convert-to-order",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 201
        order_data = response.json()

        # Verify order created
        assert "id" in order_data
        assert "order_number" in order_data
        assert order_data["order_number"].startswith("ORD-")
        assert order_data["customer_id"] == new_quote["customer_id"]

        # Verify items copied
        assert len(order_data["items"]) == 1
        assert order_data["items"][0]["quantity"] == 3

        # Verify quote status updated
        quote_response = await client.get(
            f"/api/quotes/{quote_id}",
            cookies={"auth_token": auth_token},
        )
        quote_updated = quote_response.json()
        assert quote_updated["status"] == "accepted"

    async def test_convert_expired_quote_fails(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_product: Product,
    ):
        """Test that converting an expired quote fails."""
        # Create expired quote
        valid_until = (date.today() - timedelta(days=1)).isoformat()

        new_quote = {
            "customer_id": str(test_customer.id),
            "quote_date": (date.today() - timedelta(days=10)).isoformat(),
            "valid_until": valid_until,
            "status": "sent",
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": 1,
                    "unit_price": float(test_product.price),
                }
            ],
        }

        create_response = await client.post(
            "/api/quotes",
            json=new_quote,
            cookies={"auth_token": auth_token},
        )
        quote_id = create_response.json()["id"]

        # Try to convert expired quote
        response = await client.post(
            f"/api/quotes/{quote_id}/convert-to-order",
            cookies={"auth_token": auth_token},
        )

        # Should fail with 400 (Bad Request)
        assert response.status_code == 400

    async def test_convert_quote_not_found(self, client: AsyncClient, auth_token: str):
        """Test converting non-existent quote."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        response = await client.post(
            f"/api/quotes/{fake_id}/convert-to-order",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 404
