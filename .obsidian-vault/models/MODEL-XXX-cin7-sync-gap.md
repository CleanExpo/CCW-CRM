---
type: 'model'
id: 'MODEL-XXX'
table: 'cin7_sync_gaps'
file: 'apps/backend/src/db/cin7_shadow_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Cin7SyncGap

## Overview

Detailed gap record linking a shadow sync to a specific data discrepancy.

Multiple gaps can exist for the same shadow sync record (e.g. a customer
can have a missing_in_erp gap AND a stale_data gap simultaneously).

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `cin7_sync_gaps`

**Columns**:

| Column           | Type   | Constraints | Description        |
| ---------------- | ------ | ----------- | ------------------ |
| id               | Mapped | TBD         | Column description |
| shadow_sync_id   | Mapped | TBD         | Column description |
| gap_type         | Mapped | TBD         | Column description |
| entity_type      | Mapped | TBD         | Column description |
| cin7_id          | Mapped | TBD         | Column description |
| erp_id           | Mapped | TBD         | Column description |
| field_name       | Mapped | TBD         | Column description |
| cin7_value       | Mapped | TBD         | Column description |
| erp_value        | Mapped | TBD         | Column description |
| severity         | Mapped | TBD         | Column description |
| status           | Mapped | TBD         | Column description |
| detected_at      | Mapped | TBD         | Column description |
| resolved_at      | Mapped | TBD         | Column description |
| resolution_notes | Mapped | TBD         | Column description |
| created_at       | Mapped | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

No relationships defined

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

No direct relationships

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
