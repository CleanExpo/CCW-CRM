---
type: 'model'
id: 'MODEL-XXX'
table: 'purchase_order_items'
file: 'apps/backend/src/db/inventory_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-purchaseorder]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-product]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: PurchaseOrderItem

## Overview

Line items for purchase orders.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `purchase_order_items`

**Columns**:

| Column            | Type     | Constraints | Description        |
| ----------------- | -------- | ----------- | ------------------ |
| id                | UUID     | TBD         | Column description |
| purchase_order_id | UUID     | TBD         | Column description |
| product_id        | UUID     | TBD         | Column description |
| quantity          | int      | TBD         | Column description |
| quantity_received | int      | TBD         | Column description |
| unit_cost         | Decimal  | TBD         | Column description |
| subtotal          | Decimal  | TBD         | Column description |
| created_at        | datetime | TBD         | Column description |
| updated_at        | datetime | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-purchaseorder]]: one-to-many via foreign_key
- [[MODEL-XXX-product]]: one-to-many via foreign_key

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

- [[MODEL-XXX-purchaseorder]]: one-to-many
- [[MODEL-XXX-product]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
