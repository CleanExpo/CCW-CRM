---
type: 'model'
id: 'MODEL-XXX'
table: 'voice_search_sessions'
file: 'apps/backend/src/db/ai_search_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: VoiceSearchSession

## Overview

Voice search session tracking.

Table: voice_search_sessions

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `voice_search_sessions`

**Columns**:

| Column              | Type     | Constraints | Description        |
| ------------------- | -------- | ----------- | ------------------ |
| id                  | UUID     | TBD         | Column description |
| session_id          | str      | TBD         | Column description |
| language            | str      | TBD         | Column description |
| assistant_type      | Unknown  | TBD         | Column description |
| query_count         | int      | TBD         | Column description |
| queries             | Unknown  | TBD         | Column description |
| total_results_shown | int      | TBD         | Column description |
| conversion_count    | int      | TBD         | Column description |
| started_at          | datetime | TBD         | Column description |
| ended_at            | Unknown  | TBD         | Column description |
| duration_seconds    | Unknown  | TBD         | Column description |
| created_at          | datetime | TBD         | Column description |

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
