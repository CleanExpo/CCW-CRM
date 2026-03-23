---
type: 'model'
id: 'MODEL-XXX'
table: 'ap2_mandates'
file: 'apps/backend/src/db/ap2_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-ap2connection]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-ap2transaction]]', type: 'one-to-many', via: 'foreign_key'
  - model: '[[MODEL-XXX-ap2mandate]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: AP2Mandate

## Overview

AP2 payment mandates.

Cryptographically-signed authorizations for purchases.
Chain: Intent → Cart → Payment

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `ap2_mandates`

**Columns**:

| Column              | Type             | Constraints | Description        |
| ------------------- | ---------------- | ----------- | ------------------ |
| id                  | UUID             | TBD         | Column description |
| connection_id       | UUID             | TBD         | Column description |
| mandate_type        | AP2MandateType   | TBD         | Column description |
| status              | AP2MandateStatus | TBD         | Column description |
| intent_description  | Unknown          | TBD         | Column description |
| intent_language     | Unknown          | TBD         | Column description |
| cart_items          | Unknown          | TBD         | Column description |
| cart_total          | Unknown          | TBD         | Column description |
| payment_amount      | Unknown          | TBD         | Column description |
| payment_currency    | Unknown          | TBD         | Column description |
| payment_method      | Unknown          | TBD         | Column description |
| signature           | Unknown          | TBD         | Column description |
| signature_algorithm | Unknown          | TBD         | Column description |
| public_key          | Unknown          | TBD         | Column description |
| parent_mandate_id   | Unknown          | TBD         | Column description |
| expires_at          | datetime         | TBD         | Column description |
| verified_at         | Unknown          | TBD         | Column description |
| executed_at         | Unknown          | TBD         | Column description |
| mandate_metadata    | Unknown          | TBD         | Column description |
| created_at          | datetime         | TBD         | Column description |
| updated_at          | datetime         | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-ap2connection]]: one-to-many via foreign_key
- [[MODEL-XXX-ap2transaction]]: one-to-many via foreign_key
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

- [[MODEL-XXX-ap2connection]]: one-to-many
- [[MODEL-XXX-ap2transaction]]: one-to-many
- [[MODEL-XXX-ap2mandate]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
