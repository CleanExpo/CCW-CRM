---
type: 'model'
id: 'MODEL-XXX'
table: 'bank_accounts'
file: 'apps/backend/src/db/pos_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-location]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-bankfeed]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: BankAccount

## Overview

Bank accounts for each location with feed integration config.

Bank feed providers:

- xero: Xero bank feeds
- yodlee: Yodlee aggregation
- basiq: Basiq open banking
- manual: Manual CSV upload

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `bank_accounts`

**Columns**:

| Column              | Type   | Constraints | Description        |
| ------------------- | ------ | ----------- | ------------------ |
| id                  | Mapped | TBD         | Column description |
| account_name        | Mapped | TBD         | Column description |
| account_number      | Mapped | TBD         | Column description |
| bsb                 | Mapped | TBD         | Column description |
| bank_name           | Mapped | TBD         | Column description |
| location_code       | Mapped | TBD         | Column description |
| account_type        | Mapped | TBD         | Column description |
| currency            | Mapped | TBD         | Column description |
| feed_provider       | Mapped | TBD         | Column description |
| feed_account_id     | Mapped | TBD         | Column description |
| last_feed_sync_at   | Mapped | TBD         | Column description |
| feed_sync_status    | Mapped | TBD         | Column description |
| sync_interval_hours | Mapped | TBD         | Column description |
| webhook_enabled     | Mapped | TBD         | Column description |
| webhook_secret      | Mapped | TBD         | Column description |
| sync_retry_count    | Mapped | TBD         | Column description |
| last_sync_error     | Mapped | TBD         | Column description |
| is_active           | Mapped | TBD         | Column description |
| created_at          | Mapped | TBD         | Column description |
| updated_at          | Mapped | TBD         | Column description |
| location            | Mapped | TBD         | Column description |
| bank_feeds          | Mapped | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-location]]: one-to-many via foreign_key
- [[MODEL-XXX-bankfeed]]: one-to-many via foreign_key

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
- [[MODEL-XXX-bankfeed]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
