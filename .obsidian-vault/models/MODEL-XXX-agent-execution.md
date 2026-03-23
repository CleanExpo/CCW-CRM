---
type: 'model'
id: 'MODEL-XXX'
table: 'agent_executions'
file: 'apps/backend/src/db/demo_models.py'
schema_locked: true
relationships: []
links: []
last_verified: '2026-03-23'
---

# MODEL-XXX: AgentExecution

## Overview

Audit trail for AI agent executions.

<!-- AUTO-GENERATED -->

## Database Schema

**Table Name**: `agent_executions`

**Columns**:

| Column              | Type     | Constraints | Description        |
| ------------------- | -------- | ----------- | ------------------ |
| id                  | UUID     | TBD         | Column description |
| agent_id            | str      | TBD         | Column description |
| agent_name          | str      | TBD         | Column description |
| task                | str      | TBD         | Column description |
| context_snapshot    | Unknown  | TBD         | Column description |
| status              | str      | TBD         | Column description |
| result              | Unknown  | TBD         | Column description |
| error               | Unknown  | TBD         | Column description |
| execution_time_ms   | Unknown  | TBD         | Column description |
| tokens_used         | Unknown  | TBD         | Column description |
| estimated_cost_usd  | Unknown  | TBD         | Column description |
| initiated_by        | str      | TBD         | Column description |
| parent_execution_id | Unknown  | TBD         | Column description |
| user_id             | Unknown  | TBD         | Column description |
| created_at          | datetime | TBD         | Column description |
| completed_at        | Unknown  | TBD         | Column description |

**Indexes**: See code

**Foreign Keys**: See code

## Relationships

No relationships defined

## Used By Routes

See code for route usage

<!-- END AUTO-GENERATED -->

<!-- HUMAN-CURATED -->

## Schema Notes

⚠️ **Schema Locked**: This is a production table. Modifying this schema requires:

1. Explicit approval from project owner
2. Migration plan with rollback strategy
3. Data backfill plan for existing records
4. Testing in staging environment

**DO NOT MODIFY WITHOUT APPROVAL.**

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
