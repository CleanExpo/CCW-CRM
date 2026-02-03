# RBAC System Design - Role-Based Access Control

**Purpose:** Multi-tenant SaaS access control system for CCW-Online ERP

**Created:** February 3, 2026

---

## Overview

The RBAC (Role-Based Access Control) system enforces permissions across the application based on user roles within their organization. This is critical for:
- Multi-tenant SaaS security
- Team collaboration features
- Billing plan enforcement
- Compliance and audit trails

---

## Roles & Permissions Matrix

### Role Hierarchy

```
Owner (Highest privilege)
  └─> Admin
      └─> Member
          └─> Billing (Specialized)
```

### Role Definitions

| Role | Description | Use Case | Max Users |
|------|-------------|----------|-----------|
| **Owner** | Full access including billing, team management, dangerous actions | Founder, CEO | 1 per org |
| **Admin** | Full operational access except billing | Operations Manager, CTO | 5 per org |
| **Member** | Read/write access to operational modules | Sales, Warehouse Staff | Unlimited |
| **Billing** | Billing management only | CFO, Finance Team | 3 per org |

---

## Permissions Matrix

### Format: `module:action`

| Permission | Owner | Admin | Member | Billing | Description |
|------------|-------|-------|--------|---------|-------------|
| **Products** |||||
| `products:read` | ✅ | ✅ | ✅ | ❌ | View products |
| `products:write` | ✅ | ✅ | ✅ | ❌ | Create/edit products |
| `products:delete` | ✅ | ✅ | ❌ | ❌ | Delete products |
| **Customers** |||||
| `customers:read` | ✅ | ✅ | ✅ | ❌ | View customers |
| `customers:write` | ✅ | ✅ | ✅ | ❌ | Create/edit customers |
| `customers:delete` | ✅ | ✅ | ❌ | ❌ | Delete customers |
| **Orders** |||||
| `orders:read` | ✅ | ✅ | ✅ | ❌ | View orders |
| `orders:write` | ✅ | ✅ | ✅ | ❌ | Create/edit orders |
| `orders:cancel` | ✅ | ✅ | ❌ | ❌ | Cancel orders |
| `orders:delete` | ✅ | ❌ | ❌ | ❌ | Delete orders (dangerous) |
| **Quotes** |||||
| `quotes:read` | ✅ | ✅ | ✅ | ❌ | View quotes |
| `quotes:write` | ✅ | ✅ | ✅ | ❌ | Create/edit quotes |
| `quotes:delete` | ✅ | ✅ | ❌ | ❌ | Delete quotes |
| **Inventory** |||||
| `inventory:read` | ✅ | ✅ | ✅ | ❌ | View inventory |
| `inventory:adjust` | ✅ | ✅ | ✅ | ❌ | Adjust stock levels |
| `inventory:transfer` | ✅ | ✅ | ✅ | ❌ | Transfer between locations |
| **Suppliers** |||||
| `suppliers:read` | ✅ | ✅ | ✅ | ❌ | View suppliers |
| `suppliers:write` | ✅ | ✅ | ❌ | ❌ | Create/edit suppliers |
| `suppliers:delete` | ✅ | ❌ | ❌ | ❌ | Delete suppliers |
| **Shipments** |||||
| `shipments:read` | ✅ | ✅ | ✅ | ❌ | View shipments |
| `shipments:write` | ✅ | ✅ | ✅ | ❌ | Create/edit shipments |
| **Team Management** |||||
| `team:read` | ✅ | ✅ | ❌ | ❌ | View team members |
| `team:invite` | ✅ | ✅ | ❌ | ❌ | Invite new users |
| `team:edit_roles` | ✅ | ❌ | ❌ | ❌ | Change user roles |
| `team:remove` | ✅ | ❌ | ❌ | ❌ | Remove team members |
| **Billing** |||||
| `billing:read` | ✅ | ❌ | ❌ | ✅ | View billing info |
| `billing:write` | ✅ | ❌ | ❌ | ✅ | Update payment method |
| `billing:change_plan` | ✅ | ❌ | ❌ | ❌ | Upgrade/downgrade plan |
| `billing:cancel` | ✅ | ❌ | ❌ | ❌ | Cancel subscription |
| **Settings** |||||
| `settings:company` | ✅ | ✅ | ❌ | ❌ | Edit company settings |
| `settings:integrations` | ✅ | ✅ | ❌ | ❌ | Configure integrations |
| `settings:security` | ✅ | ❌ | ❌ | ❌ | Security settings |
| **Reports** |||||
| `reports:view` | ✅ | ✅ | ✅ | ✅ | View reports |
| `reports:export` | ✅ | ✅ | ❌ | ❌ | Export reports |

