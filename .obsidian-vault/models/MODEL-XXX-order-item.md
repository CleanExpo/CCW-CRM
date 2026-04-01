---
type: 'model'
id: 'MODEL-XXX'
table: 'order_items'
file: 'apps/backend/src/db/demo_models.py'
schema_locked: true
relationships:
  - model: '[[MODEL-XXX-order]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-product]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: OrderItem

## Overview

Order line item model.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `order_items`

**Columns**:

| Column     | Type     | Constraints | Description        |
| ---------- | -------- | ----------- | ------------------ |
| id         | UUID     | TBD         | Column description |
| order_id   | UUID     | TBD         | Column description |
| product_id | UUID     | TBD         | Column description |
| quantity   | int      | TBD         | Column description |
| unit_price | Decimal  | TBD         | Column description |
| line_total | Decimal  | TBD         | Column description |
| created_at | datetime | TBD         | Column description |
| updated_at | datetime | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-order]]: one-to-many via foreign_key
- [[MODEL-XXX-product]]: one-to-many via foreign_key

## Used By Routes

See code for route usage

<!-- END AUTO-GENERATED -->

<!-- HUMAN-CURATED -->

## Schema Notes

⚠️ **Schema Locked**: This is a production table. Modifying this schema requires:

1. Explicit approval from project owner
2. Migration plan with rollback strategy
3. Data backfill plan for existing records
4. Testing in staging environment

**DO NOT MODIFY WITHOUT APPROVAL.**

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

- [[MODEL-XXX-order]]: one-to-many
- [[MODEL-XXX-product]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
