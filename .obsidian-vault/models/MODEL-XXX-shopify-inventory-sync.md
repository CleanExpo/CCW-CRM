---
type: 'model'
id: 'MODEL-XXX'
table: 'shopify_inventory_syncs'
file: 'apps/backend/src/db/shopify_extended_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: ShopifyInventorySync

## Overview

Shopify inventory sync audit log.

Tracks all inventory synchronization events (bidirectional).

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `shopify_inventory_syncs`

**Columns**:

| Column                    | Type     | Constraints | Description        |
| ------------------------- | -------- | ----------- | ------------------ |
| id                        | UUID     | TBD         | Column description |
| product_id                | UUID     | TBD         | Column description |
| shopify_product_id        | Unknown  | TBD         | Column description |
| shopify_variant_id        | Unknown  | TBD         | Column description |
| shopify_inventory_item_id | Unknown  | TBD         | Column description |
| direction                 | str      | TBD         | Column description |
| sync_type                 | str      | TBD         | Column description |
| old_quantity              | Unknown  | TBD         | Column description |
| new_quantity              | Unknown  | TBD         | Column description |
| quantity_delta            | Unknown  | TBD         | Column description |
| old_location              | Unknown  | TBD         | Column description |
| new_location              | Unknown  | TBD         | Column description |
| status                    | str      | TBD         | Column description |
| error_message             | Unknown  | TBD         | Column description |
| triggered_by              | Unknown  | TBD         | Column description |
| sync_metadata             | Unknown  | TBD         | Column description |
| synced_at                 | datetime | TBD         | Column description |
| created_at                | datetime | TBD         | Column description |

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
