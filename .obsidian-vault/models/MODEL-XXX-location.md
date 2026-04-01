---
type: 'model'
id: 'MODEL-XXX'
table: 'locations'
file: 'apps/backend/src/db/pos_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-salesstaff]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-posterminal]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-bankaccount]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-postransaction]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-postransaction]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Location

## Overview

Location master data for physical stores and virtual sales channels.

Locations:

- brisbane: Brisbane Headquarters (physical)
- sydney: Sydney Branch (physical)
- melbourne: Melbourne Branch (physical)
- online: Online Sales (virtual)
- phone: Telephone Sales (virtual)

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `locations`

**Columns**:

| Column                    | Type   | Constraints | Description        |
| ------------------------- | ------ | ----------- | ------------------ |
| id                        | Mapped | TBD         | Column description |
| code                      | Mapped | TBD         | Column description |
| name                      | Mapped | TBD         | Column description |
| location_type             | Mapped | TBD         | Column description |
| address                   | Mapped | TBD         | Column description |
| city                      | Mapped | TBD         | Column description |
| state                     | Mapped | TBD         | Column description |
| postal_code               | Mapped | TBD         | Column description |
| country                   | Mapped | TBD         | Column description |
| timezone                  | Mapped | TBD         | Column description |
| is_active                 | Mapped | TBD         | Column description |
| created_at                | Mapped | TBD         | Column description |
| updated_at                | Mapped | TBD         | Column description |
| sales_staff               | Mapped | TBD         | Column description |
| pos_terminals             | Mapped | TBD         | Column description |
| bank_accounts             | Mapped | TBD         | Column description |
| pos_transactions_location | Mapped | TBD         | Column description |
| pos_transactions_resolved | Mapped | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-salesstaff]]: one-to-many via foreign_key
- [[MODEL-XXX-posterminal]]: one-to-many via foreign_key
- [[MODEL-XXX-bankaccount]]: one-to-many via foreign_key
- [[MODEL-XXX-postransaction]]: one-to-many via foreign_key
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

- [[MODEL-XXX-salesstaff]]: one-to-many
- [[MODEL-XXX-posterminal]]: one-to-many
- [[MODEL-XXX-bankaccount]]: one-to-many
- [[MODEL-XXX-postransaction]]: one-to-many
- [[MODEL-XXX-postransaction]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
