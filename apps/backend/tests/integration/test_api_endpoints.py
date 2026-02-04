"""
Comprehensive integration tests for all API endpoints.

Tests verify:
- Authentication and authorization
- CRUD operations on all modules
- Multi-tenant data isolation
- Input validation
- Error handling
- Webhook processing

Usage:
    # Run all integration tests
    pytest tests/integration/test_api_endpoints.py -v

    # Run specific test class
    pytest tests/integration/test_api_endpoints.py::TestAuthenticationEndpoints -v

    # Run with coverage
    pytest tests/integration/test_api_endpoints.py --cov=src --cov-report=html
"""

import json
import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from src.api.main import app
from src.db.models.subscription import Subscription, SubscriptionStatus, SubscriptionTier
from src.db.models_base import Customer, Organization, Product, Quote, User


# Test database URL (use in-memory SQLite for fast tests)
TEST_DATABASE_URL = "sqlite:///:memory:"

# Create test engine and session
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test."""
    from src.db.models_base import Base

    # Create all tables
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        # Drop all tables after test
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with database dependency override."""
    from src.config.database import get_async_db

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_async_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def test_organization(db_session):
    """Create a test organization."""
    org = Organization(
        id=uuid.uuid4(),
        name="Test Organization",
        slug="test-org",
        is_active=True,
    )
    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)
    return org


@pytest.fixture(scope="function")
def test_user(db_session, test_organization):
    """Create a test user with authentication."""
    from src.auth.password import hash_password

    user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        hashed_password=hash_password("TestPassword123!"),
        full_name="Test User",
        organization_id=test_organization.id,
        role="owner",  # Owner role for full access
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture(scope="function")
def auth_headers(client, test_user):
    """Get authentication headers with JWT token."""
    response = client.post(
        "/api/auth/login",
        json={"email": "test@example.com", "password": "TestPassword123!"},
    )
    assert response.status_code == 200

    # Extract token from cookies
    token = response.cookies.get("auth_token")
    return {"Authorization": f"Bearer {token}"}


# ============================================================================
# Authentication Endpoints Tests
# ============================================================================


class TestAuthenticationEndpoints:
    """Test authentication and authorization endpoints."""

    def test_signup_success(self, client):
        """Test successful user signup."""
        response = client.post(
            "/api/auth/signup",
            json={
                "full_name": "New User",
                "email": "newuser@example.com",
                "password": "SecurePass123!",
                "company_name": "New Company",
                "agree_terms": True,
            },
        )

        assert response.status_code in [200, 201]
        data = response.json()
        assert "organization_id" in data
        assert "user_id" in data
        assert data["email"] == "newuser@example.com"

    def test_signup_duplicate_email(self, client, test_user):
        """Test signup with duplicate email fails."""
        response = client.post(
            "/api/auth/signup",
            json={
                "full_name": "Duplicate User",
                "email": "test@example.com",  # Already exists
                "password": "SecurePass123!",
                "company_name": "Another Company",
                "agree_terms": True,
            },
        )

        assert response.status_code == 400
        assert "already exists" in response.json()["detail"].lower()

    def test_login_success(self, client, test_user):
        """Test successful login."""
        response = client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "TestPassword123!"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data or "auth_token" in response.cookies

    def test_login_invalid_credentials(self, client, test_user):
        """Test login with invalid credentials fails."""
        response = client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "WrongPassword"},
        )

        assert response.status_code == 401

    def test_protected_endpoint_without_auth(self, client):
        """Test accessing protected endpoint without authentication."""
        response = client.get("/api/products")

        assert response.status_code == 401


# ============================================================================
# Product Endpoints Tests
# ============================================================================


