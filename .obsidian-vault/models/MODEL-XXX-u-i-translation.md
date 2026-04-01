---
type: 'model'
id: 'MODEL-XXX'
table: 'ui_translations'
file: 'apps/backend/src/db/i18n_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-language]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: UITranslation

## Overview

Key-value store for frontend UI strings.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `ui_translations`

**Columns**:

| Column   | Type | Constraints | Description              |
| -------- | ---- | ----------- | ------------------------ |
| See code | -    | -           | Column details in source |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-language]]: one-to-many via foreign_key

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

- [[MODEL-XXX-language]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
