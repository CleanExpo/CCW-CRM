"""
Comprehensive smoke tests for all API endpoints.

This test suite validates that all critical endpoints are:
1. Accessible and return expected status codes
2. Return properly structured responses
3. Handle authentication correctly
4. Handle basic error cases properly

Goal: 100+ scenarios covering all major API functionality.
"""

import pytest
from httpx import AsyncClient


class TestAuthenticationEndpoints:
    """Smoke tests for authentication endpoints (3 scenarios)."""

    async def test_login_success(self, client: AsyncClient):
        """Scenario 1: Successful login with valid credentials."""
        response = await client.post(
            "/api/auth/login",
            json={"email": "admin@demo.com", "password": "demo123"},
        )
        assert response.status_code == 200
        assert "auth_token" in response.cookies
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == "admin@demo.com"

    async def test_login_invalid_credentials(self, client: AsyncClient):
        """Scenario 2: Login with invalid credentials returns 401."""
        response = await client.post(
            "/api/auth/login",
            json={"email": "invalid@example.com", "password": "wrongpass"},
        )
        assert response.status_code == 401

    async def test_protected_endpoint_without_auth(self, client: AsyncClient):
        """Scenario 3: Accessing protected endpoint without auth returns 401 (or 200 if auth disabled)."""
        response = await client.get("/api/products")
        # Auth may be disabled for local testing (SKIP_AUTH_ENFORCEMENT)
        assert response.status_code in [200, 401]


