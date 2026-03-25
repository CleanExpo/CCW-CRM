---
type: 'model'
id: 'MODEL-XXX'
table: 'shopify_webhook_logs'
file: 'apps/backend/src/db/shopify_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: ShopifyWebhookLog

## Overview

Log of received Shopify webhooks for debugging and replay.

Stores webhook payloads for audit trail and error recovery.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `shopify_webhook_logs`

**Columns**:

| Column             | Type   | Constraints | Description        |
| ------------------ | ------ | ----------- | ------------------ |
| id                 | Mapped | TBD         | Column description |
| topic              | Mapped | TBD         | Column description |
| shopify_webhook_id | Mapped | TBD         | Column description |
| shop_domain        | Mapped | TBD         | Column description |
| payload            | Mapped | TBD         | Column description |
| headers            | Mapped | TBD         | Column description |
| processed          | Mapped | TBD         | Column description |
| processed_at       | Mapped | TBD         | Column description |
| processing_error   | Mapped | TBD         | Column description |
| received_at        | Mapped | TBD         | Column description |

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
