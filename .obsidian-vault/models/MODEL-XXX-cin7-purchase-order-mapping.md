---
type: 'model'
id: 'MODEL-XXX'
table: 'cin7_purchase_order_mappings'
file: 'apps/backend/src/db/cin7_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Cin7PurchaseOrderMapping

## Overview

Mapping between ERP purchase orders and Cin7 purchase orders.

Tracks which local PO corresponds to which Cin7 purchase ID
across both Core and Omni systems.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `cin7_purchase_order_mappings`

**Columns**:

| Column                | Type   | Constraints | Description        |
| --------------------- | ------ | ----------- | ------------------ |
| id                    | Mapped | TBD         | Column description |
| purchase_order_id     | Mapped | TBD         | Column description |
| cin7_core_purchase_id | Mapped | TBD         | Column description |
| cin7_omni_po_id       | Mapped | TBD         | Column description |
| cin7_po_number        | Mapped | TBD         | Column description |
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
