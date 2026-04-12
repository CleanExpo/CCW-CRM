---
type: 'model'
id: 'MODEL-XXX'
table: 'languages'
file: 'apps/backend/src/db/i18n_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-producttranslation]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-categorytranslation]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-uitranslation]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-emailtemplatetranslation]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-translationqueue]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Language

## Overview

Supported languages configuration.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `languages`

**Columns**:

| Column   | Type | Constraints | Description              |
| -------- | ---- | ----------- | ------------------------ |
| See code | -    | -           | Column details in source |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-producttranslation]]: one-to-many via foreign_key
- [[MODEL-XXX-categorytranslation]]: one-to-many via foreign_key
- [[MODEL-XXX-uitranslation]]: one-to-many via foreign_key
- [[MODEL-XXX-emailtemplatetranslation]]: one-to-many via foreign_key
- [[MODEL-XXX-translationqueue]]: one-to-many via foreign_key

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

- [[MODEL-XXX-producttranslation]]: one-to-many
- [[MODEL-XXX-categorytranslation]]: one-to-many
- [[MODEL-XXX-uitranslation]]: one-to-many
- [[MODEL-XXX-emailtemplatetranslation]]: one-to-many
- [[MODEL-XXX-translationqueue]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
