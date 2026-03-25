---
type: model
id: MODEL-{{MODEL_NUMBER}}
table: { { TABLE_NAME } }
file: apps/backend/src/db/{{FILE_NAME}}_models.py
schema_locked: true|false
relationships:
  - model: '[[MODEL-NNN]]'
    type: one-to-many|many-to-one|many-to-many
    via: foreign_key_name
links:
  - '[[ROUTE-NNN]]'
last_verified: { { DATE } }
---

# MODEL-{{MODEL_NUMBER}}: {{MODEL_NAME}}

## Overview

{{DESCRIPTION}}

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `{{TABLE_NAME}}`

**Columns**:

| Column     | Type        | Constraints  | Description     |
| ---------- | ----------- | ------------ | --------------- |
| id         | UUID        | PK, NOT NULL | Primary key     |
| created_at | DateTime    | NOT NULL     | Timestamp (UTC) |
| updated_at | DateTime    | NOT NULL     | Timestamp (UTC) |
| field1     | String(255) | NOT NULL     | Description     |
| field2     | Integer     | NULL         | Description     |
| field3     | Text        | NULL         | Description     |

**Indexes**:

- `ix_{{TABLE_NAME}}_field1` (field1)
- `ix_{{TABLE_NAME}}_field2_field3` (field2, field3)

**Foreign Keys**:

- `{{TABLE_NAME}}_parent_id_fkey`: parent_id → parent_table(id)

## Relationships

### One-to-Many

- [[MODEL-NNN]]: `{{MODEL_NAME}}` has many `RelatedModel` via `foreign_key`

### Many-to-One

- [[MODEL-NNN]]: `{{MODEL_NAME}}` belongs to `ParentModel` via `parent_id`

### Many-to-Many

- [[MODEL-NNN]]: `{{MODEL_NAME}}` ↔ `AssociatedModel` via `association_table`

## Enums (if any)

**EnumName**:

- VALUE_1: Description
- VALUE_2: Description
- VALUE_3: Description

## Used By Routes

- [[ROUTE-NNN]]: `GET /api/endpoint` - Lists records
- [[ROUTE-NNN]]: `POST /api/endpoint` - Creates records
- [[ROUTE-NNN]]: `PUT /api/endpoint/{id}` - Updates records
- [[ROUTE-NNN]]: `DELETE /api/endpoint/{id}` - Deletes records

<!-- END AUTO-GENERATED -->

<!-- HUMAN-CURATED -->

## Schema Notes

⚠️ **Schema Locked**: {{LOCKED_REASON}}

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

- **Cin7**: Mapped via `Cin7{{MODEL_NAME}}Mapping` table
- **Xero**: Synced via webhook
- **Shopify**: Product sync

## Sample Queries

```python
# Get all records with eager loading
records = await db.execute(
    select({{MODEL_NAME}})
    .options(selectinload({{MODEL_NAME}}.related))
    .where({{MODEL_NAME}}.status == "active")
)

# Create new record
new_record = {{MODEL_NAME}}(
    field1="value",
    field2=123
)
db.add(new_record)
await db.commit()
```

## Related Models

- [[MODEL-NNN]]: Parent model
- [[MODEL-NNN]]: Child model
- [[MODEL-NNN]]: Associated model

## Change History

| Date     | Change  | Author         |
| -------- | ------- | -------------- |
| {{DATE}} | Created | Auto-generated |
