---
type: 'model'
id: 'MODEL-XXX'
table: 'marketplace_product_listings'
file: 'apps/backend/src/db/marketplace_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: MarketplaceProductListing

## Overview

Product listing on a marketplace channel.

Links an ERP product to its listing on a specific channel.
One product can have listings on multiple channels.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `marketplace_product_listings`

**Columns**:

| Column              | Type   | Constraints | Description        |
| ------------------- | ------ | ----------- | ------------------ |
| id                  | Mapped | TBD         | Column description |
| product_id          | Mapped | TBD         | Column description |
| channel_type        | Mapped | TBD         | Column description |
| connection_id       | Mapped | TBD         | Column description |
| external_product_id | Mapped | TBD         | Column description |
| external_variant_id | Mapped | TBD         | Column description |
| external_url        | Mapped | TBD         | Column description |
| listed_title        | Mapped | TBD         | Column description |
| listed_price        | Mapped | TBD         | Column description |
| listed_currency     | Mapped | TBD         | Column description |
| listed_quantity     | Mapped | TBD         | Column description |
| status              | Mapped | TBD         | Column description |
| channel_data        | Mapped | TBD         | Column description |
| last_synced_at      | Mapped | TBD         | Column description |
| sync_status         | Mapped | TBD         | Column description |
| sync_error          | Mapped | TBD         | Column description |
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
