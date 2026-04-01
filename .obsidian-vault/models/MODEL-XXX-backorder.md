---
type: 'model'
id: 'MODEL-XXX'
table: 'backorders'
file: 'apps/backend/src/db/container_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-order]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-product]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-customer]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-container]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Backorder

## Overview

Track unfulfilled order items (backorders).

Automatically calculates ETA from incoming containers and triggers
fulfillment when stock arrives.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `backorders`

**Columns**:

| Column                     | Type            | Constraints | Description        |
| -------------------------- | --------------- | ----------- | ------------------ |
| id                         | UUID            | TBD         | Column description |
| order_id                   | UUID            | TBD         | Column description |
| order_item_id              | Unknown         | TBD         | Column description |
| product_id                 | UUID            | TBD         | Column description |
| customer_id                | Unknown         | TBD         | Column description |
| quantity_backordered       | int             | TBD         | Column description |
| quantity_fulfilled         | int             | TBD         | Column description |
| fulfillment_location       | str             | TBD         | Column description |
| container_id               | Unknown         | TBD         | Column description |
| expected_availability_date | Unknown         | TBD         | Column description |
| original_order_date        | datetime        | TBD         | Column description |
| status                     | BackorderStatus | TBD         | Column description |
| customer_notified          | bool            | TBD         | Column description |
| last_notification_date     | Unknown         | TBD         | Column description |
| notification_count         | int             | TBD         | Column description |
| priority                   | int             | TBD         | Column description |
| notes                      | Unknown         | TBD         | Column description |
| internal_notes             | Unknown         | TBD         | Column description |
| created_by                 | Unknown         | TBD         | Column description |
| created_at                 | datetime        | TBD         | Column description |
| updated_at                 | datetime        | TBD         | Column description |
| fulfilled_at               | Unknown         | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-order]]: one-to-many via foreign_key
- [[MODEL-XXX-product]]: one-to-many via foreign_key
- [[MODEL-XXX-customer]]: one-to-many via foreign_key
- [[MODEL-XXX-container]]: one-to-many via foreign_key

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

- [[MODEL-XXX-order]]: one-to-many
- [[MODEL-XXX-product]]: one-to-many
- [[MODEL-XXX-customer]]: one-to-many
- [[MODEL-XXX-container]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
