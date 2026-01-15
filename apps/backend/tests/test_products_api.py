"""
Comprehensive Products API tests.

Tests all CRUD operations, validation, pagination, and edge cases.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Product


class TestProductsList:
    """Test products list endpoint with pagination and filtering."""

    async def test_list_products_success(self, client: AsyncClient, auth_token: str):
        """Test listing products with default pagination."""
        response = await client.get(
            "/api/products",
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
        assert data["total"] > 0

    async def test_list_products_pagination(self, client: AsyncClient, auth_token: str):
        """Test products pagination."""
        # Get first page
        response = await client.get(
            "/api/products?page=1&page_size=5",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["items"]) <= 5
        assert data["page"] == 1
        assert data["page_size"] == 5

    async def test_list_products_search(self, client: AsyncClient, auth_token: str):
        """Test products search functionality."""
        response = await client.get(
            "/api/products?search=drill",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        # If we have drill products, verify search works
        if data["total"] > 0:
            product = data["items"][0]
            assert "drill" in product["name"].lower() or "drill" in product.get("description", "").lower() or "drill" in product["sku"].lower()

    async def test_list_products_category_filter(self, client: AsyncClient, auth_token: str):
        """Test filtering products by category."""
        response = await client.get(
            "/api/products?category=power_tools",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        # If we have power tools, verify filter works
        if data["total"] > 0:
            for product in data["items"]:
                assert product["category"] == "power_tools"

    async def test_list_products_unauthenticated(self, client: AsyncClient):
        """Test listing products without authentication (should fail in production)."""
        response = await client.get("/api/products")

        # In development mode: returns 200 (warning logged)
        # In production: returns 401 or 307 redirect
        assert response.status_code in [200, 401, 307]


class TestProductCreate:
    """Test product creation endpoint."""

    async def test_create_product_success(self, client: AsyncClient, auth_token: str):
        """Test creating a new product."""
        new_product = {
            "sku": "TEST-SKU-001",
            "name": "Test Product",
            "description": "A test product for automated testing",
            "category": "hand_tools",
            "price": 99.99,
            "cost": 50.00,
            "stock": 100,
            "warehouse_location": "A1-B2",
            "is_active": True,
        }

        response = await client.post(
            "/api/products",
            json=new_product,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 201
        data = response.json()

        # Verify created product
        assert data["sku"] == new_product["sku"]
        assert data["name"] == new_product["name"]
        assert data["price"] == new_product["price"]
        assert "id" in data
        assert "created_at" in data

    async def test_create_product_duplicate_sku(self, client: AsyncClient, auth_token: str):
        """Test creating product with duplicate SKU (should fail)."""
        product = {
            "sku": "DRILL-001",  # Assuming this exists from seed data
            "name": "Duplicate Product",
            "category": "hand_tools",
            "price": 99.99,
            "cost": 50.00,
            "stock": 10,
        }

        response = await client.post(
            "/api/products",
            json=product,
            cookies={"auth_token": auth_token},
        )

        # Should fail with 400 or 409 (Conflict)
        assert response.status_code in [400, 409]

    async def test_create_product_missing_required_fields(self, client: AsyncClient, auth_token: str):
        """Test creating product with missing required fields."""
        incomplete_product = {
            "name": "Incomplete Product",
            # Missing SKU, category, price, etc.
        }

        response = await client.post(
            "/api/products",
            json=incomplete_product,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 422  # Validation error

    async def test_create_product_invalid_price(self, client: AsyncClient, auth_token: str):
        """Test creating product with invalid price."""
        invalid_product = {
            "sku": "TEST-INVALID-001",
            "name": "Invalid Price Product",
            "category": "hand_tools",
            "price": -10.00,  # Negative price
            "cost": 5.00,
            "stock": 10,
        }

        response = await client.post(
            "/api/products",
            json=invalid_product,
            cookies={"auth_token": auth_token},
        )

        # API returns 400 (Bad Request) or 422 (Validation Error) for invalid price
        assert response.status_code in [400, 422]


class TestProductUpdate:
    """Test product update endpoint."""

    async def test_update_product_success(self, client: AsyncClient, auth_token: str, db_session: AsyncSession):
        """Test updating an existing product."""
        # Get an existing product
        result = await db_session.execute(select(Product).limit(1))
        product = result.scalar_one()

        updated_data = {
            "name": f"{product.name} - Updated",
            "price": float(product.price) + 10.00,
            "stock": product.stock + 5,
        }

        response = await client.put(
            f"/api/products/{product.id}",
            json=updated_data,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["name"] == updated_data["name"]
        assert data["price"] == updated_data["price"]
        assert data["stock"] == updated_data["stock"]

    async def test_update_product_not_found(self, client: AsyncClient, auth_token: str):
        """Test updating non-existent product."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        response = await client.put(
            f"/api/products/{fake_id}",
            json={"name": "Updated Name"},
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 404


class TestProductDelete:
    """Test product deletion endpoint."""

    async def test_delete_product_success(self, client: AsyncClient, auth_token: str):
        """Test deleting a product (soft delete)."""
        # First create a test product
        new_product = {
            "sku": "TEST-DELETE-001",
            "name": "Product to Delete",
            "category": "hand_tools",
            "price": 10.00,
            "cost": 5.00,
            "stock": 1,
        }

        create_response = await client.post(
            "/api/products",
            json=new_product,
            cookies={"auth_token": auth_token},
        )
        assert create_response.status_code == 201
        product_id = create_response.json()["id"]

        # Now delete it
        response = await client.delete(
            f"/api/products/{product_id}",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 204

        # Verify it's soft deleted (is_active = False)
        get_response = await client.get(
            f"/api/products/{product_id}",
            cookies={"auth_token": auth_token},
        )

        # Should either return 404 or show is_active = False
        if get_response.status_code == 200:
            data = get_response.json()
            assert data["is_active"] is False

    async def test_delete_product_not_found(self, client: AsyncClient, auth_token: str):
        """Test deleting non-existent product."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        response = await client.delete(
            f"/api/products/{fake_id}",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 404


class TestProductGet:
    """Test getting single product by ID."""

    async def test_get_product_success(self, client: AsyncClient, auth_token: str, db_session: AsyncSession):
        """Test getting a single product by ID."""
        # Get an existing product
        result = await db_session.execute(select(Product).limit(1))
        product = result.scalar_one()

        response = await client.get(
            f"/api/products/{product.id}",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == str(product.id)
        assert data["sku"] == product.sku
        assert data["name"] == product.name

    async def test_get_product_not_found(self, client: AsyncClient, auth_token: str):
        """Test getting non-existent product."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        response = await client.get(
            f"/api/products/{fake_id}",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 404
