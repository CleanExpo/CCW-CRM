---
type: 'model'
id: 'MODEL-XXX'
table: 'ap2_transactions'
file: 'apps/backend/src/db/ap2_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-ap2mandate]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: AP2Transaction

## Overview

AP2 payment transactions.

Records all payment transactions with full audit trail.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `ap2_transactions`

**Columns**:

| Column                | Type                 | Constraints | Description        |
| --------------------- | -------------------- | ----------- | ------------------ |
| id                    | UUID                 | TBD         | Column description |
| mandate_id            | UUID                 | TBD         | Column description |
| transaction_type      | str                  | TBD         | Column description |
| status                | AP2TransactionStatus | TBD         | Column description |
| amount                | float                | TBD         | Column description |
| currency              | str                  | TBD         | Column description |
| fee                   | Unknown              | TBD         | Column description |
| net_amount            | Unknown              | TBD         | Column description |
| google_transaction_id | Unknown              | TBD         | Column description |
| payment_method        | Unknown              | TBD         | Column description |
| order_id              | Unknown              | TBD         | Column description |
| processing_started_at | Unknown              | TBD         | Column description |
| completed_at          | Unknown              | TBD         | Column description |
| failed_at             | Unknown              | TBD         | Column description |
| error_message         | Unknown              | TBD         | Column description |
| transaction_metadata  | Unknown              | TBD         | Column description |
| created_at            | datetime             | TBD         | Column description |
| updated_at            | datetime             | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-ap2mandate]]: one-to-many via foreign_key

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

- [[MODEL-XXX-ap2mandate]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
