---
type: 'model'
id: 'MODEL-XXX'
table: 'quotes'
file: 'apps/backend/src/db/demo_models.py'
schema_locked: true
relationships:
  - model: '[[MODEL-XXX-customer]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-quoteitem]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Quote

## Overview

Quote model for pricing estimates.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `quotes`

**Columns**:

| Column          | Type     | Constraints | Description        |
| --------------- | -------- | ----------- | ------------------ |
| id              | UUID     | TBD         | Column description |
| organization_id | Unknown  | TBD         | Column description |
| quote_number    | str      | TBD         | Column description |
| customer_id     | UUID     | TBD         | Column description |
| status          | str      | TBD         | Column description |
| total           | Decimal  | TBD         | Column description |
| notes           | Unknown  | TBD         | Column description |
| valid_until     | Unknown  | TBD         | Column description |
| quote_date      | datetime | TBD         | Column description |
| created_at      | datetime | TBD         | Column description |
| updated_at      | datetime | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-customer]]: one-to-many via foreign_key
- [[MODEL-XXX-quoteitem]]: one-to-many via foreign_key

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
- [[MODEL-XXX-quoteitem]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
