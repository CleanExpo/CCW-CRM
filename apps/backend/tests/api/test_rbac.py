"""
Tests for RBAC (Role-Based Access Control) Middleware

Tests permission checking, role hierarchy, and access control decorators.
"""

import pytest
from fastapi import Request
from httpx import AsyncClient

from src.api.middleware.rbac import (
    ROLE_HIERARCHY,
    ROLE_PERMISSIONS,
    check_permission,
    require_permission,
    require_role,
)


# Unit Tests - Permission Checking Logic


def test_owner_has_all_permissions():
    """Owner should have ALL permissions (wildcard)."""
    assert check_permission("owner", "products:delete") is True
    assert check_permission("owner", "billing:cancel") is True
    assert check_permission("owner", "team:edit_roles") is True
    assert check_permission("owner", "anything:anything") is True


def test_admin_permissions():
    """Admin should have operational permissions but not billing/owner actions."""
    # Allowed
    assert check_permission("admin", "products:read") is True
    assert check_permission("admin", "products:write") is True
    assert check_permission("admin", "products:delete") is True  # products:*
    assert check_permission("admin", "orders:cancel") is True
    assert check_permission("admin", "team:invite") is True

    # Denied
    assert check_permission("admin", "billing:read") is False
    assert check_permission("admin", "billing:write") is False
    assert check_permission("admin", "team:edit_roles") is False  # Owner only


def test_member_permissions():
    """Member should have read/write but not delete permissions."""
    # Allowed
    assert check_permission("member", "products:read") is True
    assert check_permission("member", "products:write") is True
    assert check_permission("member", "orders:read") is True
    assert check_permission("member", "orders:write") is True
    assert check_permission("member", "inventory:adjust") is True

    # Denied
    assert check_permission("member", "products:delete") is False
    assert check_permission("member", "orders:cancel") is False
    assert check_permission("member", "billing:read") is False
    assert check_permission("member", "team:invite") is False


def test_billing_permissions():
    """Billing role should only access billing and reports."""
    # Allowed
    assert check_permission("billing", "billing:read") is True
    assert check_permission("billing", "billing:write") is True
    assert check_permission("billing", "reports:view") is True

    # Denied
    assert check_permission("billing", "products:read") is False
    assert check_permission("billing", "orders:read") is False
    assert check_permission("billing", "team:invite") is False
    assert check_permission("billing", "billing:cancel") is False  # Owner only


def test_wildcard_permissions():
    """Wildcard permissions should grant all actions in module."""
    # Admin has "products:*"
    assert check_permission("admin", "products:read") is True
    assert check_permission("admin", "products:write") is True
    assert check_permission("admin", "products:delete") is True
    assert check_permission("admin", "products:export") is True  # Any action

    # Member does NOT have "billing:*"
    assert check_permission("member", "billing:read") is False
    assert check_permission("member", "billing:write") is False


def test_role_hierarchy():
    """Role hierarchy should be correctly defined."""
    assert ROLE_HIERARCHY["owner"] > ROLE_HIERARCHY["admin"]
    assert ROLE_HIERARCHY["admin"] > ROLE_HIERARCHY["member"]
    assert ROLE_HIERARCHY["member"] > ROLE_HIERARCHY["billing"]


def test_invalid_role_defaults_to_denied():
    """Invalid role should deny all permissions."""
    # Invalid role should return False for all permissions
    assert check_permission("invalid_role", "products:read") is False  # type: ignore
    assert check_permission("invalid_role", "anything") is False  # type: ignore


# Integration Tests - Decorator Behavior


class MockRequest:
    """Mock FastAPI Request for testing decorators."""

    def __init__(self, user_role: str, user_id: str = "test-user-123"):
        # Create a simple mock that duck-types as a Request
        self.state = type("State", (), {})()
        self.state.user = {
            "id": user_id,
            "role": user_role,
            "email": "test@example.com",
        }


@pytest.mark.asyncio
async def test_require_permission_allows_owner():
    """Owner should pass all permission checks."""

    @require_permission("products:delete")
    async def protected_route(request: Request):
        return {"status": "success"}

    request = MockRequest(user_role="owner")
    result = await protected_route(request)
    assert result == {"status": "success"}


@pytest.mark.asyncio
async def test_require_permission_allows_admin_for_allowed_action():
    """Admin should pass permission check for products:delete (products:*)."""

    @require_permission("products:delete")
    async def protected_route(request: Request):
        return {"status": "success"}

    request = MockRequest(user_role="admin")
    result = await protected_route(request)
    assert result == {"status": "success"}


@pytest.mark.asyncio
async def test_require_permission_denies_member_for_delete():
    """Member should be denied products:delete."""
    from fastapi import HTTPException

    @require_permission("products:delete")
    async def protected_route(request: Request):
        return {"status": "success"}

    request = MockRequest(user_role="member")

    with pytest.raises(HTTPException) as exc_info:
        await protected_route(request)

    assert exc_info.value.status_code == 403
    assert "Permission denied" in exc_info.value.detail


@pytest.mark.asyncio
async def test_require_permission_denies_billing_for_products():
    """Billing role should be denied product access."""
    from fastapi import HTTPException

    @require_permission("products:read")
    async def protected_route(request: Request):
        return {"status": "success"}

    request = MockRequest(user_role="billing")

    with pytest.raises(HTTPException) as exc_info:
        await protected_route(request)

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_require_role_allows_owner():
    """require_role should allow owner for any role requirement."""

    @require_role("admin")
    async def protected_route(request: Request):
        return {"status": "success"}

    request = MockRequest(user_role="owner")
    result = await protected_route(request)
    assert result == {"status": "success"}


