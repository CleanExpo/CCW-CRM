"""
Comprehensive Orders API tests.

Tests CRUD operations, line items, status management, and order number generation.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Order, OrderItem, Customer, Product


@pytest.fixture
async def auth_token(client: AsyncClient) -> str:
    """Get authentication token for testing."""
    response = await client.post(
        "/api/auth/login",
        json={"email": "admin@demo.com", "password": "demo123"},
    )
    assert response.status_code == 200
    return response.cookies.get("auth_token")


@pytest.fixture
async def test_customer(db_session: AsyncSession) -> Customer:
    """Get a test customer for orders."""
    result = await db_session.execute(select(Customer).limit(1))
    return result.scalar_one()


@pytest.fixture
async def test_product(db_session: AsyncSession) -> Product:
    """Get a test product for order items."""
    result = await db_session.execute(select(Product).limit(1))
    return result.scalar_one()


class TestOrdersList:
    """Test orders list endpoint with pagination and filtering."""

    async def test_list_orders_success(self, client: AsyncClient, auth_token: str):
        """Test listing orders with default pagination."""
        response = await client.get(
            "/api/orders",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "data" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data

        # Verify data is a list
        assert isinstance(data["data"], list)

    async def test_list_orders_pagination(self, client: AsyncClient, auth_token: str):
        """Test orders pagination."""
        # Get first page
        response = await client.get(
            "/api/orders?page=1&page_size=10",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["data"]) <= 10
        assert data["page"] == 1
        assert data["page_size"] == 10

    async def test_list_orders_filter_by_status(self, client: AsyncClient, auth_token: str):
        """Test filtering orders by status."""
        response = await client.get(
            "/api/orders?status=confirmed",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        # If we have confirmed orders, verify filter works
        if data["total"] > 0:
            for order in data["data"]:
                assert order["status"] == "confirmed"

    async def test_list_orders_search(self, client: AsyncClient, auth_token: str):
        """Test orders search functionality."""
        response = await client.get(
            "/api/orders?search=ORD-",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        # If we have orders, verify search works
        if data["total"] > 0:
            order = data["data"][0]
            assert "ORD-" in order["order_number"]

    async def test_list_orders_unauthenticated(self, client: AsyncClient):
        """Test listing orders without authentication (should fail)."""
        response = await client.get("/api/orders")

        # Should redirect to login or return 401
        assert response.status_code in [401, 307]


class TestOrderCreate:
    """Test order creation endpoint."""

    async def test_create_order_with_line_items(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_product: Product,
    ):
        """Test creating a new order with line items."""
        new_order = {
            "customer_id": str(test_customer.id),
            "order_date": "2026-01-12",
            "status": "draft",
            "notes": "Test order from automated tests",
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": 5,
                    "unit_price": float(test_product.price),
                }
            ],
        }

        response = await client.post(
            "/api/orders",
            json=new_order,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 201
        data = response.json()

        # Verify created order
        assert data["customer_id"] == new_order["customer_id"]
        assert data["status"] == new_order["status"]
        assert "id" in data
        assert "order_number" in data
        assert "total" in data
        assert "created_at" in data

        # Verify order number format (ORD-YYYY-NNN)
        assert data["order_number"].startswith("ORD-")

        # Verify line items
        assert "items" in data
        assert len(data["items"]) == 1
        assert data["items"][0]["quantity"] == 5

    async def test_create_order_calculates_total(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_product: Product,
    ):
        """Test that order total is calculated from line items."""
        quantity = 3
        unit_price = float(test_product.price)
        expected_total = quantity * unit_price

        new_order = {
            "customer_id": str(test_customer.id),
            "order_date": "2026-01-12",
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
            "/api/orders",
            json=new_order,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 201
        data = response.json()

        # Verify total is calculated correctly
        assert data["total"] == pytest.approx(expected_total, rel=0.01)

    async def test_create_order_multiple_line_items(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        db_session: AsyncSession,
    ):
        """Test creating order with multiple line items."""
        # Get 2 products
        result = await db_session.execute(select(Product).limit(2))
        products = result.scalars().all()

        new_order = {
            "customer_id": str(test_customer.id),
            "order_date": "2026-01-12",
            "status": "draft",
            "items": [
                {
                    "product_id": str(products[0].id),
                    "quantity": 2,
                    "unit_price": float(products[0].price),
                },
                {
                    "product_id": str(products[1].id),
                    "quantity": 3,
                    "unit_price": float(products[1].price),
                },
            ],
        }

        response = await client.post(
            "/api/orders",
            json=new_order,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 201
        data = response.json()

        # Verify both line items created
        assert len(data["items"]) == 2

        # Verify total is sum of both items
        expected_total = (2 * float(products[0].price)) + (3 * float(products[1].price))
        assert data["total"] == pytest.approx(expected_total, rel=0.01)

    async def test_create_order_missing_customer(
        self,
        client: AsyncClient,
        auth_token: str,
        test_product: Product,
    ):
        """Test creating order without customer (should fail)."""
        new_order = {
            "order_date": "2026-01-12",
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
            "/api/orders",
            json=new_order,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 422  # Validation error

    async def test_create_order_invalid_quantity(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_product: Product,
    ):
        """Test creating order with invalid quantity (should fail)."""
        new_order = {
            "customer_id": str(test_customer.id),
            "order_date": "2026-01-12",
            "status": "draft",
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": -5,  # Negative quantity
                    "unit_price": float(test_product.price),
                }
            ],
        }

        response = await client.post(
            "/api/orders",
            json=new_order,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 422  # Validation error

    async def test_create_order_number_generation(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_product: Product,
    ):
        """Test that order number is auto-generated with correct format."""
        new_order = {
            "customer_id": str(test_customer.id),
            "order_date": "2026-01-12",
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
            "/api/orders",
            json=new_order,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 201
        data = response.json()

        # Verify order number format: ORD-YYYY-NNN
        order_number = data["order_number"]
        parts = order_number.split("-")
        assert len(parts) == 3
        assert parts[0] == "ORD"
        assert len(parts[1]) == 4  # Year
        assert parts[2].isdigit()  # Sequential number


class TestOrderUpdate:
    """Test order update endpoint."""

    async def test_update_order_success(
        self,
        client: AsyncClient,
        auth_token: str,
        db_session: AsyncSession,
    ):
        """Test updating an existing order."""
        # Get an existing order
        result = await db_session.execute(select(Order).limit(1))
        order = result.scalar_one()

        updated_data = {
            "status": "confirmed",
            "notes": "Updated notes from automated tests",
        }

        response = await client.put(
            f"/api/orders/{order.id}",
            json=updated_data,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["status"] == updated_data["status"]
        assert data["notes"] == updated_data["notes"]

    async def test_update_order_recalculates_total(
        self,
        client: AsyncClient,
        auth_token: str,
        db_session: AsyncSession,
    ):
        """Test that updating order items recalculates total."""
        # Create new order first
        result = await db_session.execute(select(Customer).limit(1))
        customer = result.scalar_one()
        result = await db_session.execute(select(Product).limit(1))
        product = result.scalar_one()

        # Create order
        new_order = {
            "customer_id": str(customer.id),
            "order_date": "2026-01-12",
            "status": "draft",
            "items": [
                {
                    "product_id": str(product.id),
                    "quantity": 2,
                    "unit_price": float(product.price),
                }
            ],
        }

        create_response = await client.post(
            "/api/orders",
            json=new_order,
            cookies={"auth_token": auth_token},
        )
        order_id = create_response.json()["id"]

        # Update quantity
        updated_data = {
            "items": [
                {
                    "product_id": str(product.id),
                    "quantity": 5,  # Changed from 2 to 5
                    "unit_price": float(product.price),
                }
            ],
        }

        response = await client.put(
            f"/api/orders/{order_id}",
            json=updated_data,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        # Verify total recalculated
        expected_total = 5 * float(product.price)
        assert data["total"] == pytest.approx(expected_total, rel=0.01)

    async def test_update_order_not_found(self, client: AsyncClient, auth_token: str):
        """Test updating non-existent order."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        response = await client.put(
            f"/api/orders/{fake_id}",
            json={"status": "confirmed"},
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 404


