"""
Role-Based Access Control (RBAC) Middleware

Enforces permissions based on user roles for multi-tenant SaaS.

Roles:
- Owner: Full access (billing, team management, dangerous operations)
- Admin: Full operational access (no billing)
- Member: Read/write access to operational modules
- Billing: Billing management only

Usage:
    @router.get("/products")
    @require_permission("products:read")
    async def list_products(request: Request):
        pass

    @router.delete("/products/{id}")
    @require_role("owner")
    async def delete_product(product_id: str, request: Request):
        pass
"""

from collections.abc import Callable
from functools import wraps
from typing import Literal

import structlog
from fastapi import HTTPException, Request

logger = structlog.get_logger(__name__)

# Type alias for roles
Role = Literal["owner", "admin", "member", "billing"]

# Permission matrix: role -> list of permissions
# Format: "module:action" or "module:*" (wildcard for all actions in module)
ROLE_PERMISSIONS: dict[Role, list[str]] = {
    "owner": ["*"],  # Owner has ALL permissions (wildcard)
    "admin": [
        # Products
        "products:*",  # All product operations
        # Customers
        "customers:*",  # All customer operations
        # Orders
        "orders:read",
        "orders:write",
        "orders:cancel",
        # Quotes
        "quotes:*",
        # Inventory
        "inventory:*",
        # Suppliers
        "suppliers:read",
        "suppliers:write",
        # Shipments
        "shipments:*",
        # Team
        "team:read",
        "team:invite",
        # Settings
        "settings:company",
        "settings:integrations",
        # Reports
        "reports:*",
    ],
    "member": [
        # Products
        "products:read",
        "products:write",
        # Customers
        "customers:read",
        "customers:write",
        # Orders
        "orders:read",
        "orders:write",
        # Quotes
        "quotes:read",
        "quotes:write",
        # Inventory
        "inventory:read",
        "inventory:adjust",
        "inventory:transfer",
        # Suppliers
        "suppliers:read",
        # Shipments
        "shipments:read",
        "shipments:write",
        # Reports
        "reports:view",
    ],
    "billing": [
        # Billing
        "billing:read",
        "billing:write",
        # Reports (view only)
        "reports:view",
    ],
}

# Role hierarchy (for role-based checks)
ROLE_HIERARCHY: dict[Role, int] = {
    "owner": 4,
    "admin": 3,
    "member": 2,
    "billing": 1,
}


def check_permission(user_role: Role, required_permission: str) -> bool:
    """
    Check if a role has a specific permission.

    Supports wildcard permissions (e.g., "products:*" grants all product actions).

    Args:
        user_role: User's role
        required_permission: Permission to check (e.g., "products:delete")

    Returns:
        True if role has permission, False otherwise

    Examples:
        >>> check_permission("owner", "anything:anything")
        True
        >>> check_permission("admin", "products:delete")
        True
        >>> check_permission("member", "products:delete")
        False
        >>> check_permission("member", "products:read")
        True
    """
    # Empty permission string is invalid
    if not required_permission or not required_permission.strip():
        return False

    # Owner has all permissions
    if user_role == "owner":
        return True

    # Get permissions for role
    user_permissions = ROLE_PERMISSIONS.get(user_role, [])

    # Check exact match
    if required_permission in user_permissions:
        return True

    # Check wildcard permissions (e.g., "products:*" grants "products:read")
    module = required_permission.split(":")[0] if ":" in required_permission else ""
    if f"{module}:*" in user_permissions:
        return True

    # Check global wildcard
    if "*" in user_permissions:
        return True

    return False


def get_user_role_from_request(request: Request) -> Role:
    """
    Extract user role from request state.

    The user object is injected by the authentication middleware.

    Args:
        request: FastAPI request object

    Returns:
        User's role (defaults to "member" if not specified)

    Raises:
        HTTPException: If user not authenticated
    """
    user = getattr(request.state, "user", None)

    if not user:
        logger.warning("RBAC check attempted without authenticated user")
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Get role from user object (JWT claim or database)
    role = user.get("role", "member")

    # Validate role
    if role not in ROLE_PERMISSIONS:
        logger.error(
            "Invalid role assigned to user",
            user_id=user.get("id"),
            invalid_role=role,
        )
        # Default to member for safety
        return "member"

    return role


