---
type: 'model'
id: 'MODEL-XXX'
table: 'shopify_connections'
file: 'apps/backend/src/db/shopify_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: ShopifyConnection

## Overview

Shopify store connection configuration.

Stores OAuth credentials and connection state for Shopify integration.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `shopify_connections`

**Columns**:

| Column              | Type   | Constraints | Description        |
| ------------------- | ------ | ----------- | ------------------ |
| id                  | Mapped | TBD         | Column description |
| shop_domain         | Mapped | TBD         | Column description |
| shop_name           | Mapped | TBD         | Column description |
| access_token        | Mapped | TBD         | Column description |
| api_key             | Mapped | TBD         | Column description |
| api_secret          | Mapped | TBD         | Column description |
| webhook_secret      | Mapped | TBD         | Column description |
| api_version         | Mapped | TBD         | Column description |
| is_active           | Mapped | TBD         | Column description |
| last_order_sync     | Mapped | TBD         | Column description |
| last_inventory_sync | Mapped | TBD         | Column description |
| last_product_sync   | Mapped | TBD         | Column description |
| shop_id             | Mapped | TBD         | Column description |
| currency            | Mapped | TBD         | Column description |
| timezone            | Mapped | TBD         | Column description |
| email               | Mapped | TBD         | Column description |
| phone               | Mapped | TBD         | Column description |
| sync_settings       | Mapped | TBD         | Column description |
| created_at          | Mapped | TBD         | Column description |
| updated_at          | Mapped | TBD         | Column description |

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
