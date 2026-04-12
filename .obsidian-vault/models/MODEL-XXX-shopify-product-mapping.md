---
type: 'model'
id: 'MODEL-XXX'
table: 'shopify_product_mappings'
file: 'apps/backend/src/db/shopify_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: ShopifyProductMapping

## Overview

Mapping between ERP products and Shopify products.

Links local products to Shopify product/variant IDs for sync operations.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `shopify_product_mappings`

**Columns**:

| Column                    | Type   | Constraints | Description        |
| ------------------------- | ------ | ----------- | ------------------ |
| id                        | Mapped | TBD         | Column description |
| product_id                | Mapped | TBD         | Column description |
| shopify_product_id        | Mapped | TBD         | Column description |
| shopify_variant_id        | Mapped | TBD         | Column description |
| shopify_inventory_item_id | Mapped | TBD         | Column description |
| last_synced_at            | Mapped | TBD         | Column description |
| sync_status               | Mapped | TBD         | Column description |
| sync_error                | Mapped | TBD         | Column description |
| sync_direction            | Mapped | TBD         | Column description |
| shopify_data              | Mapped | TBD         | Column description |
| created_at                | Mapped | TBD         | Column description |
| updated_at                | Mapped | TBD         | Column description |

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
