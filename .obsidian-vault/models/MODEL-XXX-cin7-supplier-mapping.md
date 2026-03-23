---
type: 'model'
id: 'MODEL-XXX'
table: 'cin7_supplier_mappings'
file: 'apps/backend/src/db/cin7_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Cin7SupplierMapping

## Overview

Mapping between ERP suppliers and Cin7 suppliers.

Tracks which local supplier corresponds to which Cin7 supplier ID.
Note: Cin7 Omni has no dedicated supplier API — suppliers are embedded
in purchase order records.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `cin7_supplier_mappings`

**Columns**:

| Column                | Type   | Constraints | Description        |
| --------------------- | ------ | ----------- | ------------------ |
| id                    | Mapped | TBD         | Column description |
| supplier_id           | Mapped | TBD         | Column description |
| cin7_core_supplier_id | Mapped | TBD         | Column description |
| cin7_omni_supplier_id | Mapped | TBD         | Column description |
| cin7_supplier_name    | Mapped | TBD         | Column description |
| last_synced_at        | Mapped | TBD         | Column description |
| sync_status           | Mapped | TBD         | Column description |
| created_at            | Mapped | TBD         | Column description |
| updated_at            | Mapped | TBD         | Column description |

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
