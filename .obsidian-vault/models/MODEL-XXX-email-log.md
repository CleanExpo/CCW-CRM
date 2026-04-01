---
type: 'model'
id: 'MODEL-XXX'
table: 'email_logs'
file: 'apps/backend/src/db/email_audit_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: EmailLog

## Overview

Comprehensive email audit log for GDPR compliance.

Every email sent by the system is logged here with:

- Full content archival for GDPR data export
- Delivery tracking via SendGrid webhooks
- Consent tracking for marketing emails
- Metadata for customer support queries

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `email_logs`

**Columns**:

| Column              | Type   | Constraints | Description        |
| ------------------- | ------ | ----------- | ------------------ |
| id                  | Mapped | TBD         | Column description |
| recipient_email     | Mapped | TBD         | Column description |
| recipient_name      | Mapped | TBD         | Column description |
| from_email          | Mapped | TBD         | Column description |
| from_name           | Mapped | TBD         | Column description |
| reply_to            | Mapped | TBD         | Column description |
| subject             | Mapped | TBD         | Column description |
| html_content        | Mapped | TBD         | Column description |
| text_content        | Mapped | TBD         | Column description |
| template_id         | Mapped | TBD         | Column description |
| sendgrid_message_id | Mapped | TBD         | Column description |
| status              | Mapped | TBD         | Column description |
| error_message       | Mapped | TBD         | Column description |
| error_code          | Mapped | TBD         | Column description |
| sent_at             | Mapped | TBD         | Column description |
| delivered_at        | Mapped | TBD         | Column description |
| opened_at           | Mapped | TBD         | Column description |
| open_count          | Mapped | TBD         | Column description |
| clicked_at          | Mapped | TBD         | Column description |
| click_count         | Mapped | TBD         | Column description |
| bounced_at          | Mapped | TBD         | Column description |
| unsubscribed_at     | Mapped | TBD         | Column description |
| spam_reported_at    | Mapped | TBD         | Column description |
| purpose             | Mapped | TBD         | Column description |
| consent_given       | Mapped | TBD         | Column description |
| consent_timestamp   | Mapped | TBD         | Column description |
| consent_source      | Mapped | TBD         | Column description |
| content_purged      | Mapped | TBD         | Column description |
| purged_at           | Mapped | TBD         | Column description |
| user_id             | Mapped | TBD         | Column description |
| customer_id         | Mapped | TBD         | Column description |
| organization_id     | Mapped | TBD         | Column description |
| related_entity_type | Mapped | TBD         | Column description |
| related_entity_id   | Mapped | TBD         | Column description |
| ip_address          | Mapped | TBD         | Column description |
| user_agent          | Mapped | TBD         | Column description |
| extra_metadata      | Mapped | TBD         | Column description |
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
