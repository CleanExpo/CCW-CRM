"""
End-to-End Order Flow Tests.

Tests the complete order lifecycle from creation to completion:
1. Login as user
2. Browse products
3. Create order with multiple items
4. View order details
5. Update order status
6. Complete order

Part of Phase 5 Week 1 - E2E Test Coverage.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Customer, Order, OrderItem, Product


@pytest.fixture
async def test_customer(db_session: AsyncSession) -> Customer:
    """Get or create a test customer."""
    result = await db_session.execute(select(Customer).limit(1))
    customer = result.scalar_one_or_none()
    if not customer:
        pytest.fail("No customers found in database. Run seed data first.")
    return customer


@pytest.fixture
async def test_products(db_session: AsyncSession) -> list[Product]:
    """Get multiple test products for order items."""
    result = await db_session.execute(
        select(Product).where(Product.price > 0).limit(3)
    )
    products = list(result.scalars().all())
    if len(products) < 2:
        pytest.fail("Need at least 2 products for E2E tests. Run seed data first.")
    return products


class TestOrderFlowE2E:
    """End-to-end tests for complete order flow."""

    async def test_complete_order_lifecycle(
        self,
        client: AsyncClient,
        auth_token: str,
        db_session: AsyncSession,
        test_customer: Customer,
        test_products: list[Product],
    ):
        """
        Test complete order flow from creation to completion.

        Steps:
        1. Create order with multiple items
        2. Verify order was created
        3. Update order status
        4. Verify status change
        5. Complete order
        """
        # Step 1: Create order with multiple items
        order_data = {
            "customer_id": str(test_customer.id),
            "status": "draft",
            "notes": "E2E test order",
            "items": [
                {
                    "product_id": str(test_products[0].id),
                    "quantity": 2,
                    "unit_price": float(test_products[0].price),
                },
                {
                    "product_id": str(test_products[1].id),
                    "quantity": 3,
                    "unit_price": float(test_products[1].price),
                },
            ],
        }

        create_response = await client.post(
            "/api/orders",
            json=order_data,
            cookies={"auth_token": auth_token},
        )

        assert create_response.status_code == 201, f"Failed to create order: {create_response.text}"
        created_order = create_response.json()
        order_id = created_order["id"]

        # Verify order details
        assert created_order["status"] == "draft"
        assert created_order["customer_id"] == str(test_customer.id)
        assert len(created_order["items"]) == 2
        assert created_order["order_number"].startswith("ORD-")

        # Step 2: Get order details
        get_response = await client.get(
            f"/api/orders/{order_id}",
            cookies={"auth_token": auth_token},
        )

        assert get_response.status_code == 200
        order_details = get_response.json()
        assert order_details["id"] == order_id
        assert len(order_details["items"]) == 2

        # Step 3: Update order status to confirmed
        update_response = await client.put(
            f"/api/orders/{order_id}",
            json={"status": "confirmed"},
            cookies={"auth_token": auth_token},
        )

        assert update_response.status_code == 200
        updated_order = update_response.json()
        assert updated_order["status"] == "confirmed"

        # Step 4: Update to processing
        processing_response = await client.put(
            f"/api/orders/{order_id}",
            json={"status": "processing"},
            cookies={"auth_token": auth_token},
        )

        assert processing_response.status_code == 200
        processing_order = processing_response.json()
        assert processing_order["status"] == "processing"

        # Step 5: Update to shipped
        shipped_response = await client.put(
            f"/api/orders/{order_id}",
            json={"status": "shipped"},
            cookies={"auth_token": auth_token},
        )

        assert shipped_response.status_code == 200
        shipped_order = shipped_response.json()
        assert shipped_order["status"] == "shipped"

        # Step 6: Complete order (delivered)
        completed_response = await client.put(
            f"/api/orders/{order_id}",
            json={"status": "delivered"},
            cookies={"auth_token": auth_token},
        )

        assert completed_response.status_code == 200
        completed_order = completed_response.json()
        assert completed_order["status"] == "delivered"

        # Verify final state in database
        result = await db_session.execute(
            select(Order).where(Order.id == order_id)
        )
        db_order = result.scalar_one()
        assert db_order.status == "delivered"

        # Verify order items persist
        items_result = await db_session.execute(
            select(OrderItem).where(OrderItem.order_id == order_id)
        )
        db_items = list(items_result.scalars().all())
        assert len(db_items) == 2

    async def test_order_cancellation_flow(
        self,
        client: AsyncClient,
        auth_token: str,
        db_session: AsyncSession,
        test_customer: Customer,
        test_products: list[Product],
    ):
        """
        Test order cancellation flow.

        Steps:
        1. Create order
        2. Confirm order
        3. Cancel order
        4. Verify cancellation
        """
        # Create order
        order_data = {
            "customer_id": str(test_customer.id),
            "status": "draft",
            "items": [
                {
                    "product_id": str(test_products[0].id),
                    "quantity": 1,
                    "unit_price": float(test_products[0].price),
                }
            ],
        }

        create_response = await client.post(
            "/api/orders",
            json=order_data,
            cookies={"auth_token": auth_token},
        )
        assert create_response.status_code == 201
        order_id = create_response.json()["id"]

        # Confirm order
        await client.put(
            f"/api/orders/{order_id}",
            json={"status": "confirmed"},
            cookies={"auth_token": auth_token},
        )

        # Cancel order
        cancel_response = await client.put(
            f"/api/orders/{order_id}",
            json={"status": "cancelled"},
            cookies={"auth_token": auth_token},
        )

        assert cancel_response.status_code == 200
        cancelled_order = cancel_response.json()
        assert cancelled_order["status"] == "cancelled"

        # Verify in database
        result = await db_session.execute(
            select(Order).where(Order.id == order_id)
        )
        db_order = result.scalar_one()
        assert db_order.status == "cancelled"

    async def test_order_with_customer_lookup(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_products: list[Product],
    ):
        """
        Test creating order with customer lookup.

        Steps:
        1. List customers
        2. Select customer
        3. Create order
        4. Verify customer relationship
        """
        # Step 1: List customers
        customers_response = await client.get(
            "/api/customers",
            cookies={"auth_token": auth_token},
        )
        assert customers_response.status_code == 200
        customers = customers_response.json()
        assert "items" in customers
        assert len(customers["items"]) > 0

        # Step 2: Select first customer
        selected_customer = customers["items"][0]
        customer_id = selected_customer["id"]

        # Step 3: Create order for customer
        order_data = {
            "customer_id": customer_id,
            "status": "draft",
            "items": [
                {
                    "product_id": str(test_products[0].id),
                    "quantity": 1,
                    "unit_price": float(test_products[0].price),
                }
            ],
        }

        create_response = await client.post(
            "/api/orders",
            json=order_data,
            cookies={"auth_token": auth_token},
        )
        assert create_response.status_code == 201
        created_order = create_response.json()

        # Step 4: Verify customer relationship
        assert created_order["customer_id"] == customer_id

        # Get order details with customer info
        order_id = created_order["id"]
        order_response = await client.get(
            f"/api/orders/{order_id}",
            cookies={"auth_token": auth_token},
        )
        assert order_response.status_code == 200
        order_with_customer = order_response.json()
        assert order_with_customer["customer_id"] == customer_id

    async def test_order_item_updates(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_products: list[Product],
    ):
        """
        Test updating order items.

        Steps:
        1. Create order with 2 items
        2. Update order with 3 items (add one)
        3. Update order with 1 item (remove two)
        4. Verify item changes persist
        """
        # Create order with 2 items
        order_data = {
            "customer_id": str(test_customer.id),
            "status": "draft",
            "items": [
                {
                    "product_id": str(test_products[0].id),
                    "quantity": 2,
                    "unit_price": float(test_products[0].price),
                },
                {
                    "product_id": str(test_products[1].id),
                    "quantity": 1,
                    "unit_price": float(test_products[1].price),
                },
            ],
        }

        create_response = await client.post(
            "/api/orders",
            json=order_data,
            cookies={"auth_token": auth_token},
        )
        assert create_response.status_code == 201
        order_id = create_response.json()["id"]

        # Update with 3 items (add third product)
        update_data = {
            "items": [
                {
                    "product_id": str(test_products[0].id),
                    "quantity": 2,
                    "unit_price": float(test_products[0].price),
                },
                {
                    "product_id": str(test_products[1].id),
                    "quantity": 1,
                    "unit_price": float(test_products[1].price),
                },
                {
                    "product_id": str(test_products[2].id),
                    "quantity": 5,
                    "unit_price": float(test_products[2].price),
                },
            ]
        }

        update_response = await client.put(
            f"/api/orders/{order_id}",
            json=update_data,
            cookies={"auth_token": auth_token},
        )
        assert update_response.status_code == 200
        updated_order = update_response.json()
        assert len(updated_order["items"]) == 3

        # Update with 1 item (remove two items)
        update_data2 = {
            "items": [
                {
                    "product_id": str(test_products[0].id),
                    "quantity": 10,
                    "unit_price": float(test_products[0].price),
                }
            ]
        }

        update_response2 = await client.put(
            f"/api/orders/{order_id}",
            json=update_data2,
            cookies={"auth_token": auth_token},
        )
        assert update_response2.status_code == 200
        final_order = update_response2.json()
        assert len(final_order["items"]) == 1
        assert final_order["items"][0]["quantity"] == 10

    async def test_order_list_filtering(
        self,
        client: AsyncClient,
        auth_token: str,
        test_customer: Customer,
        test_products: list[Product],
    ):
        """
        Test order list filtering and search.

        Steps:
        1. Create orders with different statuses
        2. Filter by status
        3. Filter by customer
        4. Search by order number
        """
        # Create confirmed order
        confirmed_order_data = {
            "customer_id": str(test_customer.id),
            "status": "confirmed",
            "items": [
                {
                    "product_id": str(test_products[0].id),
                    "quantity": 1,
                    "unit_price": float(test_products[0].price),
                }
            ],
        }

        confirmed_response = await client.post(
            "/api/orders",
            json=confirmed_order_data,
            cookies={"auth_token": auth_token},
        )
        assert confirmed_response.status_code == 201
        confirmed_order = confirmed_response.json()

        # Filter by confirmed status
        filter_response = await client.get(
            "/api/orders?status=confirmed",
            cookies={"auth_token": auth_token},
        )
        assert filter_response.status_code == 200
        filtered_orders = filter_response.json()

        # Verify all returned orders have confirmed status
        for order in filtered_orders["items"]:
            assert order["status"] == "confirmed"

        # Filter by customer
        customer_filter_response = await client.get(
            f"/api/orders?customer_id={test_customer.id}",
            cookies={"auth_token": auth_token},
        )
        assert customer_filter_response.status_code == 200
        customer_orders = customer_filter_response.json()

        # Verify all orders belong to test customer
        for order in customer_orders["items"]:
            assert order["customer_id"] == str(test_customer.id)

    async def test_order_validation_errors(
        self,
        client: AsyncClient,
        auth_token: str,
    ):
        """
        Test order validation and error handling.

        Steps:
        1. Try to create order without customer_id
        2. Try to create order with invalid product_id
        3. Try to create order with negative quantity
        4. Verify appropriate error responses
        """
        # Missing customer_id
        invalid_order1 = {
            "status": "draft",
            "items": [],
        }

        response1 = await client.post(
            "/api/orders",
            json=invalid_order1,
            cookies={"auth_token": auth_token},
        )
        assert response1.status_code in [400, 422]  # Validation error

        # Invalid product_id
        invalid_order2 = {
            "customer_id": "00000000-0000-0000-0000-000000000000",
            "status": "draft",
            "items": [
                {
                    "product_id": "invalid-uuid",
                    "quantity": 1,
                    "unit_price": 10.0,
                }
            ],
        }

        response2 = await client.post(
            "/api/orders",
            json=invalid_order2,
            cookies={"auth_token": auth_token},
        )
        assert response2.status_code in [400, 422]

        # Negative quantity
        invalid_order3 = {
            "customer_id": "00000000-0000-0000-0000-000000000000",
            "status": "draft",
            "items": [
                {
                    "product_id": "00000000-0000-0000-0000-000000000001",
                    "quantity": -5,
                    "unit_price": 10.0,
                }
            ],
        }

        response3 = await client.post(
            "/api/orders",
            json=invalid_order3,
            cookies={"auth_token": auth_token},
        )
        assert response3.status_code in [400, 422]
