---
type: 'model'
id: 'MODEL-XXX'
table: 'bank_feeds'
file: 'apps/backend/src/db/pos_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-bankaccount]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-postransaction]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: BankFeed

## Overview

Bank feed transactions for automatic reconciliation.

Auto-matches POS transactions with bank feed data based on:

- Amount
- Date
- Reference number

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `bank_feeds`

**Columns**:

| Column                     | Type   | Constraints | Description        |
| -------------------------- | ------ | ----------- | ------------------ |
| id                         | Mapped | TBD         | Column description |
| bank_account_id            | Mapped | TBD         | Column description |
| transaction_date           | Mapped | TBD         | Column description |
| description                | Mapped | TBD         | Column description |
| reference                  | Mapped | TBD         | Column description |
| debit                      | Mapped | TBD         | Column description |
| credit                     | Mapped | TBD         | Column description |
| balance                    | Mapped | TBD         | Column description |
| matched_pos_transaction_id | Mapped | TBD         | Column description |
| match_confidence           | Mapped | TBD         | Column description |
| match_status               | Mapped | TBD         | Column description |
| matched_at                 | Mapped | TBD         | Column description |
| matched_by                 | Mapped | TBD         | Column description |
| raw_data                   | Mapped | TBD         | Column description |
| match_suggestions          | Mapped | TBD         | Column description |
| created_at                 | Mapped | TBD         | Column description |
| updated_at                 | Mapped | TBD         | Column description |
| bank_account               | Mapped | TBD         | Column description |
| matched_pos_transaction    | Mapped | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-bankaccount]]: one-to-many via foreign_key
- [[MODEL-XXX-postransaction]]: one-to-many via foreign_key

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

- [[MODEL-XXX-bankaccount]]: one-to-many
- [[MODEL-XXX-postransaction]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