---

## Implementation Architecture

### Database Schema

**Users Table (Existing - No Modification)**

```sql
-- apps/backend/src/db/demo_models.py (DO NOT MODIFY)
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    organization_id UUID REFERENCES organizations(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Add role field via environment variable (soft launch)**

Since we cannot modify `demo_models.py`, we'll store role in:
1. **JWT token claims** (for session-based access)
2. **Redis cache** (user_id → role mapping)
3. **Future migration** (add `role` column when schema changes allowed)

### RBAC Middleware

**File:** `apps/backend/src/api/middleware/rbac.py`

```python
from functools import wraps
from typing import Callable, Literal

from fastapi import HTTPException, Request
from src.auth.jwt import decode_jwt_token

Role = Literal["owner", "admin", "member", "billing"]

# Permission definitions
ROLE_PERMISSIONS = {
    "owner": ["*"],  # All permissions
    "admin": [
        "products:*", "customers:*", "orders:read", "orders:write", "orders:cancel",
        "quotes:*", "inventory:*", "suppliers:read", "suppliers:write",
        "shipments:*", "team:read", "team:invite", "settings:company",
        "settings:integrations", "reports:*"
    ],
    "member": [
        "products:read", "products:write", "customers:read", "customers:write",
        "orders:read", "orders:write", "quotes:read", "quotes:write",
        "inventory:read", "inventory:adjust", "inventory:transfer",
        "suppliers:read", "shipments:read", "shipments:write", "reports:view"
    ],
    "billing": [
        "billing:read", "billing:write", "reports:view"
    ]
}

def check_permission(user_role: Role, required_permission: str) -> bool:
    """Check if role has permission (supports wildcards)."""
    if user_role == "owner":
        return True  # Owner has all permissions

    user_permissions = ROLE_PERMISSIONS.get(user_role, [])

    # Check exact match
    if required_permission in user_permissions:
        return True

    # Check wildcard permissions (e.g., "products:*" grants "products:read")
    module = required_permission.split(":")[0]
    if f"{module}:*" in user_permissions:
        return True

    return False

def require_permission(permission: str):
    """Decorator to enforce permission on route."""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            # Get user from request (injected by auth middleware)
            user = getattr(request.state, "user", None)
            if not user:
                raise HTTPException(status_code=401, detail="Not authenticated")

            # Get user role (from JWT claims or Redis cache)
            user_role = user.get("role", "member")  # Default to member

            # Check permission
            if not check_permission(user_role, permission):
                raise HTTPException(
                    status_code=403,
                    detail=f"Permission denied: {permission} required"
                )

            return await func(request, *args, **kwargs)
        return wrapper
    return decorator

def require_role(role: Role):
    """Decorator to enforce minimum role on route."""
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            user = getattr(request.state, "user", None)
            if not user:
                raise HTTPException(status_code=401, detail="Not authenticated")

            user_role = user.get("role", "member")

            # Role hierarchy check
            role_hierarchy = {"owner": 4, "admin": 3, "member": 2, "billing": 1}
            if role_hierarchy.get(user_role, 0) < role_hierarchy.get(role, 0):
                raise HTTPException(
                    status_code=403,
                    detail=f"Insufficient privileges: {role} role required"
                )

            return await func(request, *args, **kwargs)
        return wrapper
    return decorator
```

---

## Usage Examples

### Backend API Routes

```python
from fastapi import APIRouter, Depends, Request
from src.api.middleware.rbac import require_permission, require_role

router = APIRouter(prefix="/api/products", tags=["products"])

@router.get("")
@require_permission("products:read")
async def list_products(request: Request):
    """List products (all authenticated users)."""
    pass

@router.post("")
@require_permission("products:write")
async def create_product(request: Request):
    """Create product (Owner, Admin, Member)."""
    pass

@router.delete("/{product_id}")
@require_permission("products:delete")
async def delete_product(product_id: str, request: Request):
    """Delete product (Owner, Admin only)."""
    pass

@router.post("/billing/change-plan")
@require_role("owner")
async def change_subscription_plan(request: Request):
    """Change subscription plan (Owner only)."""
    pass
```

### Frontend Access Control

```typescript
// apps/web/lib/auth/permissions.ts

export type Role = "owner" | "admin" | "member" | "billing";

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  owner: ["*"],
  admin: [
    "products:*", "customers:*", "orders:read", "orders:write",
    "orders:cancel", "quotes:*", "inventory:*", "suppliers:read",
    "suppliers:write", "shipments:*", "team:read", "team:invite",
    "settings:company", "settings:integrations", "reports:*"
  ],
  member: [
    "products:read", "products:write", "customers:read", "customers:write",
    "orders:read", "orders:write", "quotes:read", "quotes:write",
    "inventory:read", "inventory:adjust", "inventory:transfer",
    "suppliers:read", "shipments:read", "shipments:write", "reports:view"
  ],
  billing: ["billing:read", "billing:write", "reports:view"]
};

