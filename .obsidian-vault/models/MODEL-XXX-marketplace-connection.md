---
type: 'model'
id: 'MODEL-XXX'
table: 'marketplace_connections'
file: 'apps/backend/src/db/marketplace_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: MarketplaceConnection

## Overview

Marketplace channel connection configuration.

Stores credentials and connection state for each marketplace channel.
One row per channel type (e.g. one Shopify connection, one eBay connection).

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `marketplace_connections`

**Columns**:

| Column              | Type   | Constraints | Description        |
| ------------------- | ------ | ----------- | ------------------ |
| id                  | Mapped | TBD         | Column description |
| channel_type        | Mapped | TBD         | Column description |
| display_name        | Mapped | TBD         | Column description |
| status              | Mapped | TBD         | Column description |
| is_active           | Mapped | TBD         | Column description |
| mode                | Mapped | TBD         | Column description |
| credentials         | Mapped | TBD         | Column description |
| channel_metadata    | Mapped | TBD         | Column description |
| sync_settings       | Mapped | TBD         | Column description |
| last_product_sync   | Mapped | TBD         | Column description |
| last_inventory_sync | Mapped | TBD         | Column description |
| last_order_sync     | Mapped | TBD         | Column description |
| last_sync_error     | Mapped | TBD         | Column description |
| created_at          | Mapped | TBD         | Column description |
| updated_at          | Mapped | TBD         | Column description |

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
