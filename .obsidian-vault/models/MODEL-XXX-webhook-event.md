---
type: 'model'
id: 'MODEL-XXX'
table: 'webhook_events'
file: 'apps/backend/src/db/webhook_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: WebhookEvent

## Overview

Persistent webhook event log for reliable processing.

This table ensures:

1. No data loss on handler crashes (event is persisted before processing)
2. Idempotency (unique event_id prevents duplicate processing)
3. Retry capability (failed events can be retried with backoff)
4. Audit trail (full history of all webhook events)

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `webhook_events`

**Columns**:

| Column                | Type   | Constraints | Description        |
| --------------------- | ------ | ----------- | ------------------ |
| id                    | Mapped | TBD         | Column description |
| source                | Mapped | TBD         | Column description |
| event_type            | Mapped | TBD         | Column description |
| event_id              | Mapped | TBD         | Column description |
| payload               | Mapped | TBD         | Column description |
| headers               | Mapped | TBD         | Column description |
| status                | Mapped | TBD         | Column description |
| retry_count           | Mapped | TBD         | Column description |
| max_retries           | Mapped | TBD         | Column description |
| next_retry_at         | Mapped | TBD         | Column description |
| error_message         | Mapped | TBD         | Column description |
| error_details         | Mapped | TBD         | Column description |
| processing_result     | Mapped | TBD         | Column description |
| received_at           | Mapped | TBD         | Column description |
| started_processing_at | Mapped | TBD         | Column description |
| completed_at          | Mapped | TBD         | Column description |

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
