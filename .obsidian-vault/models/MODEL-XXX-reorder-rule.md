---
type: 'model'
id: 'MODEL-XXX'
table: 'reorder_rules'
file: 'apps/backend/src/db/inventory_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-supplier]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: ReorderRule

## Overview

Reorder automation rule — links a product+location to a preferred supplier.

When auto-reorder is triggered for a product at a location this rule
determines which supplier to create the draft PO against.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `reorder_rules`

**Columns**:

| Column                 | Type     | Constraints | Description        |
| ---------------------- | -------- | ----------- | ------------------ |
| id                     | UUID     | TBD         | Column description |
| product_id             | UUID     | TBD         | Column description |
| location               | str      | TBD         | Column description |
| supplier_id            | Unknown  | TBD         | Column description |
| auto_approve_under_qty | int      | TBD         | Column description |
| lead_time_days         | int      | TBD         | Column description |
| is_enabled             | bool     | TBD         | Column description |
| created_at             | datetime | TBD         | Column description |
| updated_at             | datetime | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-supplier]]: one-to-many via foreign_key

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

- [[MODEL-XXX-supplier]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
