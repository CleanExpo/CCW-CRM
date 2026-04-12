---
type: 'model'
id: 'MODEL-XXX'
table: 'ap2_connections'
file: 'apps/backend/src/db/ap2_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-ap2mandate]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: AP2Connection

## Overview

AP2 OAuth connections and credentials.

Stores OAuth tokens and connection state for AP2 integration.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `ap2_connections`

**Columns**:

| Column               | Type                | Constraints | Description        |
| -------------------- | ------------------- | ----------- | ------------------ |
| id                   | UUID                | TBD         | Column description |
| user_id              | Unknown             | TBD         | Column description |
| organization_id      | Unknown             | TBD         | Column description |
| access_token         | Unknown             | TBD         | Column description |
| refresh_token        | Unknown             | TBD         | Column description |
| token_expires_at     | Unknown             | TBD         | Column description |
| status               | AP2ConnectionStatus | TBD         | Column description |
| google_account_id    | Unknown             | TBD         | Column description |
| google_account_email | Unknown             | TBD         | Column description |
| connected_at         | Unknown             | TBD         | Column description |
| last_used_at         | Unknown             | TBD         | Column description |
| created_at           | datetime            | TBD         | Column description |
| updated_at           | datetime            | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-ap2mandate]]: one-to-many via foreign_key

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

- [[MODEL-XXX-ap2mandate]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
