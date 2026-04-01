---
type: 'model'
id: 'MODEL-XXX'
table: 'cin7_bom_components'
file: 'apps/backend/src/db/cin7_bom_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-cin7bommaster]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Cin7BomComponent

## Overview

A single component (ingredient/raw material) within a BOM.

Each row is one line in the Cin7 BOM component list.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `cin7_bom_components`

**Columns**:

| Column          | Type   | Constraints | Description        |
| --------------- | ------ | ----------- | ------------------ |
| id              | Mapped | TBD         | Column description |
| bom_master_id   | Mapped | TBD         | Column description |
| component_sku   | Mapped | TBD         | Column description |
| component_name  | Mapped | TBD         | Column description |
| quantity        | Mapped | TBD         | Column description |
| uom             | Mapped | TBD         | Column description |
| wastage_percent | Mapped | TBD         | Column description |
| notes           | Mapped | TBD         | Column description |
| bom_master      | Mapped | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-cin7bommaster]]: one-to-many via foreign_key

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

- [[MODEL-XXX-cin7bommaster]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
