---
type: 'model'
id: 'MODEL-XXX'
table: 'cin7_invoices'
file: 'apps/backend/src/db/cin7_fulfilment_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Cin7Invoice

## Overview

Invoice record linked to a Cin7 order mapping.

Tracks invoice lifecycle from draft through to paid/overdue.
Can be populated by syncing from Cin7 or created locally.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `cin7_invoices`

**Columns**:

| Column                | Type   | Constraints | Description        |
| --------------------- | ------ | ----------- | ------------------ |
| id                    | Mapped | TBD         | Column description |
| cin7_order_mapping_id | Mapped | TBD         | Column description |
| cin7_invoice_id       | Mapped | TBD         | Column description |
| invoice_number        | Mapped | TBD         | Column description |
| invoice_date          | Mapped | TBD         | Column description |
| due_date              | Mapped | TBD         | Column description |
| amount                | Mapped | TBD         | Column description |
| currency              | Mapped | TBD         | Column description |
| status                | Mapped | TBD         | Column description |
| paid_at               | Mapped | TBD         | Column description |
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
