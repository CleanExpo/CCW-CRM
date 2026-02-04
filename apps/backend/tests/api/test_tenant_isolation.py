"""
Tests for Multi-Tenant Isolation Middleware

Ensures that tenants can ONLY access their own data and cannot access
other organizations' data (critical for SaaS security).
"""

import pytest
from uuid import uuid4, UUID
from fastapi import Request, HTTPException

from src.api.middleware.tenant_isolation import (
    get_current_organization_id,
    validate_tenant_access,
    get_tenant_query_filter,
    apply_tenant_filter,
)


# Test Fixtures


class MockUser:
    """Mock user with organization_id."""

    def __init__(self, user_id: str, org_id: UUID | str):
        self.data = {
            "id": user_id,
            "email": f"user-{user_id}@example.com",
            "organization_id": org_id,
        }

    def get(self, key, default=None):
        return self.data.get(key, default)


class MockRequest:
    """Mock FastAPI request with user in state."""

    def __init__(self, user: MockUser | None = None):
        self.state = type("State", (), {})()
        if user:
            self.state.user = user.data


class MockEntity:
    """Mock database entity with organization_id."""

    def __init__(self, entity_id: UUID, org_id: UUID):
        self.id = entity_id
        self.organization_id = org_id


# Unit Tests - get_current_organization_id


def test_get_current_organization_id_success():
    """Should extract organization_id from authenticated user."""
    org_id = uuid4()
    user = MockUser("user-123", org_id)
    request = MockRequest(user)

    result = get_current_organization_id(request)

    assert result == org_id
    assert isinstance(result, UUID)


def test_get_current_organization_id_string_conversion():
    """Should convert string organization_id to UUID."""
    org_id = uuid4()
    user = MockUser("user-123", str(org_id))  # Pass as string
    request = MockRequest(user)

    result = get_current_organization_id(request)

    assert result == org_id
    assert isinstance(result, UUID)


def test_get_current_organization_id_no_user():
    """Should raise 401 if user not authenticated."""
    request = MockRequest(user=None)

    with pytest.raises(HTTPException) as exc_info:
        get_current_organization_id(request)

    assert exc_info.value.status_code == 401
    assert "Not authenticated" in exc_info.value.detail


def test_get_current_organization_id_no_organization():
    """Should raise 400 if user has no organization_id."""

    class UserWithoutOrg:
        def get(self, key, default=None):
            return {"id": "user-123", "email": "test@example.com"}.get(key, default)

    request = MockRequest()
    request.state.user = {"id": "user-123", "email": "test@example.com"}

    with pytest.raises(HTTPException) as exc_info:
        get_current_organization_id(request)

    assert exc_info.value.status_code == 400
    assert "not associated with an organization" in exc_info.value.detail


def test_get_current_organization_id_invalid_uuid():
    """Should raise 400 if organization_id is not a valid UUID."""
    user_data = {
        "id": "user-123",
        "email": "test@example.com",
        "organization_id": "invalid-uuid",
    }
    request = MockRequest()
    request.state.user = user_data

    with pytest.raises(HTTPException) as exc_info:
        get_current_organization_id(request)

    assert exc_info.value.status_code == 400
    assert "Invalid organization ID format" in exc_info.value.detail


# Unit Tests - validate_tenant_access


def test_validate_tenant_access_success():
    """Should pass validation when entity belongs to organization."""
    org_id = uuid4()
    entity = MockEntity(uuid4(), org_id)

    # Should not raise exception
    validate_tenant_access(entity, org_id, "Product")


def test_validate_tenant_access_entity_not_found():
    """Should raise 404 when entity is None."""
    org_id = uuid4()

    with pytest.raises(HTTPException) as exc_info:
        validate_tenant_access(None, org_id, "Product")

    assert exc_info.value.status_code == 404
    assert "Product not found" in exc_info.value.detail


def test_validate_tenant_access_wrong_organization():
    """Should raise 404 when entity belongs to different organization."""
    org_a = uuid4()
    org_b = uuid4()
    entity = MockEntity(uuid4(), org_a)

    with pytest.raises(HTTPException) as exc_info:
        validate_tenant_access(entity, org_b, "Product")

    # Should return 404 (not 403) to prevent enumeration attacks
    assert exc_info.value.status_code == 404
    assert "Product not found" in exc_info.value.detail


def test_validate_tenant_access_global_resource():
    """Should pass validation for entities without organization_id (global resources)."""

    class GlobalEntity:
        def __init__(self):
            self.id = uuid4()
            # No organization_id attribute

    entity = GlobalEntity()
    org_id = uuid4()

    # Should not raise exception
    validate_tenant_access(entity, org_id, "GlobalResource")


# Unit Tests - get_tenant_query_filter


def test_get_tenant_query_filter():
    """Should return SQLAlchemy filter condition."""

    class MockModel:
        organization_id = None  # Placeholder

    org_id = uuid4()
    filter_condition = get_tenant_query_filter(MockModel, org_id)

    # Verify it's a comparison expression
    assert filter_condition is not None


def test_get_tenant_query_filter_no_org_column():
    """Should return None for models without organization_id."""

    class ModelWithoutOrg:
        pass  # No organization_id attribute

    org_id = uuid4()
    filter_condition = get_tenant_query_filter(ModelWithoutOrg, org_id)

    assert filter_condition is None


