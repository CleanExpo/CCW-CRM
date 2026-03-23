---
type: 'model'
id: 'MODEL-XXX'
table: 'email_messages'
file: 'apps/backend/src/db/email_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: EmailMessage

## Overview

Individual email messages within conversations.

Stores both inbound (customer → us) and outbound (us → customer) messages.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `email_messages`

**Columns**:

| Column              | Type   | Constraints | Description        |
| ------------------- | ------ | ----------- | ------------------ |
| id                  | Mapped | TBD         | Column description |
| conversation_id     | Mapped | TBD         | Column description |
| message_id          | Mapped | TBD         | Column description |
| direction           | Mapped | TBD         | Column description |
| from_email          | Mapped | TBD         | Column description |
| from_name           | Mapped | TBD         | Column description |
| to_email            | Mapped | TBD         | Column description |
| to_name             | Mapped | TBD         | Column description |
| cc_emails           | Mapped | TBD         | Column description |
| bcc_emails          | Mapped | TBD         | Column description |
| subject             | Mapped | TBD         | Column description |
| body_text           | Mapped | TBD         | Column description |
| body_html           | Mapped | TBD         | Column description |
| attachments         | Mapped | TBD         | Column description |
| was_ai_generated    | Mapped | TBD         | Column description |
| ai_confidence       | Mapped | TBD         | Column description |
| ai_intent           | Mapped | TBD         | Column description |
| sendgrid_message_id | Mapped | TBD         | Column description |
| sendgrid_status     | Mapped | TBD         | Column description |
| sent_at             | Mapped | TBD         | Column description |
| delivered_at        | Mapped | TBD         | Column description |
| opened_at           | Mapped | TBD         | Column description |
| created_at          | Mapped | TBD         | Column description |

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
