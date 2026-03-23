---
type: 'model'
id: 'MODEL-XXX'
table: 'product_recommendations'
file: 'apps/backend/src/db/ai_search_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: ProductRecommendation

## Overview

Precomputed product recommendations.

Table: product_recommendations

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `product_recommendations`

**Columns**:

| Column                 | Type     | Constraints | Description        |
| ---------------------- | -------- | ----------- | ------------------ |
| id                     | UUID     | TBD         | Column description |
| source_product_id      | UUID     | TBD         | Column description |
| recommended_product_id | UUID     | TBD         | Column description |
| recommendation_type    | str      | TBD         | Column description |
| score                  | float    | TBD         | Column description |
| rank                   | int      | TBD         | Column description |
| reason                 | Unknown  | TBD         | Column description |
| algorithm_version      | Unknown  | TBD         | Column description |
| generated_at           | datetime | TBD         | Column description |
| created_at             | datetime | TBD         | Column description |
| updated_at             | datetime | TBD         | Column description |

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
