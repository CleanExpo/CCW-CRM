---
type: 'model'
id: 'MODEL-XXX'
table: 'sla_rules'
file: 'apps/backend/src/db/workflow_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-slainstance]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: SLARule

## Overview

SLA rule definition: entity type + deadline hours + escalation action.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `sla_rules`

**Columns**:

| Column            | Type     | Constraints | Description        |
| ----------------- | -------- | ----------- | ------------------ |
| id                | UUID     | TBD         | Column description |
| name              | str      | TBD         | Column description |
| entity_type       | str      | TBD         | Column description |
| sla_hours         | int      | TBD         | Column description |
| escalation_action | str      | TBD         | Column description |
| escalation_config | Unknown  | TBD         | Column description |
| is_active         | bool     | TBD         | Column description |
| created_at        | datetime | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-slainstance]]: one-to-many via foreign_key

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

- [[MODEL-XXX-slainstance]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