def require_permission(permission: str):
    """
    Decorator to enforce permission-based access control on a route.

    Checks if the authenticated user has the specified permission.

    Args:
        permission: Required permission (e.g., "products:delete")

    Returns:
        Decorated function

    Raises:
        HTTPException: 401 if not authenticated, 403 if permission denied

    Example:
        @router.delete("/products/{product_id}")
        @require_permission("products:delete")
        async def delete_product(product_id: str, request: Request):
            # Only Owner and Admin can reach this code
            pass
    """

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request - it's always the first parameter in FastAPI routes
            request = args[0] if args else kwargs.get("request")

            # Check if request has required attributes (duck typing for testability)
            if not (request and hasattr(request, "state")):
                logger.error(
                    "RBAC decorator used on route without Request parameter",
                    function=func.__name__,
                )
                raise HTTPException(
                    status_code=500,
                    detail="Internal server error: RBAC misconfiguration",
                )

            # Get user role
            user_role = get_user_role_from_request(request)

            # Check permission
            if not check_permission(user_role, permission):
                user = getattr(request.state, "user", {})
                logger.warning(
                    "Permission denied",
                    user_id=user.get("id"),
                    user_role=user_role,
                    required_permission=permission,
                    endpoint=func.__name__,
                )
                raise HTTPException(
                    status_code=403,
                    detail=f"Permission denied: '{permission}' required (your role: {user_role})",
                )

            # Permission granted - execute route handler
            return await func(*args, **kwargs)

        return wrapper

    return decorator


def require_role(min_role: Role):
    """
    Decorator to enforce minimum role requirement on a route.

    Checks if the authenticated user has a role with sufficient privilege level.

    Args:
        min_role: Minimum required role

    Returns:
        Decorated function

    Raises:
        HTTPException: 401 if not authenticated, 403 if insufficient role

    Example:
        @router.post("/team/invite")
        @require_role("admin")
        async def invite_team_member(request: Request):
            # Only Owner and Admin can reach this code
            pass
    """

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract request - it's always the first parameter in FastAPI routes
            request = args[0] if args else kwargs.get("request")

            # Check if request has required attributes (duck typing for testability)
            if not (request and hasattr(request, "state")):
                logger.error(
                    "RBAC decorator used on route without Request parameter",
                    function=func.__name__,
                )
                raise HTTPException(
                    status_code=500,
                    detail="Internal server error: RBAC misconfiguration",
                )

            # Get user role
            user_role = get_user_role_from_request(request)

            # Check role hierarchy
            user_level = ROLE_HIERARCHY.get(user_role, 0)
            required_level = ROLE_HIERARCHY.get(min_role, 0)

            if user_level < required_level:
                user = getattr(request.state, "user", {})
                logger.warning(
                    "Insufficient role",
                    user_id=user.get("id"),
                    user_role=user_role,
                    required_role=min_role,
                    endpoint=func.__name__,
                )
                raise HTTPException(
                    status_code=403,
                    detail=f"Insufficient privileges: '{min_role}' role or higher required (your role: {user_role})",
                )

            # Role sufficient - execute route handler
            return await func(*args, **kwargs)

        return wrapper

    return decorator


# Convenience decorators for common patterns
def owner_only():
    """Shorthand for @require_role("owner")."""
    return require_role("owner")


def admin_or_higher():
    """Shorthand for @require_role("admin")."""
    return require_role("admin")


def can_read(module: str):
    """Shorthand for @require_permission("{module}:read")."""
    return require_permission(f"{module}:read")


def can_write(module: str):
    """Shorthand for @require_permission("{module}:write")."""
    return require_permission(f"{module}:write")


def can_delete(module: str):
    """Shorthand for @require_permission("{module}:delete")."""
    return require_permission(f"{module}:delete")
