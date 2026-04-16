# ADR-0003: 6-Hour CRON Execution Cycle

## Status

Accepted

## Context

The CCW boardroom needed a cadence for autonomous intelligence gathering and decision support that was frequent enough to be actionable but infrequent enough to manage API costs and avoid information overload.

## Decision

Run the boardroom CRON cycle every 6 hours (4x daily: 6am, 12pm, 6pm, 12am AEST), with a full 13-step session sequence including intelligence gathering, board deliberation, decision logging, and video production.

Special cycles: Weekly comprehensive security audit (Monday), fortnightly CLAUDE.md governance audit.

## Consequences

**Easier**:

- Predictable cost profile (4 sessions/day)
- Decision cadence aligns with business operations
- Sufficient time for external API calls (Perplexity, Cin7, etc.)

**Harder**:

- 6-hour delay means time-sensitive information may be stale
- Session crash recovery must handle mid-cycle failures
- Model costs at 4x daily require careful model routing (haiku/sonnet/opus)
