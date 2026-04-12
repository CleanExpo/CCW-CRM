# ADR-0005: Haiku/Sonnet/Opus Model Routing Policy

## Status

Accepted

## Context

Running all AI operations on Claude Opus would cost ~10x more than a tiered approach. With 13 board members, 4 daily CRON cycles, and multiple specialist tasks, model cost management is critical for sustainability.

## Decision

Implement a 3-tier model routing policy (`scripts/lib/model-router.js`):

- **Haiku**: Research/logging/formatting tasks (95% cheaper than Opus)
  - Agents: Witness, CHRO, review-infrastructure, review-performance
  - Tasks: research, search, logging, summary, formatting

- **Sonnet**: Analysis/deliberation/code generation (80% cheaper than Opus)
  - Agents: CFO, CMO, COO, CLO, VP-Sales, VP-CX, VP-Product, Data-Scientist, review-database, review-code-quality, review-test-coverage, pr-manager
  - Tasks: code generation, analysis, planning, reporting

- **Opus**: Architecture decisions, security reviews, final approvals (most capable)
  - Agents: CEO, CTO, Security-Architect, review-orchestrator, review-security
  - Tasks: architecture, security-review, production-deploy, critical-decision

Projected savings: ~69% vs. all-Opus approach.

## Consequences

**Easier**:

- Sustainable cost profile for 24/7 autonomous operation
- Explicit model choice documented per agent and task
- Easy to adjust routing based on quality/cost tradeoffs

**Harder**:

- Haiku may miss nuances that Sonnet/Opus would catch
- Routing logic must be maintained as models evolve
- Agent-level overrides can complicate debugging
