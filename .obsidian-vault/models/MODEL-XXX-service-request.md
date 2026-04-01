---
type: 'model'
id: 'MODEL-XXX'
table: 'service_requests'
file: 'apps/backend/src/db/service_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-customer]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-order]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: ServiceRequest

## Overview

Service requests for workshop and field service.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `service_requests`

**Columns**:

| Column                | Type     | Constraints | Description        |
| --------------------- | -------- | ----------- | ------------------ |
| id                    | UUID     | TBD         | Column description |
| customer_id           | UUID     | TBD         | Column description |
| order_id              | Unknown  | TBD         | Column description |
| request_type          | str      | TBD         | Column description |
| status                | str      | TBD         | Column description |
| equipment_description | str      | TBD         | Column description |
| issue_description     | str      | TBD         | Column description |
| photos                | Unknown  | TBD         | Column description |
| assigned_technician   | Unknown  | TBD         | Column description |
| scheduled_date        | Unknown  | TBD         | Column description |
| quote_amount          | Unknown  | TBD         | Column description |
| approved_amount       | Unknown  | TBD         | Column description |
| created_at            | datetime | TBD         | Column description |
| updated_at            | datetime | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-customer]]: one-to-many via foreign_key
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

- [[MODEL-XXX-customer]]: one-to-many
- [[MODEL-XXX-order]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
