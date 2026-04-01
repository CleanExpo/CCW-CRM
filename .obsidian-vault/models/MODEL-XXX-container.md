---
type: 'model'
id: 'MODEL-XXX'
table: 'containers'
file: 'apps/backend/src/db/container_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-containeritem]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-purchaseorder]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-backorder]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Container

## Overview

Track shipping containers from suppliers.

Replaces CIN7's container tracking with full internal control.
Provides visibility into incoming stock and enables backorder pre-allocation.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `containers`

**Columns**:

| Column                 | Type            | Constraints | Description        |
| ---------------------- | --------------- | ----------- | ------------------ |
| id                     | UUID            | TBD         | Column description |
| container_number       | str             | TBD         | Column description |
| purchase_order_id      | Unknown         | TBD         | Column description |
| supplier_id            | Unknown         | TBD         | Column description |
| vessel_name            | Unknown         | TBD         | Column description |
| voyage_number          | Unknown         | TBD         | Column description |
| origin_port            | Unknown         | TBD         | Column description |
| destination_port       | Unknown         | TBD         | Column description |
| destination_warehouse  | str             | TBD         | Column description |
| booking_date           | Unknown         | TBD         | Column description |
| departure_date         | Unknown         | TBD         | Column description |
| estimated_arrival_date | Unknown         | TBD         | Column description |
| actual_arrival_date    | Unknown         | TBD         | Column description |
| customs_clearance_date | Unknown         | TBD         | Column description |
| delivered_date         | Unknown         | TBD         | Column description |
| status                 | ContainerStatus | TBD         | Column description |
| tracking_number        | Unknown         | TBD         | Column description |
| carrier                | Unknown         | TBD         | Column description |
| tracking_url           | Unknown         | TBD         | Column description |
| tracking_events        | dict            | TBD         | Column description |
| shipping_cost          | Unknown         | TBD         | Column description |
| customs_duty           | Unknown         | TBD         | Column description |
| other_charges          | Unknown         | TBD         | Column description |
| notes                  | Unknown         | TBD         | Column description |
| internal_notes         | Unknown         | TBD         | Column description |
| created_by             | Unknown         | TBD         | Column description |
| created_at             | datetime        | TBD         | Column description |
| updated_at             | datetime        | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-containeritem]]: one-to-many via foreign_key
- [[MODEL-XXX-purchaseorder]]: one-to-many via foreign_key
- [[MODEL-XXX-backorder]]: one-to-many via foreign_key

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

- [[MODEL-XXX-containeritem]]: one-to-many
- [[MODEL-XXX-purchaseorder]]: one-to-many
- [[MODEL-XXX-backorder]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
