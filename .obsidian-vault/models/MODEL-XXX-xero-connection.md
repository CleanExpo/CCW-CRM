---
type: 'model'
id: 'MODEL-XXX'
table: 'xero_connections'
file: 'apps/backend/src/db/xero_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: XeroConnection

## Overview

Store Xero OAuth2 connection details and tokens.

Each organization can have one active Xero connection. Tokens are encrypted
before storage and refreshed automatically when they expire.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `xero_connections`

**Columns**:

| Column          | Type   | Constraints | Description        |
| --------------- | ------ | ----------- | ------------------ |
| id              | Mapped | TBD         | Column description |
| organization_id | Mapped | TBD         | Column description |
| tenant_id       | Mapped | TBD         | Column description |
| tenant_name     | Mapped | TBD         | Column description |
| access_token    | Mapped | TBD         | Column description |
| refresh_token   | Mapped | TBD         | Column description |
| expires_at      | Mapped | TBD         | Column description |
| scopes          | Mapped | TBD         | Column description |
| is_active       | Mapped | TBD         | Column description |
| last_synced_at  | Mapped | TBD         | Column description |
| created_at      | Mapped | TBD         | Column description |
| updated_at      | Mapped | TBD         | Column description |

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
