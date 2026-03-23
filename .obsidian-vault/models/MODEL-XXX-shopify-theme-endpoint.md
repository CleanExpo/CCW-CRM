---
type: 'model'
id: 'MODEL-XXX'
table: 'shopify_theme_endpoints'
file: 'apps/backend/src/db/shopify_extended_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: ShopifyThemeEndpoint

## Overview

Shopify theme API endpoint tracking.

Tracks custom API endpoints used by Shopify themes for dynamic content.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `shopify_theme_endpoints`

**Columns**:

| Column               | Type     | Constraints | Description        |
| -------------------- | -------- | ----------- | ------------------ |
| id                   | UUID     | TBD         | Column description |
| endpoint_path        | str      | TBD         | Column description |
| endpoint_type        | str      | TBD         | Column description |
| description          | Unknown  | TBD         | Column description |
| shopify_theme_id     | Unknown  | TBD         | Column description |
| shopify_store_domain | Unknown  | TBD         | Column description |
| is_active            | bool     | TBD         | Column description |
| request_count        | int      | TBD         | Column description |
| last_accessed_at     | Unknown  | TBD         | Column description |
| rate_limit_per_hour  | Unknown  | TBD         | Column description |
| cache_enabled        | bool     | TBD         | Column description |
| cache_ttl_seconds    | Unknown  | TBD         | Column description |
| created_at           | datetime | TBD         | Column description |
| updated_at           | datetime | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

No relationships defined

## Used By Routes

See code for route usage

<!-- END AUTO-GENERATED -->

<!-- HUMAN-CURATED -->

## Schema Notes

This table can be modified with standard migration procedures.

Add notes about:

- Why this table structure was chosen
- Historical schema changes
- Migration considerations
- Data integrity rules

## Business Logic

Document business rules enforced at the model level:

- Validation rules
- Calculated fields
- Triggers
- Cascade behaviors

## Performance Considerations

Document:

- Query optimization strategies
- Index usage patterns
- N+1 query risks
- Caching strategies

## Known Issues

Document:

- Data quality issues
- Missing constraints
- Technical debt

<!-- END HUMAN-CURATED -->

## Integration Points

See code for integration mappings

## Sample Queries

```python
# Example queries for this model
# See code for actual usage patterns
```

## Related Models

No direct relationships

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
