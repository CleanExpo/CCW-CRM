---
type: 'model'
id: 'MODEL-XXX'
table: 'shopify_product_translations'
file: 'apps/backend/src/db/shopify_extended_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: ShopifyProductTranslation

## Overview

Shopify multi-language product sync tracking.

Tracks which product translations have been synced to Shopify.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `shopify_product_translations`

**Columns**:

| Column                 | Type     | Constraints | Description        |
| ---------------------- | -------- | ----------- | ------------------ |
| id                     | UUID     | TBD         | Column description |
| product_id             | UUID     | TBD         | Column description |
| language_code          | str      | TBD         | Column description |
| shopify_product_id     | Unknown  | TBD         | Column description |
| shopify_translation_id | Unknown  | TBD         | Column description |
| is_synced              | bool     | TBD         | Column description |
| last_synced_at         | Unknown  | TBD         | Column description |
| sync_error             | Unknown  | TBD         | Column description |
| created_at             | datetime | TBD         | Column description |
| updated_at             | datetime | TBD         | Column description |

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
