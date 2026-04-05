"""
Comprehensive Orders API tests.

Tests CRUD operations, line items, status management, and order number generation.
"""

import pytest
from uuid import UUID
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.settings import get_settings
from src.db.demo_models import Order, OrderItem, Customer, Product
from src.db.inventory_models import ProductStockByLocation, StockReservation
from src.utils.calculations import calculate_totals


@pytest.fixture
async def test_customer(db_session: AsyncSession) -> Customer:
    """Get a test customer for orders."""
    result = await db_session.execute(select(Customer).limit(1))
    return result.scalar_one()


@pytest.fixture
async def test_product(db_session: AsyncSession) -> Product:
    """Get a test product for order items."""
    result = await db_session.execute(
        select(Product).where(Product.price >= 0).limit(1)
    )
    product = result.scalar_one_or_none()
    if not product:
        pytest.fail("No non-negative priced products found for tests.")
    return product


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
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "total_pages" in data

        # Verify items is a list
        assert isinstance(data["items"], list)

    async def test_list_orders_pagination(self, client: AsyncClient, auth_token: str):
        """Test orders pagination."""
        # Get first page
        response = await client.get(
            "/api/orders?page=1&page_size=10",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["items"]) <= 10
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
            for order in data["items"]:
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
            order = data["items"][0]
            assert "ORD-" in order["order_number"]

    async def test_list_orders_unauthenticated(self, client: AsyncClient):
        """Test listing orders without authentication (should fail in production)."""
        response = await client.get("/api/orders")

        # In development mode: returns 200 (warning logged)
        # In production: returns 401 or 307 redirect
        assert response.status_code in [200, 401, 307]


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
        settings = get_settings()
        totals = calculate_totals(
            [(quantity, test_product.price)],
            settings.tax_rate_decimal,
            tax_enabled=True,
        )
        expected_total = float(totals["total"])

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
        assert float(data["total"]) == pytest.approx(expected_total, rel=0.01)

    async def test_create_order_multiple_line_items(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        db_session: AsyncSession,
    ):
        """Test creating order with multiple line items."""
        # Get 2 products
        result = await db_session.execute(
            select(Product).where(Product.price >= 0).limit(2)
        )
        products = result.scalars().all()
        if len(products) < 2:
            pytest.fail("Not enough non-negative priced products found for tests.")

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
        settings = get_settings()
        totals = calculate_totals(
            [(2, products[0].price), (3, products[1].price)],
            settings.tax_rate_decimal,
            tax_enabled=True,
        )
        expected_total = float(totals["total"])
        assert float(data["total"]) == pytest.approx(expected_total, rel=0.01)

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
        result = await db_session.execute(
            select(Product).where(Product.price >= 0).limit(1)
        )
        product = result.scalar_one_or_none()
        if not product:
            pytest.fail("No non-negative priced products found for tests.")

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
        settings = get_settings()
        totals = calculate_totals(
            [(5, product.price)],
            settings.tax_rate_decimal,
            tax_enabled=True,
        )
        expected_total = float(totals["total"])
        assert float(data["total"]) == pytest.approx(expected_total, rel=0.01)

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
        assert "customer_id" in data  # API returns customer_id (not nested customer object)

    async def test_get_order_not_found(self, client: AsyncClient, auth_token: str):
        """Test getting non-existent order."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        response = await client.get(
            f"/api/orders/{fake_id}",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 404


class TestOrderActivity:
    """Test order activity audit trail."""

    async def test_order_activity_logged_on_create(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_product: Product,
    ):
        """Order creation should log a created activity event."""
        new_order = {
            "customer_id": str(test_customer.id),
            "order_date": "2026-01-12",
            "status": "draft",
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": 2,
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

        activity_response = await client.get(
            f"/api/orders/{order_id}/activity",
            cookies={"auth_token": auth_token},
        )
        assert activity_response.status_code == 200
        events = activity_response.json()
        assert len(events) >= 1
        assert events[0]["event_type"] == "created"

    async def test_order_activity_logged_on_status_update(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_product: Product,
    ):
        """Order status updates should log a status_updated activity event."""
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

        update_response = await client.put(
            f"/api/orders/{order_id}",
            json={"status": "pending"},
            cookies={"auth_token": auth_token},
        )
        assert update_response.status_code == 200

        activity_response = await client.get(
            f"/api/orders/{order_id}/activity",
            cookies={"auth_token": auth_token},
        )
        assert activity_response.status_code == 200
        events = activity_response.json()
        assert any(event["event_type"] == "status_updated" for event in events)


class TestOrderReservations:
    """Test inventory reservations for orders."""

    async def test_pending_order_creates_reservations(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_product: Product,
        db_session: AsyncSession,
    ):
        """Pending orders should reserve stock by location."""
        quantity = 3
        location = "brisbane"

        stock_stmt = select(ProductStockByLocation).where(
            ProductStockByLocation.product_id == test_product.id,
            ProductStockByLocation.location == location,
        )
        stock_result = await db_session.execute(stock_stmt)
        stock = stock_result.scalar_one_or_none()

        if not stock:
            stock = ProductStockByLocation(
                product_id=test_product.id,
                location=location,
                stock=quantity + 5,
                reserved=0,
            )
            db_session.add(stock)
        else:
            stock.stock = max(stock.stock, quantity + 5)
            stock.reserved = 0

        await db_session.commit()

        new_order = {
            "customer_id": str(test_customer.id),
            "order_date": "2026-01-12",
            "status": "pending",
            "fulfillment_location": location,
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": quantity,
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

        reservation_stmt = select(StockReservation).where(
            StockReservation.order_id == UUID(order_id),
            StockReservation.status == "active",
        )
        reservation_result = await db_session.execute(reservation_stmt)
        reservations = reservation_result.scalars().all()

        assert reservations
        assert sum(r.quantity for r in reservations) == quantity


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