class TestOrderDelete:
    """Test order deletion endpoint."""

    async def test_delete_order_success(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_product: Product,
    ):
        """Test deleting an order (cascades to items)."""
        # First create a test order
        new_order = {
            "customer_id": str(test_customer.id),
            "order_date": "2026-01-12",
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
            "/api/orders",
            json=new_order,
            cookies={"auth_token": auth_token},
        )
        assert create_response.status_code == 201
        order_id = create_response.json()["id"]

        # Now delete it
        response = await client.delete(
            f"/api/orders/{order_id}",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 204

        # Verify it's deleted
        get_response = await client.get(
            f"/api/orders/{order_id}",
            cookies={"auth_token": auth_token},
        )

        assert get_response.status_code == 404

    async def test_delete_order_not_found(self, client: AsyncClient, auth_token: str):
        """Test deleting non-existent order."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        response = await client.delete(
            f"/api/orders/{fake_id}",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 404


class TestOrderGet:
    """Test getting single order by ID."""

    async def test_get_order_success(
        self,
        client: AsyncClient,
        auth_token: str,
        db_session: AsyncSession,
    ):
        """Test getting a single order by ID with line items."""
        # Get an existing order
        result = await db_session.execute(select(Order).limit(1))
        order = result.scalar_one()

        response = await client.get(
            f"/api/orders/{order.id}",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == str(order.id)
        assert data["order_number"] == order.order_number
        assert "items" in data
        assert "customer" in data  # Should include customer details

    async def test_get_order_not_found(self, client: AsyncClient, auth_token: str):
        """Test getting non-existent order."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        response = await client.get(
            f"/api/orders/{fake_id}",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 404


class TestOrderStatus:
    """Test order status transitions."""

    async def test_valid_status_transitions(
        self,
        client: AsyncClient,
        auth_token: str,
        db_session: AsyncSession,
    ):
        """Test that valid status transitions are allowed."""
        # Get a draft order
        result = await db_session.execute(
            select(Order).where(Order.status == "draft").limit(1)
        )
        order = result.scalar_one_or_none()

        if not order:
            pytest.skip("No draft order available for testing")

        # Valid transition: draft → pending
        response = await client.put(
            f"/api/orders/{order.id}",
            json={"status": "pending"},
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        assert response.json()["status"] == "pending"

    async def test_order_status_enum_values(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_product: Product,
    ):
        """Test that order status must be valid enum value."""
        new_order = {
            "customer_id": str(test_customer.id),
            "order_date": "2026-01-12",
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
            "/api/orders",
            json=new_order,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 422  # Validation error
