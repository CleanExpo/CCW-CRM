# Architecture Decision Records

UNI-1735 [H3] — Backfill ADRs for CCW Cowork ERP/CRM

This directory contains Architecture Decision Records (ADRs) in Nygard format documenting major architectural choices for the CCW Cowork ERP/CRM system.

## ADR Index

| ADR | Title | Status |
|-----|-------|--------|
| [0001](0001-three-layer-boardroom.md) | Adopt 3-Layer AI Boardroom Architecture | Accepted |
| [0002](0002-supabase-backend.md) | Use Supabase as Primary Backend | Accepted |
| [0003](0003-cron-6-hour-cycle.md) | 6-Hour CRON Execution Cycle | Accepted |
| [0004](0004-rls-security-model.md) | Row-Level Security as Primary Access Control | Accepted |
| [0005](0005-model-routing-policy.md) | Haiku/Sonnet/Opus Model Routing Policy | Accepted |
| [0006](0006-autonomous-execution.md) | Autonomous CRON with Approval Boundaries | Accepted |
| [0007](0007-au-privacy-compliance.md) | AU Privacy Act 2024 Compliance Strategy | Accepted |

## Format

Each ADR follows Nygard format:

```markdown
# ADR-NNNN: Title

## Status
Accepted | Deprecated | Superseded by ADR-XXXX

## Context
What is the issue motivating this decision?

## Decision
What is the change being proposed/accepted?

## Consequences
What becomes easier or harder as a result?
```

## Adding New ADRs

1. Copy the template from an existing ADR
2. Number sequentially (next: 0008)
3. Add to the index table above
4. Link from relevant code with `# See ADR-XXXX`
