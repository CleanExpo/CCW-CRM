---
type: 'model'
id: 'MODEL-XXX'
table: 'shopify_inventory_sync_queue'
file: 'apps/backend/src/db/shopify_extended_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: ShopifyInventorySyncQueue

## Overview

Shopify inventory sync retry queue.

PHASE 2: Enhanced Shopify Integration - Task 2.3
Tracks failed inventory syncs for automatic retry with exponential backoff.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `shopify_inventory_sync_queue`

**Columns**:

| Column                    | Type     | Constraints | Description        |
| ------------------------- | -------- | ----------- | ------------------ |
| id                        | UUID     | TBD         | Column description |
| product_id                | UUID     | TBD         | Column description |
| shopify_product_id        | str      | TBD         | Column description |
| shopify_inventory_item_id | str      | TBD         | Column description |
| shopify_location_id       | str      | TBD         | Column description |
| sync_direction            | str      | TBD         | Column description |
| triggered_by              | str      | TBD         | Column description |
| retry_count               | int      | TBD         | Column description |
| max_retries               | int      | TBD         | Column description |
| next_retry_at             | datetime | TBD         | Column description |
| last_error                | Unknown  | TBD         | Column description |
| status                    | str      | TBD         | Column description |
| sync_metadata             | Unknown  | TBD         | Column description |
| created_at                | datetime | TBD         | Column description |
| updated_at                | datetime | TBD         | Column description |
| completed_at              | Unknown  | TBD         | Column description |

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
