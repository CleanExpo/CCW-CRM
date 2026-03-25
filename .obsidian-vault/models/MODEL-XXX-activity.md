---
type: 'model'
id: 'MODEL-XXX'
table: 'activities'
file: 'apps/backend/src/db/crm_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-customer]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-contact]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-order]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-quote]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Activity

## Overview

Activity model for CRM interaction tracking.

Tracks all interactions with customers and contacts including
calls, emails, meetings, notes, and tasks.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `activities`

**Columns**:

| Column        | Type     | Constraints | Description        |
| ------------- | -------- | ----------- | ------------------ |
| id            | UUID     | TBD         | Column description |
| activity_type | str      | TBD         | Column description |
| subject       | str      | TBD         | Column description |
| description   | Unknown  | TBD         | Column description |
| customer_id   | Unknown  | TBD         | Column description |
| contact_id    | Unknown  | TBD         | Column description |
| order_id      | Unknown  | TBD         | Column description |
| quote_id      | Unknown  | TBD         | Column description |
| due_date      | Unknown  | TBD         | Column description |
| completed_at  | Unknown  | TBD         | Column description |
| created_by    | Unknown  | TBD         | Column description |
| created_at    | datetime | TBD         | Column description |
| updated_at    | datetime | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-customer]]: one-to-many via foreign_key
- [[MODEL-XXX-contact]]: one-to-many via foreign_key
- [[MODEL-XXX-order]]: one-to-many via foreign_key
- [[MODEL-XXX-quote]]: one-to-many via foreign_key

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

- [[MODEL-XXX-customer]]: one-to-many
- [[MODEL-XXX-contact]]: one-to-many
- [[MODEL-XXX-order]]: one-to-many
- [[MODEL-XXX-quote]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
