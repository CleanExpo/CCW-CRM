---
type: 'model'
id: 'MODEL-XXX'
table: 'sales_staff'
file: 'apps/backend/src/db/pos_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-location]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-postransaction]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: SalesStaff

## Overview

Sales staff with location routing configuration.

Used for:

- Tracking who processed each sale
- Location routing (QLD-JOHN → Brisbane)
- Multi-location staff management

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `sales_staff`

**Columns**:

| Column                | Type   | Constraints | Description        |
| --------------------- | ------ | ----------- | ------------------ |
| id                    | Mapped | TBD         | Column description |
| staff_code            | Mapped | TBD         | Column description |
| full_name             | Mapped | TBD         | Column description |
| email                 | Mapped | TBD         | Column description |
| phone                 | Mapped | TBD         | Column description |
| primary_location_code | Mapped | TBD         | Column description |
| can_sell_at_locations | Mapped | TBD         | Column description |
| is_active             | Mapped | TBD         | Column description |
| created_at            | Mapped | TBD         | Column description |
| updated_at            | Mapped | TBD         | Column description |
| primary_location      | Mapped | TBD         | Column description |
| pos_transactions      | Mapped | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-location]]: one-to-many via foreign_key
- [[MODEL-XXX-postransaction]]: one-to-many via foreign_key

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

- [[MODEL-XXX-location]]: one-to-many
- [[MODEL-XXX-postransaction]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
