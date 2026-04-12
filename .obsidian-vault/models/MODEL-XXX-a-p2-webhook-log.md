---
type: 'model'
id: 'MODEL-XXX'
table: 'ap2_webhook_logs'
file: 'apps/backend/src/db/ap2_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: AP2WebhookLog

## Overview

AP2 webhook audit trail.

Logs all incoming webhooks from Google AP2 for debugging and compliance.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `ap2_webhook_logs`

**Columns**:

| Column             | Type     | Constraints | Description        |
| ------------------ | -------- | ----------- | ------------------ |
| id                 | UUID     | TBD         | Column description |
| event_type         | str      | TBD         | Column description |
| event_id           | Unknown  | TBD         | Column description |
| headers            | Unknown  | TBD         | Column description |
| payload            | Unknown  | TBD         | Column description |
| signature          | Unknown  | TBD         | Column description |
| signature_verified | Unknown  | TBD         | Column description |
| verification_error | Unknown  | TBD         | Column description |
| processed          | bool     | TBD         | Column description |
| processed_at       | Unknown  | TBD         | Column description |
| processing_error   | Unknown  | TBD         | Column description |
| mandate_id         | Unknown  | TBD         | Column description |
| transaction_id     | Unknown  | TBD         | Column description |
| received_at        | datetime | TBD         | Column description |
| created_at         | datetime | TBD         | Column description |

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
