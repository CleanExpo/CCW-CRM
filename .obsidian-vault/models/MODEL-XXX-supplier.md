---
type: 'model'
id: 'MODEL-XXX'
table: 'suppliers'
file: 'apps/backend/src/db/inventory_models.py'
schema_locked: false
relationships:
  - model: '[[MODEL-XXX-purchaseorder]]', type: 'one-to-many', via: 'foreign_key'
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: Supplier

## Overview

Supplier/Vendor for purchasing inventory.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `suppliers`

**Columns**:

| Column            | Type     | Constraints | Description        |
| ----------------- | -------- | ----------- | ------------------ |
| id                | UUID     | TBD         | Column description |
| supplier_code     | str      | TBD         | Column description |
| company_name      | str      | TBD         | Column description |
| contact_name      | Unknown  | TBD         | Column description |
| email             | Unknown  | TBD         | Column description |
| phone             | Unknown  | TBD         | Column description |
| abn               | Unknown  | TBD         | Column description |
| address           | Unknown  | TBD         | Column description |
| city              | Unknown  | TBD         | Column description |
| state             | Unknown  | TBD         | Column description |
| postal_code       | Unknown  | TBD         | Column description |
| country           | str      | TBD         | Column description |
| payment_terms     | Unknown  | TBD         | Column description |
| preferred_carrier | Unknown  | TBD         | Column description |
| xero_contact_id   | Unknown  | TBD         | Column description |
| xero_synced_at    | Unknown  | TBD         | Column description |
| is_active         | bool     | TBD         | Column description |
| notes             | Unknown  | TBD         | Column description |
| created_at        | datetime | TBD         | Column description |
| updated_at        | datetime | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

- [[MODEL-XXX-purchaseorder]]: one-to-many via foreign_key

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

- [[MODEL-XXX-purchaseorder]]: one-to-many

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
