---
type: 'model'
id: 'MODEL-XXX'
table: 'outbound_shipments'
file: 'apps/backend/src/db/inventory_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-order]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: OutboundShipment

## Overview

Outbound shipments from warehouses to customers.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `outbound_shipments`

**Columns**:

| Column                 | Type     | Constraints | Description        |
| ---------------------- | -------- | ----------- | ------------------ |
| id                     | UUID     | TBD         | Column description |
| shipment_number        | str      | TBD         | Column description |
| order_id               | UUID     | TBD         | Column description |
| carrier_name           | Unknown  | TBD         | Column description |
| carrier_service        | Unknown  | TBD         | Column description |
| tracking_number        | Unknown  | TBD         | Column description |
| origin_location        | str      | TBD         | Column description |
| destination_address    | Unknown  | TBD         | Column description |
| status                 | str      | TBD         | Column description |
| shipped_date           | Unknown  | TBD         | Column description |
| expected_delivery_date | Unknown  | TBD         | Column description |
| actual_delivery_date   | Unknown  | TBD         | Column description |
| tracking_events        | Unknown  | TBD         | Column description |
| last_tracking_update   | Unknown  | TBD         | Column description |
| notes                  | Unknown  | TBD         | Column description |
| created_at             | datetime | TBD         | Column description |
| updated_at             | datetime | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-order]]: one-to-many via foreign_key

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

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
