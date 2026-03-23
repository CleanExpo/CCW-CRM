---
type: 'model'
id: 'MODEL-XXX'
table: 'cin7_goods_receipt_lines'
file: 'apps/backend/src/db/cin7_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Cin7GoodsReceiptLine

## Overview

Individual line item on a Goods Receipt Note.

Records the SKU, quantities received, condition, and put-away location
for each product line in a GRN.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `cin7_goods_receipt_lines`

**Columns**:

| Column            | Type   | Constraints | Description        |
| ----------------- | ------ | ----------- | ------------------ |
| id                | Mapped | TBD         | Column description |
| goods_receipt_id  | Mapped | TBD         | Column description |
| product_id        | Mapped | TBD         | Column description |
| sku               | Mapped | TBD         | Column description |
| product_name      | Mapped | TBD         | Column description |
| ordered_qty       | Mapped | TBD         | Column description |
| received_qty      | Mapped | TBD         | Column description |
| put_away_location | Mapped | TBD         | Column description |
| batch_number      | Mapped | TBD         | Column description |
| expiry_date       | Mapped | TBD         | Column description |
| condition         | Mapped | TBD         | Column description |
| notes             | Mapped | TBD         | Column description |

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
