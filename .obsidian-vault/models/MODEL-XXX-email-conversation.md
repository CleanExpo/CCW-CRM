---
type: 'model'
id: 'MODEL-XXX'
table: 'email_conversations'
file: 'apps/backend/src/db/email_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: EmailConversation

## Overview

Track email conversations with customers.

Groups related emails into threads for better context and history tracking.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `email_conversations`

**Columns**:

| Column              | Type   | Constraints | Description        |
| ------------------- | ------ | ----------- | ------------------ |
| id                  | Mapped | TBD         | Column description |
| thread_id           | Mapped | TBD         | Column description |
| subject             | Mapped | TBD         | Column description |
| customer_email      | Mapped | TBD         | Column description |
| customer_name       | Mapped | TBD         | Column description |
| customer_id         | Mapped | TBD         | Column description |
| status              | Mapped | TBD         | Column description |
| intent              | Mapped | TBD         | Column description |
| confidence_score    | Mapped | TBD         | Column description |
| assigned_to         | Mapped | TBD         | Column description |
| related_order_ids   | Mapped | TBD         | Column description |
| related_product_ids | Mapped | TBD         | Column description |
| related_quote_ids   | Mapped | TBD         | Column description |
| message_count       | Mapped | TBD         | Column description |
| first_message_at    | Mapped | TBD         | Column description |
| last_message_at     | Mapped | TBD         | Column description |
| created_at          | Mapped | TBD         | Column description |
| updated_at          | Mapped | TBD         | Column description |

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
