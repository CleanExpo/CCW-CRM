---
type: 'model'
id: 'MODEL-XXX'
table: 'marketplace_orders'
file: 'apps/backend/src/db/marketplace_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: MarketplaceOrder

## Overview

Order from a marketplace channel.

Stores orders pulled from connected channels for unified order management.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `marketplace_orders`

**Columns**:

| Column                | Type   | Constraints | Description        |
| --------------------- | ------ | ----------- | ------------------ |
| id                    | Mapped | TBD         | Column description |
| channel_type          | Mapped | TBD         | Column description |
| connection_id         | Mapped | TBD         | Column description |
| external_order_id     | Mapped | TBD         | Column description |
| external_order_number | Mapped | TBD         | Column description |
| erp_order_id          | Mapped | TBD         | Column description |
| status                | Mapped | TBD         | Column description |
| customer_name         | Mapped | TBD         | Column description |
| customer_email        | Mapped | TBD         | Column description |
| total_amount          | Mapped | TBD         | Column description |
| currency              | Mapped | TBD         | Column description |
| shipping_address      | Mapped | TBD         | Column description |
| line_items            | Mapped | TBD         | Column description |
| synced_at             | Mapped | TBD         | Column description |
| sync_status           | Mapped | TBD         | Column description |
| sync_error            | Mapped | TBD         | Column description |
| channel_data          | Mapped | TBD         | Column description |
| ordered_at            | Mapped | TBD         | Column description |
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