export function hasPermission(userRole: Role, permission: string): boolean {
  if (userRole === "owner") return true;

  const permissions = ROLE_PERMISSIONS[userRole] || [];

  // Check exact match
  if (permissions.includes(permission)) return true;

  // Check wildcard
  const module = permission.split(":")[0];
  if (permissions.includes(`${module}:*`)) return true;

  return false;
}

export function canDeleteProducts(userRole: Role): boolean {
  return hasPermission(userRole, "products:delete");
}

export function canManageTeam(userRole: Role): boolean {
  return userRole === "owner" || userRole === "admin";
}
```

**React Component Example:**

```tsx
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@/lib/auth/permissions";

export function ProductActions({ productId }: { productId: string }) {
  const { user } = useAuth();
  const userRole = user?.role || "member";

  return (
    <div className="flex gap-2">
      <Button onClick={handleEdit}>Edit</Button>

      {hasPermission(userRole, "products:delete") && (
        <Button variant="destructive" onClick={handleDelete}>
          Delete
        </Button>
      )}
    </div>
  );
}
```

---

## Migration Strategy

### Phase 1: Soft Launch (Current)
- Store roles in JWT claims
- Add `role` field to JWT token payload
- Backend validates role on every request
- Frontend hides/disables features based on role

### Phase 2: Database Migration (Future)
- Add `role` column to `users` table
- Migrate existing users (all set to "owner" initially)
- Update signup flow to assign default role ("member")

### Phase 3: Plan Enforcement (SaaS)
- Enforce user limits based on subscription plan
- Starter: 2 users, Pro: 5 users, Enterprise: unlimited

---

## Testing Strategy

### Unit Tests

```python
# apps/backend/tests/api/test_rbac.py

import pytest
from src.api.middleware.rbac import check_permission

def test_owner_has_all_permissions():
    assert check_permission("owner", "products:delete") == True
    assert check_permission("owner", "billing:cancel") == True
    assert check_permission("owner", "anything:anything") == True

def test_admin_can_delete_products():
    assert check_permission("admin", "products:delete") == True

def test_member_cannot_delete_products():
    assert check_permission("member", "products:delete") == False

def test_billing_can_view_billing():
    assert check_permission("billing", "billing:read") == True

def test_member_cannot_view_billing():
    assert check_permission("member", "billing:read") == False

def test_wildcard_permissions():
    assert check_permission("admin", "products:read") == True  # products:*
    assert check_permission("admin", "products:write") == True  # products:*
    assert check_permission("member", "billing:write") == False  # No billing:*
```

### Integration Tests

```python
@pytest.mark.asyncio
async def test_member_cannot_delete_product(client: AsyncClient):
    # Create user with "member" role
    token = create_jwt_token(user_id="123", role="member")

    response = await client.delete(
        "/api/products/abc123",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code == 403
    assert "Permission denied" in response.text

@pytest.mark.asyncio
async def test_owner_can_delete_product(client: AsyncClient):
    token = create_jwt_token(user_id="123", role="owner")

    response = await client.delete(
        "/api/products/abc123",
        headers={"Authorization": f"Bearer {token}"}
    )

    assert response.status_code in [204, 404]  # 204 success, 404 not found
```

---

## Security Considerations

1. **JWT Claims Tampering:** JWT tokens are signed with secret key (cannot be tampered)
2. **Role Elevation:** Users cannot change their own role (only Owner can via Team Management)
3. **Audit Logging:** All role changes logged to database with timestamp + actor
4. **Session Invalidation:** Changing user role invalidates existing JWT tokens
5. **Least Privilege:** Default new users to "member" role

---

## Audit Log

Track role changes for compliance:

```sql
CREATE TABLE rbac_audit_log (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    actor_user_id UUID NOT NULL,  -- Who made the change
    target_user_id UUID NOT NULL,  -- Whose role was changed
    old_role VARCHAR(50),
    new_role VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,  -- 'role_change', 'user_invite', 'user_remove'
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Next Steps

1. ✅ Design RBAC system (this document)
2. ⏳ Implement RBAC middleware (`rbac.py`)
3. ⏳ Update JWT token generation to include `role` claim
4. ⏳ Add RBAC decorators to all API routes
5. ⏳ Implement frontend permission checks
6. ⏳ Add RBAC tests (unit + integration)
7. ⏳ Document role assignment in Team Management UI

---

*Design approved: February 3, 2026*
*Implementation: In progress*
