---
type: 'model'
id: 'MODEL-XXX'
table: 'cin7_bom_masters'
file: 'apps/backend/src/db/cin7_bom_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-cin7bomcomponent]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-cin7productionrun]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Cin7BomMaster

## Overview

Bill of Materials master record.

Represents a Cin7 BOM definition — the finished good and its recipe.
Supports both Cin7 BOM v1 (BomMasters) and v2 (FinishedGoods) shapes.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `cin7_bom_masters`

**Columns**:

| Column             | Type   | Constraints | Description        |
| ------------------ | ------ | ----------- | ------------------ |
| id                 | Mapped | TBD         | Column description |
| cin7_bom_id        | Mapped | TBD         | Column description |
| name               | Mapped | TBD         | Column description |
| sku                | Mapped | TBD         | Column description |
| version            | Mapped | TBD         | Column description |
| status             | Mapped | TBD         | Column description |
| finished_good_sku  | Mapped | TBD         | Column description |
| finished_good_name | Mapped | TBD         | Column description |
| quantity_produced  | Mapped | TBD         | Column description |
| uom                | Mapped | TBD         | Column description |
| notes              | Mapped | TBD         | Column description |
| last_synced_at     | Mapped | TBD         | Column description |
| created_at         | Mapped | TBD         | Column description |
| updated_at         | Mapped | TBD         | Column description |
| components         | Mapped | TBD         | Column description |
| production_runs    | Mapped | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-cin7bomcomponent]]: one-to-many via foreign_key
- [[MODEL-XXX-cin7productionrun]]: one-to-many via foreign_key

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

- [[MODEL-XXX-cin7bomcomponent]]: one-to-many
- [[MODEL-XXX-cin7productionrun]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