@pytest.mark.asyncio
async def test_require_role_allows_admin_for_admin_requirement():
    """require_role should allow admin for admin requirement."""

    @require_role("admin")
    async def protected_route(request: Request):
        return {"status": "success"}

    request = MockRequest(user_role="admin")
    result = await protected_route(request)
    assert result == {"status": "success"}


@pytest.mark.asyncio
async def test_require_role_denies_member_for_admin_requirement():
    """require_role should deny member for admin requirement."""
    from fastapi import HTTPException

    @require_role("admin")
    async def protected_route(request: Request):
        return {"status": "success"}

    request = MockRequest(user_role="member")

    with pytest.raises(HTTPException) as exc_info:
        await protected_route(request)

    assert exc_info.value.status_code == 403
    assert "Insufficient privileges" in exc_info.value.detail


@pytest.mark.asyncio
async def test_require_role_denies_billing_for_member_requirement():
    """Billing (level 1) should be denied for member (level 2) requirement."""
    from fastapi import HTTPException

    @require_role("member")
    async def protected_route(request: Request):
        return {"status": "success"}

    request = MockRequest(user_role="billing")

    with pytest.raises(HTTPException) as exc_info:
        await protected_route(request)

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_decorator_raises_401_when_not_authenticated():
    """Decorator should raise 401 when user not in request state."""
    from fastapi import HTTPException

    @require_permission("products:read")
    async def protected_route(request: Request):
        return {"status": "success"}

    # Create request without user
    request = type("Request", (), {})()
    request.state = type("State", (), {})()
    # No user attribute

    with pytest.raises(HTTPException) as exc_info:
        await protected_route(request)

    assert exc_info.value.status_code == 401
    assert "Not authenticated" in exc_info.value.detail


# API Integration Tests (Full Request/Response)


@pytest.mark.asyncio
async def test_api_endpoint_with_rbac_allows_authorized_user(client: AsyncClient):
    """
    Test that API endpoint with RBAC allows authorized user.

    NOTE: This test requires that the API routes have RBAC decorators applied.
    This is a placeholder - actual implementation depends on route configuration.
    """
    # This would test an actual endpoint once RBAC is applied to routes
    # For now, we'll skip this as it requires full API setup
    pytest.skip("Requires API routes with RBAC decorators applied")


@pytest.mark.asyncio
async def test_api_endpoint_with_rbac_denies_unauthorized_user(client: AsyncClient):
    """
    Test that API endpoint with RBAC denies unauthorized user.

    NOTE: This test requires that the API routes have RBAC decorators applied.
    """
    pytest.skip("Requires API routes with RBAC decorators applied")


# Permission Matrix Validation Tests


def test_all_roles_have_permissions_defined():
    """All roles should have permission lists defined."""
    expected_roles = {"owner", "admin", "member", "billing"}
    assert set(ROLE_PERMISSIONS.keys()) == expected_roles


def test_all_roles_in_hierarchy():
    """All roles should be in hierarchy."""
    expected_roles = {"owner", "admin", "member", "billing"}
    assert set(ROLE_HIERARCHY.keys()) == expected_roles


def test_owner_permissions_is_wildcard():
    """Owner permissions should be wildcard (["*"])."""
    assert ROLE_PERMISSIONS["owner"] == ["*"]


def test_no_role_has_empty_permissions():
    """No role should have empty permissions list."""
    for role, permissions in ROLE_PERMISSIONS.items():
        assert len(permissions) > 0, f"Role {role} has no permissions"


def test_permission_format_is_valid():
    """All permissions should follow 'module:action' format or be '*'."""
    for role, permissions in ROLE_PERMISSIONS.items():
        if role == "owner":
            continue  # Owner has ["*"] which is valid

        for permission in permissions:
            if permission != "*":
                assert ":" in permission, f"Invalid permission format: {permission}"
                parts = permission.split(":")
                assert len(parts) == 2, f"Invalid permission format: {permission}"
                module, action = parts
                assert len(module) > 0, f"Empty module in permission: {permission}"
                assert len(action) > 0, f"Empty action in permission: {permission}"


# Edge Cases


def test_permission_check_with_empty_string():
    """Empty permission string should be denied."""
    assert check_permission("owner", "") is False  # Even owner can't have empty perm
    assert check_permission("admin", "") is False


def test_permission_check_case_sensitivity():
    """Permissions should be case-sensitive."""
    # Assuming permissions are lowercase
    assert check_permission("admin", "products:read") is True
    assert check_permission("admin", "Products:Read") is False  # Case mismatch
    assert check_permission("admin", "PRODUCTS:READ") is False  # Case mismatch


# Documentation Tests


def test_rbac_documentation_exists():
    """RBAC design documentation should exist."""
    import os

    # Navigate from backend/tests/api to root/docs
    tests_dir = os.path.dirname(__file__)  # backend/tests/api
    backend_dir = os.path.dirname(os.path.dirname(tests_dir))  # backend
    root_dir = os.path.dirname(os.path.dirname(backend_dir))  # root
    docs_path = os.path.join(root_dir, "docs", "RBAC-DESIGN.md")

    assert os.path.exists(docs_path), f"RBAC-DESIGN.md should exist at {docs_path}"
