---
type: 'model'
id: 'MODEL-XXX'
table: 'shopify_order_mappings'
file: 'apps/backend/src/db/shopify_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: ShopifyOrderMapping

## Overview

Mapping between ERP orders and Shopify orders.

Links imported Shopify orders to local order records.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `shopify_order_mappings`

**Columns**:

| Column               | Type   | Constraints | Description        |
| -------------------- | ------ | ----------- | ------------------ |
| id                   | Mapped | TBD         | Column description |
| order_id             | Mapped | TBD         | Column description |
| shopify_order_id     | Mapped | TBD         | Column description |
| shopify_order_number | Mapped | TBD         | Column description |
| shopify_order_name   | Mapped | TBD         | Column description |
| imported_at          | Mapped | TBD         | Column description |
| import_status        | Mapped | TBD         | Column description |
| financial_status     | Mapped | TBD         | Column description |
| fulfillment_status   | Mapped | TBD         | Column description |
| shopify_data         | Mapped | TBD         | Column description |
| created_at           | Mapped | TBD         | Column description |
| updated_at           | Mapped | TBD         | Column description |

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