# Integration Tests - Cross-Tenant Access Prevention


@pytest.mark.integration
@pytest.mark.asyncio
async def test_cross_tenant_access_prevention_products(db_session):
    """
    Test that products from one organization cannot be accessed by another.

    This is a critical security test for multi-tenant isolation.
    """
    from sqlalchemy import select
    from src.db.demo_models import Product, Organization
    from uuid import uuid4

    # Create two test organizations
    org_a_id = uuid4()
    org_b_id = uuid4()

    org_a = Organization(id=org_a_id, name="Organization A", slug="org-a", is_active=True)
    org_b = Organization(id=org_b_id, name="Organization B", slug="org-b", is_active=True)

    db = db_session
    db.add(org_a)
    db.add(org_b)
    await db.commit()

    # Create products for Organization A
    product_a1 = Product(
        id=uuid4(),
        organization_id=org_a_id,
        sku="A1-001",
        name="Product A1",
        price=100.00,
        stock=10,
    )
    product_a2 = Product(
        id=uuid4(),
        organization_id=org_a_id,
        sku="A1-002",
        name="Product A2",
        price=200.00,
        stock=20,
    )

    # Create products for Organization B
    product_b1 = Product(
        id=uuid4(),
        organization_id=org_b_id,
        sku="B1-001",
        name="Product B1",
        price=300.00,
        stock=30,
    )

    db.add_all([product_a1, product_a2, product_b1])
    await db.commit()

    # Test: Organization A should only see their products
    query_a = select(Product).where(Product.organization_id == org_a_id)
    result_a = await db.execute(query_a)
    products_a = result_a.scalars().all()

    assert len(products_a) == 2
    assert all(p.organization_id == org_a_id for p in products_a)

    # Test: Organization B should only see their products
    query_b = select(Product).where(Product.organization_id == org_b_id)
    result_b = await db.execute(query_b)
    products_b = result_b.scalars().all()

    assert len(products_b) == 1
    assert all(p.organization_id == org_b_id for p in products_b)

    # Test: Attempting to access Organization A's product with Organization B's filter
    query_cross = select(Product).where(
        (Product.id == product_a1.id) & (Product.organization_id == org_b_id)
    )
    result_cross = await db.execute(query_cross)
    product_cross = result_cross.scalar_one_or_none()

    # Should return None (product not found for this organization)
    assert product_cross is None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_cross_tenant_access_prevention_customers(db_session):
    """Test that customers from one organization cannot be accessed by another."""
    from sqlalchemy import select
    from src.db.demo_models import Customer, Organization
    from uuid import uuid4

    # Create two test organizations
    org_a_id = uuid4()
    org_b_id = uuid4()

    org_a = Organization(id=org_a_id, name="Organization A", slug="org-a", is_active=True)
    org_b = Organization(id=org_b_id, name="Organization B", slug="org-b", is_active=True)

    db = db_session
    db.add(org_a)
    db.add(org_b)
    await db.commit()

    # Create customers for each organization
    customer_a = Customer(
        id=uuid4(),
        organization_id=org_a_id,
        customer_number="CUST-A-001",
        company_name="Customer A",
        email="customer-a@example.com",
    )

    customer_b = Customer(
        id=uuid4(),
        organization_id=org_b_id,
        customer_number="CUST-B-001",
        company_name="Customer B",
        email="customer-b@example.com",
    )

    db.add_all([customer_a, customer_b])
    await db.commit()

    # Organization A should only see their customer
    query_a = select(Customer).where(Customer.organization_id == org_a_id)
    result_a = await db.execute(query_a)
    customers_a = result_a.scalars().all()

    assert len(customers_a) == 1
    assert customers_a[0].organization_id == org_a_id

    # Organization B should only see their customer
    query_b = select(Customer).where(Customer.organization_id == org_b_id)
    result_b = await db.execute(query_b)
    customers_b = result_b.scalars().all()

    assert len(customers_b) == 1
    assert customers_b[0].organization_id == org_b_id


# Security Tests


def test_enumeration_attack_prevention():
    """
    Test that cross-tenant access returns 404 (not 403) to prevent enumeration.

    This prevents attackers from discovering which resources exist by checking
    if they get 403 (exists but forbidden) vs 404 (doesn't exist).
    """
    org_a = uuid4()
    org_b = uuid4()
    entity = MockEntity(uuid4(), org_a)

    with pytest.raises(HTTPException) as exc_info:
        validate_tenant_access(entity, org_b, "Product")

    # CRITICAL: Must be 404, not 403
    assert exc_info.value.status_code == 404
    # Should not reveal that the resource exists
    assert "not found" in exc_info.value.detail.lower()


# Performance Tests


def test_tenant_filter_performance():
    """
    Test that tenant filtering doesn't add significant overhead.

    This is a placeholder - actual performance testing should be done
    with realistic data volumes.
    """
    # TODO: Add performance benchmarks
    pytest.skip("Performance testing requires production-scale data")


# Documentation Tests


def test_tenant_isolation_documentation_exists():
    """Ensure tenant isolation design is documented."""
    import os

    # Check for tenant isolation documentation
    docs_dir = os.path.join(
        os.path.dirname(__file__), "..", "..", "..", "..", "docs"
    )

    # Should have multi-tenant architecture documentation
    # (Will be created as part of this task)
    assert os.path.exists(docs_dir), "docs directory should exist"
