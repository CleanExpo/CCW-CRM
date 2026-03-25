---
type: 'model'
id: 'MODEL-XXX'
table: 'pos_terminals'
file: 'apps/backend/src/db/pos_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-location]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-postransaction]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: POSTerminal

## Overview

POS terminals (EFTPOS, AMEX, virtual) at each location.

Terminal types:

- eftpos: Physical EFTPOS terminal
- amex: AMEX payment gateway
- virtual: Online/phone sales (no physical terminal)

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `pos_terminals`

**Columns**:

| Column           | Type   | Constraints | Description        |
| ---------------- | ------ | ----------- | ------------------ |
| id               | Mapped | TBD         | Column description |
| terminal_id      | Mapped | TBD         | Column description |
| location_code    | Mapped | TBD         | Column description |
| terminal_type    | Mapped | TBD         | Column description |
| merchant_id      | Mapped | TBD         | Column description |
| terminal_config  | Mapped | TBD         | Column description |
| is_active        | Mapped | TBD         | Column description |
| last_ping_at     | Mapped | TBD         | Column description |
| created_at       | Mapped | TBD         | Column description |
| updated_at       | Mapped | TBD         | Column description |
| location         | Mapped | TBD         | Column description |
| pos_transactions | Mapped | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-location]]: one-to-many via foreign_key
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

- [[MODEL-XXX-location]]: one-to-many
- [[MODEL-XXX-postransaction]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
