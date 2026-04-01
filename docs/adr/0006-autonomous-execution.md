# ADR-0006: Autonomous CRON with Approval Boundaries

## Status
Accepted

## Context
Layer 3 (Claude Code) executes autonomously during CRON cycles, potentially making database writes, API calls, publishing content, and modifying code. Without governance boundaries, an AI agent could execute destructive operations without human oversight.

## Decision
Implement a deny-by-default approval gate system (`scripts/lib/approval-gate.js`) that:

- AUTO_APPROVE: Safe read/log operations only (database:read, log:write, cache:invalidate, report:generate)
- ALWAYS_REQUIRE: All destructive/irreversible operations (database:migrate, database:delete, payment:process, video:publish, deploy:production, user:delete)
- CONDITIONAL: Threshold-based rules (database:write max 100 rows, email:send max 10 recipients, slack:send channel whitelist)
- DENY by default: Unknown operations require approval

All approval requests persisted to `.approvals/` as JSON. All approve/deny events logged via audit-logger.

## Consequences

**Easier**:
- No accidental destructive operations during autonomous execution
- Clear audit trail of what was approved/denied and by whom
- Configurable thresholds without code changes

**Harder**:
- Approval requests require human review (adds latency)
- Over-restrictive rules slow legitimate automation
- Approval persistence in `.approvals/` must be gitignored
