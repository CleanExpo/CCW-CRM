---
type: 'model'
id: 'MODEL-XXX'
table: 'pos_transactions'
file: 'apps/backend/src/db/pos_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-posterminal]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-salesstaff]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-location]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-location]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-bankfeed]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: POSTransaction

## Overview

POS transaction records with payment and reconciliation tracking.

Handles:

- Walk-in sales (no order)
- Order-based sales (linked to order)
- Payment processing (EFTPOS, AMEX, bank transfer, cash)
- Location routing (QLD branch routing logic)
- Reconciliation with bank feeds and Xero

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `pos_transactions`

**Columns**:

| Column                   | Type   | Constraints | Description        |
| ------------------------ | ------ | ----------- | ------------------ |
| id                       | Mapped | TBD         | Column description |
| transaction_number       | Mapped | TBD         | Column description |
| order_id                 | Mapped | TBD         | Column description |
| terminal_id              | Mapped | TBD         | Column description |
| sales_staff_id           | Mapped | TBD         | Column description |
| location_code            | Mapped | TBD         | Column description |
| resolved_location_code   | Mapped | TBD         | Column description |
| transaction_type         | Mapped | TBD         | Column description |
| payment_method           | Mapped | TBD         | Column description |
| amount                   | Mapped | TBD         | Column description |
| currency                 | Mapped | TBD         | Column description |
| payment_status           | Mapped | TBD         | Column description |
| payment_gateway_ref      | Mapped | TBD         | Column description |
| payment_gateway_response | Mapped | TBD         | Column description |
| bank_statement_ref       | Mapped | TBD         | Column description |
| xero_invoice_id          | Mapped | TBD         | Column description |
| cin7_transaction_id      | Mapped | TBD         | Column description |
| reconciliation_status    | Mapped | TBD         | Column description |
| reconciled_at            | Mapped | TBD         | Column description |
| reconciled_by            | Mapped | TBD         | Column description |
| created_at               | Mapped | TBD         | Column description |
| updated_at               | Mapped | TBD         | Column description |
| terminal                 | Mapped | TBD         | Column description |
| sales_staff              | Mapped | TBD         | Column description |
| location                 | Mapped | TBD         | Column description |
| resolved_location        | Mapped | TBD         | Column description |
| bank_feeds               | Mapped | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-posterminal]]: one-to-many via foreign_key
- [[MODEL-XXX-salesstaff]]: one-to-many via foreign_key
- [[MODEL-XXX-location]]: one-to-many via foreign_key
- [[MODEL-XXX-location]]: one-to-many via foreign_key
- [[MODEL-XXX-bankfeed]]: one-to-many via foreign_key

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

- [[MODEL-XXX-posterminal]]: one-to-many
- [[MODEL-XXX-salesstaff]]: one-to-many
- [[MODEL-XXX-location]]: one-to-many
- [[MODEL-XXX-location]]: one-to-many
- [[MODEL-XXX-bankfeed]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
