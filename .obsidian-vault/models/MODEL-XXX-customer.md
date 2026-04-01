---
type: 'model'
id: 'MODEL-XXX'
table: 'customers'
file: 'apps/backend/src/db/demo_models.py'
schema_locked: true
relationships:
  - model: '[[MODEL-XXX-order]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-quote]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Customer

## Overview

Customer model for CRM.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `customers`

**Columns**:

| Column          | Type     | Constraints | Description        |
| --------------- | -------- | ----------- | ------------------ |
| id              | UUID     | TBD         | Column description |
| organization_id | Unknown  | TBD         | Column description |
| customer_number | str      | TBD         | Column description |
| company_name    | str      | TBD         | Column description |
| contact_name    | str      | TBD         | Column description |
| email           | str      | TBD         | Column description |
| phone           | Unknown  | TBD         | Column description |
| address         | Unknown  | TBD         | Column description |
| city            | Unknown  | TBD         | Column description |
| state           | Unknown  | TBD         | Column description |
| postcode        | Unknown  | TBD         | Column description |
| xero_contact_id | Unknown  | TBD         | Column description |
| xero_synced_at  | Unknown  | TBD         | Column description |
| is_active       | bool     | TBD         | Column description |
| created_at      | datetime | TBD         | Column description |
| updated_at      | datetime | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-order]]: one-to-many via foreign_key
- [[MODEL-XXX-quote]]: one-to-many via foreign_key

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

- [[MODEL-XXX-order]]: one-to-many
- [[MODEL-XXX-quote]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
