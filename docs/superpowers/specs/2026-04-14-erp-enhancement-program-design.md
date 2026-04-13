# CCW-ERP Enhancement Program — Design Spec

**Date**: 2026-04-14
**Status**: Approved
**Author**: Phill McGurk + Claude Sonnet 4.6
**Locale**: AU — AUD · GST · ATO · DD/MM/YYYY · AEST/AEDT

---

## Overview

A continuous, research-driven enhancement program for the CCW-Online ERP serving a $5–10M/year Australian equipment supplier business. Sixteen parallel researcher agents audit the full codebase and all external platform APIs (Xero, Cin7, Shopify, Stripe, and the shipping/stock ordering platform TBD). Findings are scored by a triage agent, deliberated to 100% unanimous consensus by the six-member board, then pushed as structured Linear issues to skill teams for execution. The orchestrator runs continuously in the background, surfacing only high-signal updates.

---

## Architecture

```
ORCHESTRATOR (Opus 4.6, adaptive thinking, effort: high)
  Coordinates swarm · Gates board · Routes work · Streams live progress

  ├── RESEARCH PHASE (parallel)
  │     16× Sonnet 4.6 researcher agents
  │     10 vertical (internal modules) + 6 horizontal (external platforms)
  │     Write to persistent memory store as findings land
  │
  ├── TRIAGE AGENT (Sonnet 4.6)
  │     Scores findings 0–100 across 4 dimensions
  │     Routes: CRITICAL/HIGH → board · MEDIUM/LOW → Linear backlog direct
  │
  ├── BOARD DELIBERATION (6 board members, parallel subagents)
  │     100% unanimous consensus required
  │     Up to 3 rounds before escalating deadlock to user
  │
  ├── LINEAR INTEGRATION
  │     Structured issues with acceptance criteria
  │     Auto-populated sprints by triage score
  │
  └── SKILL TEAMS (5 teams, Haiku 4.5 executors)
        Frontend · Backend · AI · Integration · Security & QA
```

---

## Research Domains

### Vertical (Internal — 10 agents)

| Domain                   | Key Modules                      | Researcher Focus                                     |
| ------------------------ | -------------------------------- | ---------------------------------------------------- |
| Orders & Quotes          | orders, quotes, invoices         | Flow completeness, AU payment terms, quote expiry    |
| Products & Inventory     | products, stock, categories      | SKU management, low-stock alerts, pricing tiers      |
| Customers & CRM          | customers, contacts, activities  | CRM completeness, AU ABN validation, portal UX       |
| POS & Reconciliation     | pos_transactions, bank_feeds     | Reconciliation accuracy, cash handling, GST          |
| Purchasing & Suppliers   | purchase_orders, suppliers       | 3-way match, GRN, supplier portal                    |
| Warehouse & Shipments    | warehouse, shipments, containers | Pick/pack, tracking, AU freight                      |
| AI Agents & Intelligence | src/ai/agents/, protocol/        | Agent coverage gaps, confidence, protocol compliance |
| Workshop & Service       | workshop, service_requests       | Job cards, certifications, equipment lifecycle       |
| Settings & Security      | settings, auth, RLS              | AU compliance, permission model, data integrity      |

### Horizontal (External platforms — 6 agents)

| Platform           | API Docs               | Focus                                                  |
| ------------------ | ---------------------- | ------------------------------------------------------ |
| Xero               | xero.com/au/developers | BAS, GST, payroll, bank feeds, purchase orders         |
| Cin7               | developer.cin7.com     | Inventory sync, webhooks, GRN, fulfilment, forecasting |
| Shopify            | shopify.dev            | Product sync, order flow, inventory, B2B               |
| Stripe             | stripe.com/docs        | Billing, AU payment methods, invoicing, webhooks       |
| Shipping/Stock TBD | TBD                    | Freight API, tracking, stock ordering automation       |

### Cross-Platform Opportunity Map

The triage agent maintains `/research/cross-platform/opportunity-map.md` — when a vertical and horizontal researcher both flag the same gap (e.g. Orders module missing Xero purchase order sync), the finding scores higher and is prioritised in the board batch.

---

## Triage Scoring

**Scale: 0–100 per finding**