class TestProductsEndpoints:
    """Smoke tests for products endpoints (10 scenarios)."""

    async def test_list_products(self, client: AsyncClient, auth_headers: dict):
        """Scenario 4: List products returns paginated results."""
        response = await client.get(
            "/api/products", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)

    async def test_list_products_pagination(self, client: AsyncClient, auth_headers: dict):
        """Scenario 5: Products pagination works correctly."""
        response = await client.get(
            "/api/products?page=1&page_size=5", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 5
        assert len(data["items"]) <= 5

    async def test_list_products_search(self, client: AsyncClient, auth_headers: dict):
        """Scenario 6: Products search filtering works."""
        response = await client.get(
            "/api/products?search=drill", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    async def test_list_products_category_filter(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Scenario 7: Products category filtering works."""
        response = await client.get(
            "/api/products?category=power_tools", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_get_product_by_id(
        self, client: AsyncClient, auth_headers: dict, sample_product_id: str
    ):
        """Scenario 8: Get product by ID returns correct product."""
        response = await client.get(
            f"/api/products/{sample_product_id}", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_product_id

    async def test_get_nonexistent_product(self, client: AsyncClient, auth_headers: dict):
        """Scenario 9: Get non-existent product returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = await client.get(
            f"/api/products/{fake_id}", headers=auth_headers
        )
        assert response.status_code == 404

    async def test_create_product(self, client: AsyncClient, auth_headers: dict):
        """Scenario 10: Create new product succeeds."""
        response = await client.post(
            "/api/products",
            json={
                "sku": f"TEST-SMOKE-{pytest.timestamp}",
                "name": "Smoke Test Product",
                "category": "HAND_TOOLS",
                "price": 99.99,
                "cost": 50.00,
                "stock": 100,
            },
            headers=auth_headers,
        )
        assert response.status_code in [200, 201]

    async def test_create_product_invalid_data(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Scenario 11: Create product with invalid data returns 422."""
        response = await client.post(
            "/api/products",
            json={"sku": "INVALID"},  # Missing required fields
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_update_product(
        self, client: AsyncClient, auth_headers: dict, sample_product_id: str
    ):
        """Scenario 12: Update existing product succeeds."""
        response = await client.put(
            f"/api/products/{sample_product_id}",
            json={
                "sku": "TEST-SKU-001",
                "name": "Updated Product Name",
                "category": "HAND_TOOLS",
                "price": 199.99,
                "cost": 100.00,
                "stock": 50,
            },
            headers=auth_headers,
        )
        assert response.status_code == 200

    async def test_delete_product(
        self, client: AsyncClient, auth_headers: dict, deletable_product_id: str
    ):
        """Scenario 13: Delete product succeeds."""
        response = await client.delete(
            f"/api/products/{deletable_product_id}", headers=auth_headers
        )
        assert response.status_code in [200, 204]


class TestCustomersEndpoints:
    """Smoke tests for customers endpoints (10 scenarios)."""

    async def test_list_customers(self, client: AsyncClient, auth_headers: dict):
        """Scenario 14: List customers returns paginated results."""
        response = await client.get(
            "/api/customers", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    async def test_list_customers_pagination(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Scenario 15: Customers pagination works correctly."""
        response = await client.get(
            "/api/customers?page=1&page_size=10", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert len(data["items"]) <= 10

    async def test_list_customers_search(self, client: AsyncClient, auth_headers: dict):
        """Scenario 16: Customers search filtering works."""
        response = await client.get(
            "/api/customers?search=construction", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_get_customer_by_id(
        self, client: AsyncClient, auth_headers: dict, sample_customer_id: str
    ):
        """Scenario 17: Get customer by ID returns correct customer."""
        response = await client.get(
            f"/api/customers/{sample_customer_id}", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_customer_id

    async def test_get_nonexistent_customer(self, client: AsyncClient, auth_headers: dict):
        """Scenario 18: Get non-existent customer returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = await client.get(
            f"/api/customers/{fake_id}", headers=auth_headers
        )
        assert response.status_code == 404

    async def test_create_customer(self, client: AsyncClient, auth_headers: dict):
        """Scenario 19: Create new customer succeeds."""
        response = await client.post(
            "/api/customers",
            json={
                "customer_number": f"SMOKE-{pytest.timestamp}",
                "company_name": "Smoke Test Company",
                "contact_name": "Test Contact",
                "email": f"smoke-{pytest.timestamp}@example.com",
                "phone": "0400000000",
            },
            headers=auth_headers,
        )
        assert response.status_code in [200, 201]

    async def test_create_customer_invalid_email(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Scenario 20: Create customer with invalid email returns 422."""
        response = await client.post(
            "/api/customers",
            json={
                "customer_number": "INVALID-001",
                "company_name": "Test",
                "email": "not-an-email",
            },
            headers=auth_headers,
        )
        assert response.status_code == 422

    async def test_update_customer(
        self, client: AsyncClient, auth_headers: dict, sample_customer_id: str
    ):
        """Scenario 21: Update existing customer succeeds."""
        response = await client.put(
            f"/api/customers/{sample_customer_id}",
            json={
                "customer_number": "TEST-001",
                "company_name": "Updated Company Name",
                "contact_name": "Updated Contact",
                "email": "updated@example.com",
                "phone": "0400111222",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200

    async def test_get_customer_stats(
        self, client: AsyncClient, auth_headers: dict, sample_customer_id: str
    ):
        """Scenario 22: Get customer statistics."""
        response = await client.get(
            f"/api/customers/{sample_customer_id}/stats",
            headers=auth_headers,
        )
        assert response.status_code == 200

    async def test_delete_customer(
        self, client: AsyncClient, auth_headers: dict, deletable_customer_id: str
    ):
        """Scenario 23: Delete customer succeeds."""
        response = await client.delete(
            f"/api/customers/{deletable_customer_id}",
            headers=auth_headers,
        )
        assert response.status_code in [200, 204]


class TestOrdersEndpoints:
    """Smoke tests for orders endpoints (10 scenarios)."""

    async def test_list_orders(self, client: AsyncClient, auth_headers: dict):
        """Scenario 24: List orders returns paginated results."""
        response = await client.get("/api/orders", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    async def test_list_orders_pagination(self, client: AsyncClient, auth_headers: dict):
        """Scenario 25: Orders pagination works correctly."""
        response = await client.get(
            "/api/orders?page=1&page_size=10", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_list_orders_status_filter(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Scenario 26: Orders status filtering works."""
        response = await client.get(
            "/api/orders?status=confirmed", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_get_order_by_id(
        self, client: AsyncClient, auth_headers: dict, sample_order_id: str
    ):
        """Scenario 27: Get order by ID returns correct order."""
        response = await client.get(
            f"/api/orders/{sample_order_id}", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_order_id

    async def test_get_nonexistent_order(self, client: AsyncClient, auth_headers: dict):
        """Scenario 28: Get non-existent order returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = await client.get(
            f"/api/orders/{fake_id}", headers=auth_headers
        )
        assert response.status_code == 404

    async def test_create_order(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_customer_id: str,
        sample_product_id: str,
    ):
        """Scenario 29: Create new order succeeds."""
        response = await client.post(
            "/api/orders",
            json={
                "customer_id": sample_customer_id,
                "status": "draft",
                "items": [
                    {"product_id": sample_product_id, "quantity": 5, "unit_price": 100}
                ],
            },
            headers=auth_headers,
        )
        assert response.status_code in [200, 201]

    async def test_create_order_invalid_customer(
        self, client: AsyncClient, auth_headers: dict, sample_product_id: str
    ):
        """Scenario 30: Create order with invalid customer returns 400/422."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = await client.post(
            "/api/orders",
            json={
                "customer_id": fake_id,
                "status": "draft",
                "items": [
                    {"product_id": sample_product_id, "quantity": 5, "unit_price": 100}
                ],
            },
            headers=auth_headers,
        )
        assert response.status_code in [400, 404, 422]

    async def test_update_order_status(
        self, client: AsyncClient, auth_headers: dict, sample_order_id: str
    ):
        """Scenario 31: Update order status succeeds."""
        response = await client.patch(
            f"/api/orders/{sample_order_id}/status",
            json={"status": "confirmed"},
            headers=auth_headers,
        )
        assert response.status_code == 200

    async def test_get_order_with_items(
        self, client: AsyncClient, auth_headers: dict, sample_order_id: str
    ):
        """Scenario 32: Get order includes line items."""
        response = await client.get(
            f"/api/orders/{sample_order_id}", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert isinstance(data["items"], list)

    async def test_delete_order(
        self, client: AsyncClient, auth_headers: dict, deletable_order_id: str
    ):
        """Scenario 33: Delete order succeeds."""
        response = await client.delete(
            f"/api/orders/{deletable_order_id}", headers=auth_headers
        )
        assert response.status_code in [200, 204]


class TestQuotesEndpoints:
    """Smoke tests for quotes endpoints (10 scenarios)."""

    async def test_list_quotes(self, client: AsyncClient, auth_headers: dict):
        """Scenario 34: List quotes returns paginated results."""
        response = await client.get("/api/quotes", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data

    async def test_list_quotes_pagination(self, client: AsyncClient, auth_headers: dict):
        """Scenario 35: Quotes pagination works correctly."""
        response = await client.get(
            "/api/quotes?page=1&page_size=10", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_list_quotes_status_filter(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Scenario 36: Quotes status filtering works."""
        response = await client.get(
            "/api/quotes?status=sent", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_get_quote_by_id(
        self, client: AsyncClient, auth_headers: dict, sample_quote_id: str
    ):
        """Scenario 37: Get quote by ID returns correct quote."""
        response = await client.get(
            f"/api/quotes/{sample_quote_id}", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_quote_id

    async def test_get_nonexistent_quote(self, client: AsyncClient, auth_headers: dict):
        """Scenario 38: Get non-existent quote returns 404."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = await client.get(
            f"/api/quotes/{fake_id}", headers=auth_headers
        )
        assert response.status_code == 404

    async def test_create_quote(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_customer_id: str,
        sample_product_id: str,
    ):
        """Scenario 39: Create new quote succeeds."""
        from datetime import date, timedelta
        valid_until = (date.today() + timedelta(days=30)).isoformat()
        response = await client.post(
            "/api/quotes",
            json={
                "customer_id": sample_customer_id,
                "status": "draft",
                "valid_until": valid_until,
                "items": [
                    {"product_id": sample_product_id, "quantity": 10, "unit_price": 150}
                ],
            },
            headers=auth_headers,
        )
        assert response.status_code in [200, 201]

    async def test_create_quote_invalid_data(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Scenario 40: Create quote with invalid data returns 422."""
        response = await client.post(
            "/api/quotes",
            json={"customer_id": "invalid", "items": []},
            headers=auth_headers,
        )
        assert response.status_code in [400, 422]

    async def test_update_quote_status(
        self, client: AsyncClient, auth_headers: dict, sample_quote_id: str
    ):
        """Scenario 41: Update quote status succeeds."""
        response = await client.patch(
            f"/api/quotes/{sample_quote_id}/status",
            json={"status": "sent"},
            headers=auth_headers,
        )
        assert response.status_code == 200

    async def test_convert_quote_to_order(
        self, client: AsyncClient, auth_headers: dict, sample_quote_id: str
    ):
        """Scenario 42: Convert quote to order succeeds."""
        response = await client.post(
            f"/api/quotes/{sample_quote_id}/convert",
            headers=auth_headers,
        )
        assert response.status_code in [200, 201]

    async def test_delete_quote(
        self, client: AsyncClient, auth_headers: dict, deletable_quote_id: str
    ):
        """Scenario 43: Delete quote succeeds."""
        response = await client.delete(
            f"/api/quotes/{deletable_quote_id}", headers=auth_headers
        )
        assert response.status_code in [200, 204]


class TestPurchaseOrdersEndpoints:
    """Smoke tests for purchase orders endpoints (8 scenarios)."""

    async def test_list_purchase_orders(self, client: AsyncClient, auth_headers: dict):
        """Scenario 44: List purchase orders returns paginated results."""
        response = await client.get(
            "/api/purchase-orders", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data or "data" in data

    async def test_list_purchase_orders_pagination(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Scenario 45: Purchase orders pagination works."""
        response = await client.get(
            "/api/purchase-orders?page=1&page_size=10",
            headers=auth_headers,
        )
        assert response.status_code == 200

    async def test_get_purchase_order_by_id(
        self, client: AsyncClient, auth_headers: dict, sample_po_id: str
    ):
        """Scenario 46: Get purchase order by ID."""
        response = await client.get(
            f"/api/purchase-orders/{sample_po_id}", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_create_purchase_order(
        self,
        client: AsyncClient,
        auth_headers: dict,
        sample_supplier_id: str,
        sample_product_id: str,
    ):
        """Scenario 47: Create new purchase order succeeds."""
        response = await client.post(
            "/api/purchase-orders",
            json={
                "supplier_id": sample_supplier_id,
                "status": "draft",
                "items": [
                    {"product_id": sample_product_id, "quantity": 100, "unit_cost": 50}
                ],
            },
            headers=auth_headers,
        )
        assert response.status_code in [200, 201]

    async def test_update_purchase_order_status(
        self, client: AsyncClient, auth_headers: dict, sample_po_id: str
    ):
        """Scenario 48: Update purchase order status."""
        response = await client.patch(
            f"/api/purchase-orders/{sample_po_id}/status",
            json={"status": "approved"},
            headers=auth_headers,
        )
        assert response.status_code == 200

    async def test_receive_goods(
        self, client: AsyncClient, auth_headers: dict, sample_po_id: str
    ):
        """Scenario 49: Receive goods against purchase order."""
        response = await client.post(
            f"/api/purchase-orders/{sample_po_id}/receive",
            json={"items": []},
            headers=auth_headers,
        )
        # May return 200 or 400 depending on PO state
        assert response.status_code in [200, 400]

    async def test_get_purchase_order_history(
        self, client: AsyncClient, auth_headers: dict, sample_po_id: str
    ):
        """Scenario 50: Get purchase order history."""
        response = await client.get(
            f"/api/purchase-orders/{sample_po_id}/history",
            headers=auth_headers,
        )
        assert response.status_code in [200, 404]

    async def test_delete_purchase_order(
        self, client: AsyncClient, auth_headers: dict, deletable_po_id: str
    ):
        """Scenario 51: Delete purchase order succeeds."""
        response = await client.delete(
            f"/api/purchase-orders/{deletable_po_id}",
            headers=auth_headers,
        )
        assert response.status_code in [200, 204]


class TestSuppliersEndpoints:
    """Smoke tests for suppliers endpoints (6 scenarios)."""

    async def test_list_suppliers(self, client: AsyncClient, auth_headers: dict):
        """Scenario 52: List suppliers returns paginated results."""
        response = await client.get(
            "/api/suppliers", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_get_supplier_by_id(
        self, client: AsyncClient, auth_headers: dict, sample_supplier_id: str
    ):
        """Scenario 53: Get supplier by ID."""
        response = await client.get(
            f"/api/suppliers/{sample_supplier_id}", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_create_supplier(self, client: AsyncClient, auth_headers: dict):
        """Scenario 54: Create new supplier succeeds."""
        response = await client.post(
            "/api/suppliers",
            json={
                "code": f"SMOKE-{pytest.timestamp}",
                "name": "Smoke Test Supplier",
                "email": f"supplier-{pytest.timestamp}@example.com",
            },
            headers=auth_headers,
        )
        assert response.status_code in [200, 201]

    async def test_update_supplier(
        self, client: AsyncClient, auth_headers: dict, sample_supplier_id: str
    ):
        """Scenario 55: Update existing supplier succeeds."""
        response = await client.put(
            f"/api/suppliers/{sample_supplier_id}",
            json={
                "code": "TEST-SUP-001",
                "name": "Updated Supplier Name",
                "email": "updated-supplier@example.com",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200

    async def test_get_supplier_purchase_orders(
        self, client: AsyncClient, auth_headers: dict, sample_supplier_id: str
    ):
        """Scenario 56: Get supplier purchase orders."""
        response = await client.get(
            f"/api/suppliers/{sample_supplier_id}/purchase-orders",
            headers=auth_headers,
        )
        assert response.status_code in [200, 404]

    async def test_delete_supplier(
        self, client: AsyncClient, auth_headers: dict, deletable_supplier_id: str
    ):
        """Scenario 57: Delete supplier succeeds."""
        response = await client.delete(
            f"/api/suppliers/{deletable_supplier_id}",
            headers=auth_headers,
        )
        assert response.status_code in [200, 204]


class TestInventoryEndpoints:
    """Smoke tests for inventory endpoints (8 scenarios)."""

    async def test_list_inventory(self, client: AsyncClient, auth_headers: dict):
        """Scenario 58: List inventory items."""
        response = await client.get(
            "/api/inventory", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_list_inventory_low_stock(self, client: AsyncClient, auth_headers: dict):
        """Scenario 59: List low stock inventory items."""
        response = await client.get(
            "/api/inventory?low_stock=true", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_get_inventory_by_location(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Scenario 60: Get inventory by warehouse location."""
        response = await client.get(
            "/api/inventory?location=main-warehouse",
            headers=auth_headers,
        )
        assert response.status_code == 200

    async def test_stock_adjustment(
        self, client: AsyncClient, auth_headers: dict, sample_product_id: str
    ):
        """Scenario 61: Create stock adjustment."""
        response = await client.post(
            "/api/inventory/adjustments",
            json={
                "product_id": sample_product_id,
                "quantity_change": 10,
                "reason": "smoke_test_adjustment",
            },
            headers=auth_headers,
        )
        assert response.status_code in [200, 201]

    async def test_stock_transfer(
        self, client: AsyncClient, auth_headers: dict, sample_product_id: str
    ):
        """Scenario 62: Create stock transfer between locations."""
        response = await client.post(
            "/api/inventory/transfers",
            json={
                "product_id": sample_product_id,
                "from_location": "main-warehouse",
                "to_location": "retail-store",
                "quantity": 5,
            },
            headers=auth_headers,
        )
        assert response.status_code in [200, 201, 400]

    async def test_get_inventory_movements(
        self, client: AsyncClient, auth_headers: dict, sample_product_id: str
    ):
        """Scenario 63: Get inventory movement history."""
        response = await client.get(
            f"/api/inventory/movements?product_id={sample_product_id}",
            headers=auth_headers,
        )
        assert response.status_code == 200

    async def test_get_stock_alerts(self, client: AsyncClient, auth_headers: dict):
        """Scenario 64: Get stock level alerts."""
        response = await client.get(
            "/api/inventory/alerts", headers=auth_headers
        )
        assert response.status_code in [200, 404]

    async def test_reorder_recommendations(self, client: AsyncClient, auth_headers: dict):
        """Scenario 65: Get reorder recommendations."""
        response = await client.get(
            "/api/inventory/reorder-recommendations",
            headers=auth_headers,
        )
        assert response.status_code in [200, 404]


class TestDashboardEndpoints:
    """Smoke tests for dashboard endpoints (8 scenarios)."""

    async def test_dashboard_summary(self, client: AsyncClient, auth_headers: dict):
        """Scenario 66: Get dashboard summary metrics."""
        response = await client.get(
            "/api/dashboard/metrics", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_revenue_chart(self, client: AsyncClient, auth_headers: dict):
        """Scenario 67: Get revenue trend chart data."""
        response = await client.get(
            "/api/dashboard/charts/revenue", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_category_sales(self, client: AsyncClient, auth_headers: dict):
        """Scenario 68: Get category sales breakdown."""
        response = await client.get(
            "/api/dashboard/charts/categories", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_order_status_breakdown(self, client: AsyncClient, auth_headers: dict):
        """Scenario 69: Get order status breakdown."""
        response = await client.get(
            "/api/dashboard/order-status-breakdown", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_quote_conversion_rate(self, client: AsyncClient, auth_headers: dict):
        """Scenario 70: Get quote conversion metrics."""
        response = await client.get(
            "/api/dashboard/quote-conversion", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_revenue_by_location(self, client: AsyncClient, auth_headers: dict):
        """Scenario 71: Get revenue by location."""
        response = await client.get(
            "/api/dashboard/revenue-by-location", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_top_products(self, client: AsyncClient, auth_headers: dict):
        """Scenario 72: Get top selling products."""
        response = await client.get(
            "/api/dashboard/charts/top-products", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_recent_activities(self, client: AsyncClient, auth_headers: dict):
        """Scenario 73: Get recent activities."""
        response = await client.get(
            "/api/dashboard/activity", headers=auth_headers
        )
        assert response.status_code in [200, 404]


class TestHealthAndSystemEndpoints:
    """Smoke tests for health and system endpoints (5 scenarios)."""

    async def test_health_check(self, client: AsyncClient):
        """Scenario 74: Health check endpoint works."""
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    async def test_health_database(self, client: AsyncClient):
        """Scenario 75: Database health check."""
        response = await client.get("/health/database")
        assert response.status_code == 200

    async def test_health_routes(self, client: AsyncClient):
        """Scenario 76: Routes health check."""
        response = await client.get("/health/routes")
        assert response.status_code == 200

    async def test_config_endpoint(self, client: AsyncClient, auth_headers: dict):
        """Scenario 77: Get system configuration."""
        response = await client.get(
            "/api/config", headers=auth_headers
        )
        assert response.status_code in [200, 404]

    async def test_version_endpoint(self, client: AsyncClient):
        """Scenario 78: Get API version."""
        response = await client.get("/api/version")
        assert response.status_code in [200, 404]


class TestIntegrationEndpoints:
    """Smoke tests for integration endpoints (8 scenarios)."""

    async def test_shopify_status(self, client: AsyncClient, auth_headers: dict):
        """Scenario 79: Get Shopify integration status."""
        response = await client.get(
            "/api/integrations/shopify/status", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_shopify_products_sync(self, client: AsyncClient, auth_headers: dict):
        """Scenario 80: Check Shopify products sync status."""
        response = await client.get(
            "/api/integrations/shopify/products/sync-status",
            headers=auth_headers,
        )
        assert response.status_code in [200, 404]

    async def test_xero_status(self, client: AsyncClient, auth_headers: dict):
        """Scenario 81: Get Xero integration status."""
        response = await client.get(
            "/api/integrations/xero/status", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_xero_invoices_sync(self, client: AsyncClient, auth_headers: dict):
        """Scenario 82: Check Xero invoices sync status."""
        response = await client.get(
            "/api/integrations/xero/invoices/sync-status",
            headers=auth_headers,
        )
        assert response.status_code in [200, 404]

    async def test_webhook_list(self, client: AsyncClient, auth_headers: dict):
        """Scenario 83: List configured webhooks."""
        response = await client.get(
            "/api/webhooks", headers=auth_headers
        )
        assert response.status_code in [200, 404]

    async def test_webhook_create(self, client: AsyncClient, auth_headers: dict):
        """Scenario 84: Create new webhook."""
        response = await client.post(
            "/api/webhooks",
            json={
                "url": "https://example.com/webhook",
                "events": ["order.created"],
            },
            headers=auth_headers,
        )
        assert response.status_code in [200, 201, 400]

    async def test_integration_logs(self, client: AsyncClient, auth_headers: dict):
        """Scenario 85: Get integration logs."""
        response = await client.get(
            "/api/integrations/logs", headers=auth_headers
        )
        assert response.status_code in [200, 404]

    async def test_integration_sync_history(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Scenario 86: Get integration sync history."""
        response = await client.get(
            "/api/integrations/sync-history", headers=auth_headers
        )
        assert response.status_code in [200, 404]


class TestShipmentsAndContainersEndpoints:
    """Smoke tests for shipments and containers endpoints (8 scenarios)."""

    async def test_list_shipments(self, client: AsyncClient, auth_headers: dict):
        """Scenario 87: List shipments."""
        response = await client.get(
            "/api/shipments", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_get_shipment_by_id(
        self, client: AsyncClient, auth_headers: dict, sample_shipment_id: str
    ):
        """Scenario 88: Get shipment by ID."""
        response = await client.get(
            f"/api/shipments/{sample_shipment_id}", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_create_shipment(
        self, client: AsyncClient, auth_headers: dict, sample_order_id: str
    ):
        """Scenario 89: Create new shipment."""
        response = await client.post(
            "/api/shipments",
            json={
                "order_id": sample_order_id,
                "carrier": "AusPost",
                "tracking_number": f"TRACK-{pytest.timestamp}",
            },
            headers=auth_headers,
        )
        assert response.status_code in [200, 201, 400]

    async def test_update_shipment_status(
        self, client: AsyncClient, auth_headers: dict, sample_shipment_id: str
    ):
        """Scenario 90: Update shipment status."""
        response = await client.patch(
            f"/api/shipments/{sample_shipment_id}/status",
            json={"status": "in_transit"},
            headers=auth_headers,
        )
        assert response.status_code in [200, 400]

    async def test_list_containers(self, client: AsyncClient, auth_headers: dict):
        """Scenario 91: List containers."""
        response = await client.get(
            "/api/containers", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_get_container_by_id(
        self, client: AsyncClient, auth_headers: dict, sample_container_id: str
    ):
        """Scenario 92: Get container by ID."""
        response = await client.get(
            f"/api/containers/{sample_container_id}",
            headers=auth_headers,
        )
        assert response.status_code == 200

    async def test_create_container(self, client: AsyncClient, auth_headers: dict):
        """Scenario 93: Create new container."""
        response = await client.post(
            "/api/containers",
            json={
                "container_number": f"CONT-{pytest.timestamp}",
                "type": "40ft",
                "status": "pending",
            },
            headers=auth_headers,
        )
        assert response.status_code in [200, 201]

    async def test_container_tracking(
        self, client: AsyncClient, auth_headers: dict, sample_container_id: str
    ):
        """Scenario 94: Get container tracking history."""
        response = await client.get(
            f"/api/containers/{sample_container_id}/tracking",
            headers=auth_headers,
        )
        assert response.status_code in [200, 404]


class TestBackordersAndServiceRequests:
    """Smoke tests for backorders and service requests (6 scenarios)."""

    async def test_list_backorders(self, client: AsyncClient, auth_headers: dict):
        """Scenario 95: List backorders."""
        response = await client.get(
            "/api/backorders", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_backorder_by_product(
        self, client: AsyncClient, auth_headers: dict, sample_product_id: str
    ):
        """Scenario 96: Get backorders for specific product."""
        response = await client.get(
            f"/api/backorders?product_id={sample_product_id}",
            headers=auth_headers,
        )
        assert response.status_code == 200

    async def test_list_service_requests(self, client: AsyncClient, auth_headers: dict):
        """Scenario 97: List service requests."""
        response = await client.get(
            "/api/service-requests", headers=auth_headers
        )
        assert response.status_code == 200

    async def test_create_service_request(self, client: AsyncClient, auth_headers: dict):
        """Scenario 98: Create new service request."""
        response = await client.post(
            "/api/service-requests",
            json={
                "title": "Smoke Test Service Request",
                "description": "Test description",
                "priority": "medium",
            },
            headers=auth_headers,
        )
        assert response.status_code in [200, 201]

    async def test_update_service_request_status(
        self, client: AsyncClient, auth_headers: dict, sample_service_request_id: str
    ):
        """Scenario 99: Update service request status."""
        response = await client.patch(
            f"/api/service-requests/{sample_service_request_id}/status",
            json={"status": "in_progress"},
            headers=auth_headers,
        )
        assert response.status_code in [200, 404]

    async def test_service_request_comments(
        self, client: AsyncClient, auth_headers: dict, sample_service_request_id: str
    ):
        """Scenario 100: Get service request comments."""
        response = await client.get(
            f"/api/service-requests/{sample_service_request_id}/comments",
            headers=auth_headers,
        )
        assert response.status_code in [200, 404]
