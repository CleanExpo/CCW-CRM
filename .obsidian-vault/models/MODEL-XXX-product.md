---
type: 'model'
id: 'MODEL-XXX'
table: 'products'
file: 'apps/backend/src/db/demo_models.py'
schema_locked: true
relationships:
  - model: '[[MODEL-XXX-orderitem]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-quoteitem]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-producttranslation]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Product

## Overview

Product model for equipment catalog.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `products`

**Columns**:

| Column             | Type     | Constraints | Description        |
| ------------------ | -------- | ----------- | ------------------ |
| id                 | UUID     | TBD         | Column description |
| organization_id    | Unknown  | TBD         | Column description |
| sku                | str      | TBD         | Column description |
| name               | str      | TBD         | Column description |
| description        | Unknown  | TBD         | Column description |
| category           | str      | TBD         | Column description |
| price              | Decimal  | TBD         | Column description |
| cost               | Decimal  | TBD         | Column description |
| stock              | int      | TBD         | Column description |
| warehouse_location | Unknown  | TBD         | Column description |
| embedding          | Unknown  | TBD         | Column description |
| is_active          | bool     | TBD         | Column description |
| created_at         | datetime | TBD         | Column description |
| updated_at         | datetime | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-orderitem]]: one-to-many via foreign_key
- [[MODEL-XXX-quoteitem]]: one-to-many via foreign_key
- [[MODEL-XXX-producttranslation]]: one-to-many via foreign_key

## Used By Routes

See code for route usage

<!-- END AUTO-GENERATED -->

<!-- HUMAN-CURATED -->

## Schema Notes

⚠️ **Schema Locked**: This is a production table. Modifying this schema requires:

1. Explicit approval from project owner
2. Migration plan with rollback strategy
3. Data backfill plan for existing records
4. Testing in staging environment

**DO NOT MODIFY WITHOUT APPROVAL.**

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

- [[MODEL-XXX-orderitem]]: one-to-many
- [[MODEL-XXX-quoteitem]]: one-to-many
- [[MODEL-XXX-producttranslation]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