| Dimension           | Max | Criteria                                                                       |
| ------------------- | --- | ------------------------------------------------------------------------------ |
| Revenue Impact      | 30  | Direct billing/payment flow (25–30) · Pipeline (15–24) · Ops efficiency (0–14) |
| Daily-Use Frequency | 25  | Multiple times/day (20–25) · Weekly (10–19) · Rare (0–9)                       |
| AU Compliance       | 25  | GST/ATO/BAS/payroll (20–25) · AU standards (10–19) · Best practice (0–9)       |
| Effort (inverse)    | 20  | < 1 day (16–20) · 1–3 days (10–15) · 1–2 weeks (4–9) · > 2 weeks (0–3)         |

**Routing:**

- Score ≥ 75: CRITICAL → board queue
- Score 50–74: HIGH → board queue
- Score 25–49: MEDIUM → Linear backlog (no board)
- Score < 25: LOW → Linear backlog (no board)

**Batch triggers:**

- 8+ findings score ≥ 50 (HIGH or CRITICAL) accumulated → board convened
- Any single finding scores ≥ 90 → board convened immediately

---

## Board Deliberation

**Members**: CEO · CFO · CMO · COO · CSO · CTO (existing `.claude/agents/` definitions)

**Requirement**: 100% unanimous consensus before any finding ships to Linear

**Process**:

```
ROUND 1 — All 6 deliberate in parallel
  All APPROVE → ships to Linear immediately
  Any DEFER/REJECT → Round 2

ROUND 2 — DEBATE
  Dissenters share full reasoning
  Approvers respond directly
  Each dissenter reconsiders with new context
  All APPROVE → ships with debate summary attached
  Any remaining → Round 3

ROUND 3 — ESCALATE TO USER
  Orchestrator presents:
    · The finding (one paragraph)
    · Exact sticking point (one sentence)
    · Both sides' best argument
    · Recommended resolution
  User makes final call — logged to audit trail
```

**Board member lenses**:

- CEO: Strategic direction, market position, priority alignment
- CFO: Revenue impact, billing accuracy, BAS/ATO compliance, cost of inaction
- CMO: Customer-facing quality, quote/portal UX, brand consistency
- COO: Daily ops, staff hours saved, cron reliability, integration uptime
- CSO: RLS, auth boundaries, AU privacy, data integrity, security risk
- CTO: Architecture soundness, test coverage, effort accuracy, tech debt

---

## Linear Structure

**Project**: CCW-ERP Enhancement Program

**Epics** (one per domain, 10 vertical + 1 per integration platform)

**Sprints** (2-week cycles):

- Sprint capacity: 10 person-days
- Sprint 1: CRITICAL items by triage score until capacity
- Sprint 2: Remaining CRITICAL + top HIGH items
- Backlog: MEDIUM/LOW ordered by score

**Issue template**:

```
TITLE:   [Domain] Action-oriented description

## What's missing
[Researcher finding — clear gap description]

## Business impact
[Why this matters at $5-10M AU scale]
Triage score: XX/100

## Board decision
Unanimous — [Round N] — [date]
[Key reasoning from deliberation]

## Acceptance criteria
- [ ] Testable requirement 1
- [ ] Testable requirement 2
- [ ] AU compliance check if applicable

## Teams assigned
[Skill teams] · Effort: [estimate]

## Source
Researcher: [domain] · Finding #N
Audit: /decisions/audit-trail.md#[ref]
```

**Labels**: xero · cin7 · shopify · stripe · au-compliance · gst · ato ·
frontend · backend · ai · integration · security · ux · critical · high

---

## Skill Teams

All teams use the existing worktree + subagent-driven-development workflow. Issues pulled from Linear → isolated branch → two-stage review → PR to `ai-updates`.

| Team          | Lead Model | Executor Model | Owns                               |
| ------------- | ---------- | -------------- | ---------------------------------- |
| Frontend      | Sonnet 4.6 | Haiku 4.5      | apps/web/\*\*                      |
| Backend       | Sonnet 4.6 | Haiku 4.5      | apps/backend/src/api/ + src/db/    |
| AI            | Sonnet 4.6 | Haiku 4.5      | apps/backend/src/ai/\*\*           |
| Integration   | Sonnet 4.6 | Haiku 4.5      | apps/backend/src/integrations/\*\* |
| Security & QA | Opus 4.6   | Sonnet 4.6     | Cross-cutting — reviews all PRs    |

**Locked files** (never touched by any team):

- `apps/backend/src/db/demo_models.py`
- `apps/web/middleware.ts`
- `apps/backend/src/api/routes/demo_auth.py`

---

## Visibility Layer

The orchestrator writes live progress to `.claude/memory/enhancement-program-status.md` and streams to terminal. Every significant event is visible:

```
[HH:MM] 🔍 RESEARCH STARTED — N agents dispatched
[HH:MM] 📝 [Domain] researcher: N findings written
[HH:MM] ✅ RESEARCH COMPLETE — N findings total
[HH:MM] ⚖️  TRIAGE RUNNING — scoring N findings
[HH:MM] ✅ TRIAGE COMPLETE — CRITICAL:N HIGH:N MEDIUM:N LOW:N
[HH:MM] 🎯 BATCH N SENT TO BOARD — N findings (avg score NN)
[HH:MM] [Member]: APPROVE/DEFER — "[one-line reasoning]"
[HH:MM] ⚡ DEBATE ROUND 2 — [members in debate]
[HH:MM] ✅ BATCH N UNANIMOUS — N issues → Linear [Sprint]
[HH:MM] 📋 LINEAR UPDATED — [Sprint]: N issues created
```

---

## Orchestrator Design

**Model**: Claude Opus 4.6
**Thinking**: Adaptive, `effort: high`
**Tools**: Read, Glob, Grep, Bash, Write, Agent (subagent dispatch), Linear MCP, WebFetch, WebSearch

**Startup sequence**:

1. Read ARCHITECTURE.md, all catalog files (ROUTES.md, PAGES.md, MODELS.md, AGENTS.md), PROGRESS.md
2. Read `/decisions/audit-trail.md` — skip any finding already decided
3. Dispatch 16 researcher subagents with domain-specific briefs
4. Open live status stream

**Invariants** (hardcoded, never overridden):

- All work targets `ai-updates` branch — never `main` or production
- Locked files are never modified
- Phill McGurk is final authority on all Round 3 deadlocks
- AU locale throughout: AUD, GST, ATO, DD/MM/YYYY, AEST/AEDT

**Weekly rescan** (continuous background):

- Rescans only domains where new commits have landed since last scan
- Compares findings against `/decisions/audit-trail.md` — no re-raising past decisions
- Convenes board only when batch threshold met
- Silent otherwise

---

## Memory Store Structure

```
.claude/memory/enhancement-program/
  status.md                    — live progress feed (orchestrator writes)

/research/
  orders-quotes.md
  products-inventory.md
  customers-crm.md
  pos-reconciliation.md
  purchasing-suppliers.md
  warehouse-shipments.md
  ai-agents.md
  workshop-service.md
  settings-security.md
  integrations-xero.md
  integrations-cin7.md
  integrations-shopify.md
  integrations-stripe.md
  integrations-shipping-tbd.md
  cross-platform/
    opportunity-map.md

/triage/
  scored-findings.md

/board/
  deliberations.md

/decisions/
  audit-trail.md               — append-only, all decisions + reasoning
```

---

## Implementation Phases

| Phase | What                                                                                               | Days |
| ----- | -------------------------------------------------------------------------------------------------- | ---- |
| 1     | Orchestrator agent, memory store structure, live status streaming, audit trail format              | 2    |
| 2     | 16 researcher agent definitions, domain briefing templates, memory write protocol, Linear MCP read | 2    |
| 3     | Triage scoring agent, board deliberation loop (3 rounds), Linear MCP write, sprint auto-population | 1    |
| 4     | 5 skill team definitions, weekly rescan scheduler, progress feed polish, end-to-end smoke test     | 2    |

**Total: ~7 days before first research cycle runs**

---

## Success Criteria

- [ ] 16 researcher agents run in parallel and write findings to memory store within 30 min
- [ ] Triage agent correctly scores and routes all findings
- [ ] Board reaches 100% consensus on all batches (with debate where needed)
- [ ] Round 3 escalations present tight, actionable briefs to Phill
- [ ] Linear issues created with full template (title, impact, criteria, team, source)
- [ ] Sprint 1 auto-populated with top CRITICAL items
- [ ] Skill teams can pull and execute a Linear issue end-to-end
- [ ] Weekly rescan runs silently, only surfacing net-new findings
- [ ] Live progress visible throughout — no black boxes
- [ ] All work stays on `ai-updates` — production untouched

---

## Open Items

1. **Shipping/stock ordering platform name** — TBD (user to confirm). Starshipit or Shippit most likely. Researcher agent briefed as TBD pending confirmation.
2. **Linear team ID** — needed for MCP issue creation. Pull from existing Linear MCP config.
3. **Board agent model** — currently Opus 4.6 for CEO/CTO, Sonnet 4.6 for others per existing definitions. Confirm before implementation.
