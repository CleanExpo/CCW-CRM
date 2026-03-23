---
type: 'model'
id: 'MODEL-XXX'
table: 'ap2_voice_sessions'
file: 'apps/backend/src/db/ap2_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: AP2VoiceSession

## Overview

AP2 voice commerce sessions.

Tracks voice interactions for voice-based ordering.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `ap2_voice_sessions`

**Columns**:

| Column               | Type                  | Constraints | Description        |
| -------------------- | --------------------- | ----------- | ------------------ |
| id                   | UUID                  | TBD         | Column description |
| connection_id        | Unknown               | TBD         | Column description |
| status               | AP2VoiceSessionStatus | TBD         | Column description |
| language             | str                   | TBD         | Column description |
| assistant_type       | str                   | TBD         | Column description |
| turn_count           | int                   | TBD         | Column description |
| conversation_history | Unknown               | TBD         | Column description |
| detected_intent      | Unknown               | TBD         | Column description |
| intent_confidence    | Unknown               | TBD         | Column description |
| mandate_id           | Unknown               | TBD         | Column description |
| order_id             | Unknown               | TBD         | Column description |
| started_at           | datetime              | TBD         | Column description |
| completed_at         | Unknown               | TBD         | Column description |
| abandoned_at         | Unknown               | TBD         | Column description |
| session_metadata     | Unknown               | TBD         | Column description |
| created_at           | datetime              | TBD         | Column description |
| updated_at           | datetime              | TBD         | Column description |

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
