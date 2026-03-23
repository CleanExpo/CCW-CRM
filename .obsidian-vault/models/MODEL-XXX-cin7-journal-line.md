---
type: 'model'
id: 'MODEL-XXX'
table: 'cin7_journal_lines'
file: 'apps/backend/src/db/cin7_gl_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-cin7journalentry]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-cin7chartofaccount]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Cin7JournalLine

## Overview

A single debit or credit line within a journal entry.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `cin7_journal_lines`

**Columns**:

| Column           | Type   | Constraints | Description        |
| ---------------- | ------ | ----------- | ------------------ |
| id               | Mapped | TBD         | Column description |
| journal_entry_id | Mapped | TBD         | Column description |
| account_id       | Mapped | TBD         | Column description |
| line_type        | Mapped | TBD         | Column description |
| amount           | Mapped | TBD         | Column description |
| description      | Mapped | TBD         | Column description |
| order_id         | Mapped | TBD         | Column description |
| tax_amount       | Mapped | TBD         | Column description |
| journal_entry    | Mapped | TBD         | Column description |
| account          | Mapped | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-cin7journalentry]]: one-to-many via foreign_key
- [[MODEL-XXX-cin7chartofaccount]]: one-to-many via foreign_key

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

- [[MODEL-XXX-cin7journalentry]]: one-to-many
- [[MODEL-XXX-cin7chartofaccount]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
