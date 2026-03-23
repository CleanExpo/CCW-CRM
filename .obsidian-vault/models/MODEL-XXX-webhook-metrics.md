---
type: 'model'
id: 'MODEL-XXX'
table: 'webhook_metrics'
file: 'apps/backend/src/db/webhook_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: WebhookMetrics

## Overview

Aggregated webhook metrics for monitoring dashboards.

Updated periodically by a background job to avoid expensive queries.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `webhook_metrics`

**Columns**:

| Column                 | Type   | Constraints | Description        |
| ---------------------- | ------ | ----------- | ------------------ |
| id                     | Mapped | TBD         | Column description |
| period_type            | Mapped | TBD         | Column description |
| period_start           | Mapped | TBD         | Column description |
| period_end             | Mapped | TBD         | Column description |
| source                 | Mapped | TBD         | Column description |
| total_received         | Mapped | TBD         | Column description |
| total_completed        | Mapped | TBD         | Column description |
| total_failed           | Mapped | TBD         | Column description |
| total_dead_letter      | Mapped | TBD         | Column description |
| avg_processing_time_ms | Mapped | TBD         | Column description |
| max_processing_time_ms | Mapped | TBD         | Column description |
| reliability_rate       | Mapped | TBD         | Column description |
| calculated_at          | Mapped | TBD         | Column description |

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
