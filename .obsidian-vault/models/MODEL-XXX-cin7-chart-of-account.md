---
type: 'model'
id: 'MODEL-XXX'
table: 'cin7_chart_of_accounts'
file: 'apps/backend/src/db/cin7_gl_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-cin7journalline]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-cin7accountmapping]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Cin7ChartOfAccount

## Overview

A single account in the Cin7 Chart of Accounts.

Synced from Cin7 and used to map ERP transactions to GL codes.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `cin7_chart_of_accounts`

**Columns**:

| Column            | Type   | Constraints | Description        |
| ----------------- | ------ | ----------- | ------------------ |
| id                | Mapped | TBD         | Column description |
| cin7_account_id   | Mapped | TBD         | Column description |
| account_code      | Mapped | TBD         | Column description |
| account_name      | Mapped | TBD         | Column description |
| account_type      | Mapped | TBD         | Column description |
| parent_account_id | Mapped | TBD         | Column description |
| is_active         | Mapped | TBD         | Column description |
| currency          | Mapped | TBD         | Column description |
| description       | Mapped | TBD         | Column description |
| last_synced_at    | Mapped | TBD         | Column description |
| created_at        | Mapped | TBD         | Column description |
| updated_at        | Mapped | TBD         | Column description |
| journal_lines     | Mapped | TBD         | Column description |
| account_mappings  | Mapped | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-cin7journalline]]: one-to-many via foreign_key
- [[MODEL-XXX-cin7accountmapping]]: one-to-many via foreign_key

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
- [[MODEL-XXX-cin7accountmapping]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
