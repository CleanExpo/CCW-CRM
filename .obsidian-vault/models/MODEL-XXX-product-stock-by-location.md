---
type: 'model'
id: 'MODEL-XXX'
table: 'product_stock_by_location'
file: 'apps/backend/src/db/inventory_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: ProductStockByLocation

## Overview

Product stock tracking by store location.

Tracks inventory independently for each store, with support for
stock reservation and transfers.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `product_stock_by_location`

**Columns**:

| Column           | Type     | Constraints | Description        |
| ---------------- | -------- | ----------- | ------------------ |
| id               | UUID     | TBD         | Column description |
| product_id       | UUID     | TBD         | Column description |
| location         | str      | TBD         | Column description |
| stock            | int      | TBD         | Column description |
| reserved         | int      | TBD         | Column description |
| last_counted_at  | Unknown  | TBD         | Column description |
| last_counted_by  | Unknown  | TBD         | Column description |
| reorder_point    | Unknown  | TBD         | Column description |
| reorder_quantity | Unknown  | TBD         | Column description |
| created_at       | datetime | TBD         | Column description |
| updated_at       | datetime | TBD         | Column description |

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
