---
type: 'model'
id: 'MODEL-XXX'
table: 'cin7_payments'
file: 'apps/backend/src/db/cin7_fulfilment_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Cin7Payment

## Overview

Payment record linked to a Cin7Invoice.

Captures individual payment transactions against an invoice.
May be partial payments; full reconciliation happens when invoice
status is set to 'paid'.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `cin7_payments`

**Columns**:

| Column          | Type   | Constraints | Description        |
| --------------- | ------ | ----------- | ------------------ |
| id              | Mapped | TBD         | Column description |
| cin7_invoice_id | Mapped | TBD         | Column description |
| cin7_payment_id | Mapped | TBD         | Column description |
| payment_method  | Mapped | TBD         | Column description |
| amount          | Mapped | TBD         | Column description |
| currency        | Mapped | TBD         | Column description |
| payment_date    | Mapped | TBD         | Column description |
| reference       | Mapped | TBD         | Column description |
| status          | Mapped | TBD         | Column description |
| created_at      | Mapped | TBD         | Column description |

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
