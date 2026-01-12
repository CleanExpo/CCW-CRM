"""
Comprehensive Customers API tests.

Tests all CRUD operations, validation, pagination, and edge cases.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.demo_models import Customer


@pytest.fixture
async def auth_token(client: AsyncClient) -> str:
    """Get authentication token for testing."""
    response = await client.post(
        "/api/auth/login",
        json={"email": "admin@demo.com", "password": "demo123"},
    )
    assert response.status_code == 200
    return response.cookies.get("auth_token")


class TestCustomersList:
    """Test customers list endpoint with pagination and filtering."""

    async def test_list_customers_success(self, client: AsyncClient, auth_token: str):
        """Test listing customers with default pagination."""
        response = await client.get(
            "/api/customers",
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
        assert data["total"] > 0

    async def test_list_customers_pagination(self, client: AsyncClient, auth_token: str):
        """Test customers pagination."""
        # Get first page
        response = await client.get(
            "/api/customers?page=1&page_size=5",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        assert len(data["data"]) <= 5
        assert data["page"] == 1
        assert data["page_size"] == 5

    async def test_list_customers_search(self, client: AsyncClient, auth_token: str):
        """Test customers search functionality."""
        response = await client.get(
            "/api/customers?search=building",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        # If we have matching customers, verify search works
        if data["total"] > 0:
            customer = data["data"][0]
            search_term = "building"
            assert (
                search_term in customer["company_name"].lower()
                or search_term in customer.get("contact_name", "").lower()
                or search_term in customer.get("email", "").lower()
            )

    async def test_list_customers_unauthenticated(self, client: AsyncClient):
        """Test listing customers without authentication (should fail)."""
        response = await client.get("/api/customers")

        # Should redirect to login or return 401
        assert response.status_code in [401, 307]


class TestCustomerCreate:
    """Test customer creation endpoint."""

    async def test_create_customer_success(self, client: AsyncClient, auth_token: str):
        """Test creating a new customer."""
        new_customer = {
            "company_name": "Test Company Pty Ltd",
            "contact_name": "John Smith",
            "email": "john@testcompany.com.au",
            "phone": "0412 345 678",
            "address": "123 Test Street",
            "city": "Brisbane",
            "state": "QLD",
            "postcode": "4000",
            "abn": "12 345 678 901",
        }

        response = await client.post(
            "/api/customers",
            json=new_customer,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 201
        data = response.json()

        # Verify created customer
        assert data["company_name"] == new_customer["company_name"]
        assert data["email"] == new_customer["email"]
        assert "id" in data
        assert "customer_number" in data
        assert "created_at" in data

        # Verify customer number format (CUST-YYYY-NNN)
        assert data["customer_number"].startswith("CUST-")

    async def test_create_customer_auto_generates_number(self, client: AsyncClient, auth_token: str):
        """Test that customer number is auto-generated."""
        new_customer = {
            "company_name": "Auto Number Test Pty Ltd",
            "contact_name": "Jane Doe",
            "email": "jane@autonumbertest.com.au",
            "phone": "0413 456 789",
            "address": "456 Test Avenue",
            "city": "Sydney",
            "state": "NSW",
            "postcode": "2000",
        }

        response = await client.post(
            "/api/customers",
            json=new_customer,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 201
        data = response.json()

        # Verify customer number exists and follows format
        assert "customer_number" in data
        assert data["customer_number"].startswith("CUST-")
        # Format: CUST-YYYY-NNN where NNN is 3+ digits
        parts = data["customer_number"].split("-")
        assert len(parts) == 3
        assert parts[0] == "CUST"
        assert len(parts[1]) == 4  # Year
        assert parts[2].isdigit()  # Sequential number

    async def test_create_customer_duplicate_email(self, client: AsyncClient, auth_token: str):
        """Test creating customer with duplicate email (should fail)."""
        customer = {
            "company_name": "Duplicate Email Test",
            "email": "admin@demo.com",  # Assuming this exists
            "phone": "0414 567 890",
            "address": "789 Duplicate Street",
            "city": "Melbourne",
            "state": "VIC",
            "postcode": "3000",
        }

        response = await client.post(
            "/api/customers",
            json=customer,
            cookies={"auth_token": auth_token},
        )

        # Should fail with 400 or 409 (Conflict)
        assert response.status_code in [400, 409]

    async def test_create_customer_missing_required_fields(self, client: AsyncClient, auth_token: str):
        """Test creating customer with missing required fields."""
        incomplete_customer = {
            "contact_name": "Missing Fields Customer",
            # Missing company_name, email, phone
        }

        response = await client.post(
            "/api/customers",
            json=incomplete_customer,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 422  # Validation error

    async def test_create_customer_invalid_email(self, client: AsyncClient, auth_token: str):
        """Test creating customer with invalid email format."""
        invalid_customer = {
            "company_name": "Invalid Email Test",
            "email": "not-an-email",
            "phone": "0415 678 901",
            "address": "123 Invalid Street",
            "city": "Brisbane",
            "state": "QLD",
            "postcode": "4000",
        }

        response = await client.post(
            "/api/customers",
            json=invalid_customer,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 422  # Validation error

    async def test_create_customer_xero_integration_fields(self, client: AsyncClient, auth_token: str):
        """Test creating customer with Xero integration fields."""
        new_customer = {
            "company_name": "Xero Integration Test",
            "email": "xero@integrationtest.com.au",
            "phone": "0416 789 012",
            "address": "999 Xero Street",
            "city": "Perth",
            "state": "WA",
            "postcode": "6000",
            "xero_contact_id": "550e8400-e29b-41d4-a716-446655440000",
        }

        response = await client.post(
            "/api/customers",
            json=new_customer,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 201
        data = response.json()

        # Verify Xero fields are stored
        assert data["xero_contact_id"] == new_customer["xero_contact_id"]


class TestCustomerUpdate:
    """Test customer update endpoint."""

    async def test_update_customer_success(self, client: AsyncClient, auth_token: str, db_session: AsyncSession):
        """Test updating an existing customer."""
        # Get an existing customer
        result = await db_session.execute(select(Customer).limit(1))
        customer = result.scalar_one()

        updated_data = {
            "company_name": f"{customer.company_name} - Updated",
            "phone": "0417 890 123",
            "address": "Updated Address 123",
        }

        response = await client.put(
            f"/api/customers/{customer.id}",
            json=updated_data,
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["company_name"] == updated_data["company_name"]
        assert data["phone"] == updated_data["phone"]
        assert data["address"] == updated_data["address"]

    async def test_update_customer_not_found(self, client: AsyncClient, auth_token: str):
        """Test updating non-existent customer."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        response = await client.put(
            f"/api/customers/{fake_id}",
            json={"company_name": "Updated Name"},
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 404


