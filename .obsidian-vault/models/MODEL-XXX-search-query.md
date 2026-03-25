---
type: 'model'
id: 'MODEL-XXX'
table: 'search_queries'
file: 'apps/backend/src/db/ai_search_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: SearchQuery

## Overview

Search query tracking for analytics.

Table: search_queries

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `search_queries`

**Columns**:

| Column              | Type     | Constraints | Description        |
| ------------------- | -------- | ----------- | ------------------ |
| id                  | UUID     | TBD         | Column description |
| query_text          | str      | TBD         | Column description |
| query_language      | str      | TBD         | Column description |
| query_type          | str      | TBD         | Column description |
| customer_id         | Unknown  | TBD         | Column description |
| session_id          | Unknown  | TBD         | Column description |
| results_count       | int      | TBD         | Column description |
| results_product_ids | Unknown  | TBD         | Column description |
| query_time_ms       | Unknown  | TBD         | Column description |
| clicked_product_id  | Unknown  | TBD         | Column description |
| clicked_rank        | Unknown  | TBD         | Column description |
| converted           | bool     | TBD         | Column description |
| searched_at         | datetime | TBD         | Column description |
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
