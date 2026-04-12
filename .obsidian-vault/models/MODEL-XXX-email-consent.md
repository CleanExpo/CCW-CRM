---
type: 'model'
id: 'MODEL-XXX'
table: 'email_consents'
file: 'apps/backend/src/db/email_audit_models.py'
schema_locked: false
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: EmailConsent

## Overview

Track email consent per recipient for GDPR compliance.

Separate from EmailLog to provide a single source of truth for
current consent status per recipient.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `email_consents`

**Columns**:

| Column                   | Type   | Constraints | Description        |
| ------------------------ | ------ | ----------- | ------------------ |
| id                       | Mapped | TBD         | Column description |
| email                    | Mapped | TBD         | Column description |
| customer_id              | Mapped | TBD         | Column description |
| marketing_consent        | Mapped | TBD         | Column description |
| marketing_consent_at     | Mapped | TBD         | Column description |
| marketing_consent_source | Mapped | TBD         | Column description |
| notification_consent     | Mapped | TBD         | Column description |
| notification_consent_at  | Mapped | TBD         | Column description |
| unsubscribed             | Mapped | TBD         | Column description |
| unsubscribed_at          | Mapped | TBD         | Column description |
| unsubscribe_reason       | Mapped | TBD         | Column description |
| hard_bounced             | Mapped | TBD         | Column description |
| hard_bounced_at          | Mapped | TBD         | Column description |
| bounce_count             | Mapped | TBD         | Column description |
| spam_reported            | Mapped | TBD         | Column description |
| spam_reported_at         | Mapped | TBD         | Column description |
| created_at               | Mapped | TBD         | Column description |
| updated_at               | Mapped | TBD         | Column description |

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
