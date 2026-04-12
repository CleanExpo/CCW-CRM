---
type: 'model'
id: 'MODEL-XXX'
table: 'stock_takes'
file: 'apps/backend/src/db/inventory_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-stocktakeitem]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: StockTake

## Overview

Cycle-count / stock-take session.

A stock-take records the physical count of all products at a location.
Submitting it applies variances as StockAdjustment records and stamps
last_counted_at on each ProductStockByLocation row.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `stock_takes`

**Columns**:

| Column       | Type     | Constraints | Description        |
| ------------ | -------- | ----------- | ------------------ |
| id           | UUID     | TBD         | Column description |
| location     | str      | TBD         | Column description |
| status       | str      | TBD         | Column description |
| created_by   | Unknown  | TBD         | Column description |
| submitted_by | Unknown  | TBD         | Column description |
| created_at   | datetime | TBD         | Column description |
| submitted_at | Unknown  | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-stocktakeitem]]: one-to-many via foreign_key

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

- [[MODEL-XXX-stocktakeitem]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
