---
type: 'model'
id: 'MODEL-XXX'
table: 'orders'
file: 'apps/backend/src/db/demo_models.py'
schema_locked: true
relationships:
  - model: '[[MODEL-XXX-customer]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-orderitem]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-outboundshipment]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-orderactivity]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Order

## Overview

Sales order model.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `orders`

**Columns**:

| Column                  | Type     | Constraints | Description        |
| ----------------------- | -------- | ----------- | ------------------ |
| id                      | UUID     | TBD         | Column description |
| organization_id         | Unknown  | TBD         | Column description |
| order_number            | str      | TBD         | Column description |
| customer_id             | UUID     | TBD         | Column description |
| status                  | str      | TBD         | Column description |
| total                   | Decimal  | TBD         | Column description |
| notes                   | Unknown  | TBD         | Column description |
| xero_invoice_id         | Unknown  | TBD         | Column description |
| xero_synced_at          | Unknown  | TBD         | Column description |
| xero_sync_status        | Unknown  | TBD         | Column description |
| order_date              | datetime | TBD         | Column description |
| created_at              | datetime | TBD         | Column description |
| updated_at              | datetime | TBD         | Column description |
| fulfillment_location    | Unknown  | TBD         | Column description |
| tracking_number         | Unknown  | TBD         | Column description |
| carrier_name            | Unknown  | TBD         | Column description |
| shipped_date            | Unknown  | TBD         | Column description |
| estimated_delivery_date | Unknown  | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-customer]]: one-to-many via foreign_key
- [[MODEL-XXX-orderitem]]: one-to-many via foreign_key
- [[MODEL-XXX-outboundshipment]]: one-to-many via foreign_key
- [[MODEL-XXX-orderactivity]]: one-to-many via foreign_key

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

- [[MODEL-XXX-customer]]: one-to-many
- [[MODEL-XXX-orderitem]]: one-to-many
- [[MODEL-XXX-outboundshipment]]: one-to-many
- [[MODEL-XXX-orderactivity]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
