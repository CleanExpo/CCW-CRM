---
type: 'model'
id: 'MODEL-XXX'
table: 'customer_product_interactions'
file: 'apps/backend/src/db/ai_search_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: CustomerProductInteraction

## Overview

Customer product interactions for personalized recommendations.

Table: customer_product_interactions

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `customer_product_interactions`

**Columns**:

| Column               | Type     | Constraints | Description        |
| -------------------- | -------- | ----------- | ------------------ |
| id                   | UUID     | TBD         | Column description |
| customer_id          | UUID     | TBD         | Column description |
| product_id           | UUID     | TBD         | Column description |
| interaction_type     | str      | TBD         | Column description |
| interaction_count    | int      | TBD         | Column description |
| session_id           | Unknown  | TBD         | Column description |
| source               | Unknown  | TBD         | Column description |
| first_interaction_at | datetime | TBD         | Column description |
| last_interaction_at  | datetime | TBD         | Column description |
| created_at           | datetime | TBD         | Column description |
| updated_at           | datetime | TBD         | Column description |

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
