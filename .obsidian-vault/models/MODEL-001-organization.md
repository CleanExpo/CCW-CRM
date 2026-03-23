---
type: model
id: MODEL-001
table: organizations
file: apps/backend/src/db/demo_models.py
schema_locked: true
relationships:
  - model: '[[MODEL-002-user]]'
    type: one-to-many
    via: organization_id
  - model: '[[MODEL-003-product]]'
    type: one-to-many
    via: organization_id
links:
  - '[[ROUTE-050-organizations]]'
last_verified: 2026-03-23
---

# MODEL-001: Organization

## Overview

Core tenant model for multi-tenant architecture. Every user, product, order, and entity belongs to an organization. Enables data isolation and white-labeling.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `organizations`

**Columns**:

| Column     | Type         | Constraints            | Description                    |
| ---------- | ------------ | ---------------------- | ------------------------------ |
| id         | UUID         | PK, NOT NULL           | Primary key                    |
| created_at | DateTime(TZ) | NOT NULL               | Timestamp (UTC)                |
| updated_at | DateTime(TZ) | NOT NULL               | Timestamp (UTC)                |
| name       | String(255)  | NOT NULL               | Organization display name      |
| slug       | String(100)  | UNIQUE, NOT NULL       | URL-safe identifier            |
| is_active  | Boolean      | NOT NULL, DEFAULT true | Soft delete flag               |
| settings   | JSONB        | NULL                   | Organization-specific settings |

**Indexes**:

- `ix_organizations_slug` (slug) - UNIQUE
- `ix_organizations_is_active` (is_active)

**Foreign Keys**: None (top-level entity)

## Relationships

### One-to-Many

- [[MODEL-002-user]]: `Organization` has many `User` via `organization_id`
- [[MODEL-003-product]]: `Organization` has many `Product` via `organization_id`
- [[MODEL-004-customer]]: `Organization` has many `Customer` via `organization_id`
- [[MODEL-005-order]]: `Organization` has many `Order` via `organization_id`

### Many-to-One

None (root entity)

### Many-to-Many

None

## Enums (if any)

None

## Used By Routes

- [[ROUTE-050-organizations]]: `GET /api/organizations` - Lists organizations (admin only)
- [[ROUTE-050-organizations]]: `POST /api/organizations` - Creates organization (admin only)
- [[ROUTE-050-organizations]]: `PUT /api/organizations/{id}` - Updates organization
- [[ROUTE-050-organizations]]: `DELETE /api/organizations/{id}` - Soft deletes organization

<!-- END AUTO-GENERATED -->

<!-- HUMAN-CURATED -->

## Schema Notes

⚠️ **Schema Locked**: This is a production table. Modifying this schema requires:

1. Explicit approval from project owner
2. Migration plan with rollback strategy
3. Data backfill plan for existing records
4. Testing in staging environment

**DO NOT MODIFY WITHOUT APPROVAL.**

### Historical Context

- Originally designed for multi-tenant SaaS
- `settings` JSONB field added 2025-12-10 for per-org customization
- `slug` field enforces unique, URL-safe identifiers for subdomains (future feature)

## Business Logic

**Validation Rules**:

- `name` must be 3-255 characters
- `slug` must be lowercase alphanumeric + hyphens only
- `slug` auto-generated from `name` on creation if not provided
- Cannot delete organization if it has active users

**Cascade Behavior**:

- Soft delete: Set `is_active = false`, cascade to all child entities
- Hard delete: Blocked if any child records exist (safety constraint)

## Performance Considerations

**Query Optimization**:

- Always filter by `organization_id` in multi-tenant queries
- Use composite indexes: `(organization_id, entity_field)` on child tables
- `slug` index enables fast subdomain lookups

**N+1 Query Risks**:

- Avoid lazy-loading users: Use `selectinload(Organization.users)`
- Dashboard queries join Organization early to avoid separate lookup

**Caching Strategies**:

- Organization settings cached in Redis for 15 minutes
- Cache invalidated on PUT /api/organizations/{id}

## Known Issues

None currently. This is a stable, foundational table.

<!-- END HUMAN-CURATED -->

## Integration Points

- **Cin7**: No direct mapping (Cin7 account = 1:1 with organization)
- **Xero**: `organizations.settings.xero_tenant_id` stores Xero org mapping
- **Shopify**: `organizations.settings.shopify_store_url` stores store URL

## Sample Queries

```python
# Get organization with all users (eager load)
org = await db.execute(
    select(Organization)
    .options(selectinload(Organization.users))
    .where(Organization.slug == "acme-corp")
)

# Create new organization
new_org = Organization(
    name="Acme Corporation",
    slug="acme-corp",
    is_active=True
)
db.add(new_org)
await db.commit()

# Soft delete organization
org.is_active = False
await db.commit()
```

## Related Models

- [[MODEL-002-user]]: Users belong to organizations
- [[MODEL-003-product]]: Products scoped by organization
- [[MODEL-004-customer]]: Customers scoped by organization
- [[MODEL-005-order]]: Orders scoped by organization

## Change History

| Date       | Change                           | Author         |
| ---------- | -------------------------------- | -------------- |
| 2026-03-23 | Created sample doc from template | Auto-generated |
