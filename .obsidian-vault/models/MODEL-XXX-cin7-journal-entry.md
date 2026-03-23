---
type: 'model'
id: 'MODEL-XXX'
table: 'cin7_journal_entries'
file: 'apps/backend/src/db/cin7_gl_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-cin7journalline]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Cin7JournalEntry

## Overview

A journal entry in the GL, sourced from Cin7 or created manually.

Double-entry bookkeeping: total_debit must equal total_credit when posted.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `cin7_journal_entries`

**Columns**:

| Column          | Type   | Constraints | Description        |
| --------------- | ------ | ----------- | ------------------ |
| id              | Mapped | TBD         | Column description |
| cin7_journal_id | Mapped | TBD         | Column description |
| journal_date    | Mapped | TBD         | Column description |
| reference       | Mapped | TBD         | Column description |
| description     | Mapped | TBD         | Column description |
| status          | Mapped | TBD         | Column description |
| total_debit     | Mapped | TBD         | Column description |
| total_credit    | Mapped | TBD         | Column description |
| currency        | Mapped | TBD         | Column description |
| source          | Mapped | TBD         | Column description |
| cin7_synced     | Mapped | TBD         | Column description |
| created_at      | Mapped | TBD         | Column description |
| updated_at      | Mapped | TBD         | Column description |
| lines           | Mapped | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-cin7journalline]]: one-to-many via foreign_key

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

- [[MODEL-XXX-cin7journalline]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