class TestCustomerDelete:
    """Test customer deletion endpoint."""

    async def test_delete_customer_success(self, client: AsyncClient, auth_token: str):
        """Test deleting a customer."""
        # First create a test customer
        new_customer = {
            "company_name": "Customer to Delete Pty Ltd",
            "email": "delete@testcustomer.com.au",
            "phone": "0418 901 234",
            "address": "123 Delete Street",
            "city": "Adelaide",
            "state": "SA",
            "postcode": "5000",
        }

        create_response = await client.post(
            "/api/customers",
            json=new_customer,
            cookies={"auth_token": auth_token},
        )
        assert create_response.status_code == 201
        customer_id = create_response.json()["id"]

        # Now delete it
        response = await client.delete(
            f"/api/customers/{customer_id}",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 204

        # Verify it's deleted (should return 404)
        get_response = await client.get(
            f"/api/customers/{customer_id}",
            cookies={"auth_token": auth_token},
        )

        assert get_response.status_code == 404

    async def test_delete_customer_not_found(self, client: AsyncClient, auth_token: str):
        """Test deleting non-existent customer."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        response = await client.delete(
            f"/api/customers/{fake_id}",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 404


class TestCustomerGet:
    """Test getting single customer by ID."""

    async def test_get_customer_success(self, client: AsyncClient, auth_token: str, db_session: AsyncSession):
        """Test getting a single customer by ID."""
        # Get an existing customer
        result = await db_session.execute(select(Customer).limit(1))
        customer = result.scalar_one()

        response = await client.get(
            f"/api/customers/{customer.id}",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == str(customer.id)
        assert data["company_name"] == customer.company_name
        assert data["customer_number"] == customer.customer_number

    async def test_get_customer_not_found(self, client: AsyncClient, auth_token: str):
        """Test getting non-existent customer."""
        fake_id = "00000000-0000-0000-0000-000000000000"

        response = await client.get(
            f"/api/customers/{fake_id}",
            cookies={"auth_token": auth_token},
        )

        assert response.status_code == 404
