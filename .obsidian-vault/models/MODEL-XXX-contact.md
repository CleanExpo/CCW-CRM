---
type: 'model'
id: 'MODEL-XXX'
table: 'contacts'
file: 'apps/backend/src/db/crm_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-customer]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-activity]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Contact

## Overview

Contact model for CRM.

Represents individual contacts that can be associated with a customer (company).
Supports multiple contacts per customer.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `contacts`

**Columns**:

| Column      | Type     | Constraints | Description        |
| ----------- | -------- | ----------- | ------------------ |
| id          | UUID     | TBD         | Column description |
| customer_id | Unknown  | TBD         | Column description |
| first_name  | str      | TBD         | Column description |
| last_name   | str      | TBD         | Column description |
| email       | Unknown  | TBD         | Column description |
| phone       | Unknown  | TBD         | Column description |
| mobile      | Unknown  | TBD         | Column description |
| job_title   | Unknown  | TBD         | Column description |
| department  | Unknown  | TBD         | Column description |
| is_primary  | bool     | TBD         | Column description |
| is_active   | bool     | TBD         | Column description |
| notes       | Unknown  | TBD         | Column description |
| created_at  | datetime | TBD         | Column description |
| updated_at  | datetime | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-customer]]: one-to-many via foreign_key
- [[MODEL-XXX-activity]]: one-to-many via foreign_key

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
- [[MODEL-XXX-activity]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
