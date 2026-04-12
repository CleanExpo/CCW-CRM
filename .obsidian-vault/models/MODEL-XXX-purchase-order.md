---
type: 'model'
id: 'MODEL-XXX'
table: 'purchase_orders'
file: 'apps/backend/src/db/inventory_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-supplier]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-purchaseorderitem]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-inboundshipment]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: PurchaseOrder

## Overview

Purchase order for ordering stock from suppliers.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `purchase_orders`

**Columns**:

| Column                 | Type     | Constraints | Description        |
| ---------------------- | -------- | ----------- | ------------------ |
| id                     | UUID     | TBD         | Column description |
| po_number              | str      | TBD         | Column description |
| supplier_id            | UUID     | TBD         | Column description |
| delivery_location      | str      | TBD         | Column description |
| status                 | str      | TBD         | Column description |
| order_date             | Unknown  | TBD         | Column description |
| expected_delivery_date | Unknown  | TBD         | Column description |
| actual_delivery_date   | Unknown  | TBD         | Column description |
| subtotal               | Decimal  | TBD         | Column description |
| tax                    | Decimal  | TBD         | Column description |
| shipping_cost          | Unknown  | TBD         | Column description |
| total                  | Decimal  | TBD         | Column description |
| notes                  | Unknown  | TBD         | Column description |
| xero_purchase_order_id | Unknown  | TBD         | Column description |
| xero_synced_at         | Unknown  | TBD         | Column description |
| created_at             | datetime | TBD         | Column description |
| updated_at             | datetime | TBD         | Column description |
| created_by_id          | Unknown  | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-supplier]]: one-to-many via foreign_key
- [[MODEL-XXX-purchaseorderitem]]: one-to-many via foreign_key
- [[MODEL-XXX-inboundshipment]]: one-to-many via foreign_key

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
- [[MODEL-XXX-purchaseorderitem]]: one-to-many
- [[MODEL-XXX-inboundshipment]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