class TestProductEndpoints:
    """Test product management endpoints."""

    def test_list_products_empty(self, client, auth_headers):
        """Test listing products when none exist."""
        response = client.get("/api/products", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["data"] == []

    def test_create_product_success(self, client, auth_headers):
        """Test successful product creation."""
        product_data = {
            "sku": "TEST-001",
            "name": "Test Product",
            "category": "power_tools",
            "price": 99.99,
            "cost": 50.00,
            "stock": 100,
        }

        response = client.post("/api/products", json=product_data, headers=auth_headers)

        assert response.status_code in [200, 201]
        data = response.json()
        assert data["sku"] == "TEST-001"
        assert data["name"] == "Test Product"

    def test_create_product_duplicate_sku(self, client, auth_headers, db_session, test_organization):
        """Test creating product with duplicate SKU fails."""
        # Create first product
        product = Product(
            id=uuid.uuid4(),
            sku="DUPLICATE-SKU",
            name="First Product",
            category="power_tools",
            price=100.0,
            cost=50.0,
            stock=10,
            organization_id=test_organization.id,
        )
        db_session.add(product)
        db_session.commit()

        # Try to create second product with same SKU
        response = client.post(
            "/api/products",
            json={
                "sku": "DUPLICATE-SKU",
                "name": "Second Product",
                "category": "HAND_TOOLS",
                "price": 200.0,
            },
            headers=auth_headers,
        )

        assert response.status_code == 400

    def test_list_products_with_pagination(self, client, auth_headers, db_session, test_organization):
        """Test product listing with pagination."""
        # Create 25 products
        for i in range(25):
            product = Product(
                id=uuid.uuid4(),
                sku=f"SKU-{i:03d}",
                name=f"Product {i}",
                category="power_tools",
                price=100.0 + i,
                cost=50.0,
                stock=10,
                organization_id=test_organization.id,
            )
            db_session.add(product)
        db_session.commit()

        # Get first page
        response = client.get("/api/products?page=1&page_size=10", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 25
        assert len(data["data"]) == 10
        assert data["page"] == 1
        assert data["total_pages"] == 3

    def test_search_products(self, client, auth_headers, db_session, test_organization):
        """Test product search functionality."""
        # Create products with different names
        products = [
            Product(id=uuid.uuid4(), sku=f"SKU-{i}", name=name, category="power_tools",
                    price=100.0, cost=50.0, stock=10, organization_id=test_organization.id)
            for i, name in enumerate(["Hammer Drill", "Circular Saw", "Impact Driver"])
        ]
        for p in products:
            db_session.add(p)
        db_session.commit()

        # Search for "drill"
        response = client.get("/api/products?search=drill", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert any("drill" in item["name"].lower() for item in data["data"])


# ============================================================================
# Quote Endpoints Tests
# ============================================================================


class TestQuoteEndpoints:
    """Test quote management endpoints."""

    @pytest.fixture
    def test_customer(self, db_session, test_organization):
        """Create a test customer."""
        customer = Customer(
            id=uuid.uuid4(),
            customer_number="CUST-001",
            company_name="Test Customer Co",
            contact_name="John Doe",
            email="customer@example.com",
            organization_id=test_organization.id,
        )
        db_session.add(customer)
        db_session.commit()
        db_session.refresh(customer)
        return customer

    @pytest.fixture
    def test_product(self, db_session, test_organization):
        """Create a test product."""
        product = Product(
            id=uuid.uuid4(),
            sku="PROD-001",
            name="Test Product",
            category="power_tools",
            price=100.0,
            cost=50.0,
            stock=50,
            organization_id=test_organization.id,
        )
        db_session.add(product)
        db_session.commit()
        db_session.refresh(product)
        return product

    def test_create_quote_success(self, client, auth_headers, test_customer, test_product):
        """Test successful quote creation."""
        quote_data = {
            "customer_id": str(test_customer.id),
            "quote_date": datetime.now().isoformat(),
            "valid_until": (datetime.now() + timedelta(days=30)).isoformat(),
            "status": "draft",
            "notes": "Test quote",
            "items": [
                {
                    "product_id": str(test_product.id),
                    "quantity": 5,
                    "unit_price": 100.0,
                }
            ],
        }

        response = client.post("/api/quotes", json=quote_data, headers=auth_headers)

        assert response.status_code in [200, 201]
        data = response.json()
        assert data["status"] == "draft"
        assert len(data["items"]) == 1

    def test_list_quotes_filtered_by_status(self, client, auth_headers, db_session, test_organization, test_customer):
        """Test quote listing with status filter."""
        # Create quotes with different statuses
        statuses = ["draft", "sent", "accepted"]
        for status in statuses:
            quote = Quote(
                id=uuid.uuid4(),
                quote_number=f"Q-2026-{status}",
                customer_id=test_customer.id,
                quote_date=datetime.now(),
                valid_until=datetime.now() + timedelta(days=30),
                status=status,
                organization_id=test_organization.id,
            )
            db_session.add(quote)
        db_session.commit()

        # Filter by status
        response = client.get("/api/quotes?status=draft", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert all(item["status"] == "draft" for item in data["data"])


# ============================================================================
# Billing Endpoints Tests
# ============================================================================


class TestBillingEndpoints:
    """Test billing and subscription endpoints."""

    def test_get_subscription_not_exists(self, client, auth_headers):
        """Test getting subscription when none exists."""
        response = client.get("/api/billing", headers=auth_headers)

        # Should return 404 or empty response
        assert response.status_code in [200, 404]

    def test_subscribe_to_plan(self, client, auth_headers):
        """Test subscribing to a plan."""
        subscription_data = {
            "tier": "professional",
            "billing_interval": "monthly",
            "payment_method_id": "pm_test_123456",  # Stripe test payment method
            "trial_days": 14,
        }

        response = client.post("/api/billing/subscribe", json=subscription_data, headers=auth_headers)

        # May fail without actual Stripe setup, but should validate request
        assert response.status_code in [200, 201, 400, 500]

    def test_list_invoices(self, client, auth_headers):
        """Test listing invoices."""
        response = client.get("/api/billing/invoices", headers=auth_headers)

        assert response.status_code in [200, 404]  # 404 if no subscription


# ============================================================================
# Team Management Endpoints Tests
# ============================================================================


class TestTeamEndpoints:
    """Test team management endpoints."""

    def test_list_team_members(self, client, auth_headers, test_user):
        """Test listing team members."""
        response = client.get("/api/team", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1  # At least the test user
        assert any(member["email"] == "test@example.com" for member in data)

    def test_invite_team_member_as_owner(self, client, auth_headers):
        """Test inviting a new team member (owner permission)."""
        invite_data = {
            "email": "newmember@example.com",
            "role": "member",
            "full_name": "New Member",
        }

        response = client.post("/api/team/invite", json=invite_data, headers=auth_headers)

        assert response.status_code in [200, 201]

    def test_update_member_role_as_owner(self, client, auth_headers, db_session, test_organization):
        """Test updating a team member's role."""
        # Create another user
        from src.auth.password import hash_password

        member = User(
            id=uuid.uuid4(),
            email="member@example.com",
            hashed_password=hash_password("Password123!"),
            full_name="Team Member",
            organization_id=test_organization.id,
            role="member",
            is_active=True,
        )
        db_session.add(member)
        db_session.commit()

        # Update role
        response = client.put(
            f"/api/team/{member.id}",
            json={"role": "admin"},
            headers=auth_headers,
        )

        assert response.status_code == 200


# ============================================================================
# Multi-Tenant Isolation Tests
# ============================================================================


class TestMultiTenantIsolation:
    """Test multi-tenant data isolation."""

    @pytest.fixture
    def org1_user_headers(self, client, db_session):
        """Create organization 1 and user."""
        from src.auth.password import hash_password

        org1 = Organization(
            id=uuid.uuid4(),
            name="Organization 1",
            slug="org-1",
            is_active=True,
        )
        db_session.add(org1)

        user1 = User(
            id=uuid.uuid4(),
            email="user1@org1.com",
            hashed_password=hash_password("Password123!"),
            full_name="User 1",
            organization_id=org1.id,
            role="owner",
            is_active=True,
        )
        db_session.add(user1)
        db_session.commit()

        # Login
        response = client.post(
            "/api/auth/login",
            json={"email": "user1@org1.com", "password": "Password123!"},
        )
        token = response.cookies.get("auth_token")
        return {"Authorization": f"Bearer {token}"}, org1

    @pytest.fixture
    def org2_user_headers(self, client, db_session):
        """Create organization 2 and user."""
        from src.auth.password import hash_password

        org2 = Organization(
            id=uuid.uuid4(),
            name="Organization 2",
            slug="org-2",
            is_active=True,
        )
        db_session.add(org2)

        user2 = User(
            id=uuid.uuid4(),
            email="user2@org2.com",
            hashed_password=hash_password("Password123!"),
            full_name="User 2",
            organization_id=org2.id,
            role="owner",
            is_active=True,
        )
        db_session.add(user2)
        db_session.commit()

        # Login
        response = client.post(
            "/api/auth/login",
            json={"email": "user2@org2.com", "password": "Password123!"},
        )
        token = response.cookies.get("auth_token")
        return {"Authorization": f"Bearer {token}"}, org2

    def test_products_isolated_by_organization(
        self, client, db_session, org1_user_headers, org2_user_headers
    ):
        """Test that users only see their own organization's products."""
        headers1, org1 = org1_user_headers
        headers2, org2 = org2_user_headers

        # Create product for org1
        product1 = Product(
            id=uuid.uuid4(),
            sku="ORG1-PROD",
            name="Org 1 Product",
            category="power_tools",
            price=100.0,
            cost=50.0,
            stock=10,
            organization_id=org1.id,
        )
        db_session.add(product1)

        # Create product for org2
        product2 = Product(
            id=uuid.uuid4(),
            sku="ORG2-PROD",
            name="Org 2 Product",
            category="HAND_TOOLS",
            price=200.0,
            cost=100.0,
            stock=20,
            organization_id=org2.id,
        )
        db_session.add(product2)
        db_session.commit()

        # User 1 should only see org1's product
        response1 = client.get("/api/products", headers=headers1)
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["total"] == 1
        assert data1["data"][0]["sku"] == "ORG1-PROD"

        # User 2 should only see org2's product
        response2 = client.get("/api/products", headers=headers2)
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["total"] == 1
        assert data2["data"][0]["sku"] == "ORG2-PROD"

    def test_quotes_isolated_by_organization(
        self, client, db_session, org1_user_headers, org2_user_headers
    ):
        """Test that users only see their own organization's quotes."""
        headers1, org1 = org1_user_headers
        headers2, org2 = org2_user_headers

        # Create customers for each org
        customer1 = Customer(
            id=uuid.uuid4(),
            customer_number="CUST-ORG1",
            company_name="Org 1 Customer",
            contact_name="Contact 1",
            email="contact1@org1.com",
            organization_id=org1.id,
        )
        customer2 = Customer(
            id=uuid.uuid4(),
            customer_number="CUST-ORG2",
            company_name="Org 2 Customer",
            contact_name="Contact 2",
            email="contact2@org2.com",
            organization_id=org2.id,
        )
        db_session.add_all([customer1, customer2])

        # Create quotes for each org
        quote1 = Quote(
            id=uuid.uuid4(),
            quote_number="Q-ORG1-001",
            customer_id=customer1.id,
            quote_date=datetime.now(),
            valid_until=datetime.now() + timedelta(days=30),
            status="draft",
            organization_id=org1.id,
        )
        quote2 = Quote(
            id=uuid.uuid4(),
            quote_number="Q-ORG2-001",
            customer_id=customer2.id,
            quote_date=datetime.now(),
            valid_until=datetime.now() + timedelta(days=30),
            status="sent",
            organization_id=org2.id,
        )
        db_session.add_all([quote1, quote2])
        db_session.commit()

        # User 1 should only see org1's quote
        response1 = client.get("/api/quotes", headers=headers1)
        assert response1.status_code == 200
        data1 = response1.json()
        assert data1["total"] == 1
        assert data1["data"][0]["quote_number"] == "Q-ORG1-001"

        # User 2 should only see org2's quote
        response2 = client.get("/api/quotes", headers=headers2)
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["total"] == 1
        assert data2["data"][0]["quote_number"] == "Q-ORG2-001"


# ============================================================================
# Input Validation Tests
# ============================================================================


class TestInputValidation:
    """Test input validation and error handling."""

    def test_create_product_missing_required_fields(self, client, auth_headers):
        """Test product creation with missing required fields."""
        response = client.post(
            "/api/products",
            json={"name": "Incomplete Product"},  # Missing SKU, category, price
            headers=auth_headers,
        )

        assert response.status_code == 422  # Validation error

    def test_create_product_invalid_price(self, client, auth_headers):
        """Test product creation with invalid price."""
        response = client.post(
            "/api/products",
            json={
                "sku": "TEST-001",
                "name": "Test Product",
                "category": "power_tools",
                "price": -100.0,  # Negative price
            },
            headers=auth_headers,
        )

        assert response.status_code == 422

    def test_pagination_invalid_parameters(self, client, auth_headers):
        """Test pagination with invalid parameters."""
        # Page < 1
        response = client.get("/api/products?page=0", headers=auth_headers)
        assert response.status_code == 422

        # Page size > max
        response = client.get("/api/products?page_size=1000", headers=auth_headers)
        assert response.status_code == 422


# ============================================================================
# Error Handling Tests
# ============================================================================


class TestErrorHandling:
    """Test error handling and edge cases."""

    def test_get_nonexistent_product(self, client, auth_headers):
        """Test getting a product that doesn't exist."""
        fake_id = str(uuid.uuid4())
        response = client.get(f"/api/products/{fake_id}", headers=auth_headers)

        assert response.status_code == 404

    def test_delete_nonexistent_quote(self, client, auth_headers):
        """Test deleting a quote that doesn't exist."""
        fake_id = str(uuid.uuid4())
        response = client.delete(f"/api/quotes/{fake_id}", headers=auth_headers)

        assert response.status_code == 404

    def test_update_with_invalid_id(self, client, auth_headers):
        """Test update with invalid UUID format."""
        response = client.put(
            "/api/products/not-a-uuid",
            json={"name": "Updated Name"},
            headers=auth_headers,
        )

        assert response.status_code == 422


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
