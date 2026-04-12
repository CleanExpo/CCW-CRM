---
type: 'model'
id: 'MODEL-XXX'
table: 'cin7_sync_logs'
file: 'apps/backend/src/db/cin7_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Cin7SyncLog

## Overview

Audit trail for Cin7 sync operations.

Records every sync attempt with results for debugging and monitoring.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `cin7_sync_logs`

**Columns**:

| Column            | Type   | Constraints | Description        |
| ----------------- | ------ | ----------- | ------------------ |
| id                | Mapped | TBD         | Column description |
| connection_id     | Mapped | TBD         | Column description |
| sync_type         | Mapped | TBD         | Column description |
| direction         | Mapped | TBD         | Column description |
| api_source        | Mapped | TBD         | Column description |
| status            | Mapped | TBD         | Column description |
| records_processed | Mapped | TBD         | Column description |
| records_created   | Mapped | TBD         | Column description |
| records_updated   | Mapped | TBD         | Column description |
| records_failed    | Mapped | TBD         | Column description |
| error_message     | Mapped | TBD         | Column description |
| details           | Mapped | TBD         | Column description |
| started_at        | Mapped | TBD         | Column description |
| completed_at      | Mapped | TBD         | Column description |

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
