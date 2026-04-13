# Enhancement Program Orchestrator

**Trigger**: `/enhance` or when user asks to run the enhancement program
**Model**: Claude Opus 4.6 (adaptive thinking, effort: high)
**Role**: Master coordinator for the CCW-ERP research + enhancement cycle

---

## BEFORE YOU START

Read these files in order:

1. `CLAUDE.md` (root) — project rules and locked files
2. `.claude/ARCHITECTURE.md` — system overview
3. `docs/catalogs/ROUTES.md` — all API routes
4. `docs/catalogs/PAGES.md` — all frontend pages
5. `docs/catalogs/MODELS.md` — all data models
6. `docs/catalogs/AGENTS.md` — all AI agents
7. `.claude/memory/enhancement-program/decisions/audit-trail.md` — past decisions (skip anything already decided)
8. `.claude/memory/enhancement-program/status.md` — current cycle state

---

## INVARIANTS (never override)

- ALL work targets `ai-updates` branch — NEVER `main` or production
- NEVER modify: `demo_models.py`, `middleware.ts`, `demo_auth.py`
- Phill McGurk is final authority on all Round 3 board deadlocks
- AU locale: AUD, GST, ATO, DD/MM/YYYY, AEST/AEDT
- Sandbox only — CCW production is live with real customers

---

## PHASE 1: DISPATCH RESEARCHER SWARM

Update `.claude/memory/enhancement-program/status.md` Phase → "RESEARCH"

Dispatch ALL 16 researcher agents in parallel using the Agent tool.
Use `run_in_background: false` — you need results before proceeding.

For each researcher, provide:

- Their domain brief (see researcher agent definitions)
- The full catalog file contents (ROUTES.md, PAGES.md, MODELS.md)
- The audit trail (to skip already-decided findings)
- Instruction to write findings to their domain memory file

**Vertical researchers** (dispatch all in parallel):

1. Orders & Quotes → `.claude/agents/researchers/vertical/orders-quotes.md`
2. Products & Inventory → `.claude/agents/researchers/vertical/products-inventory.md`
3. Customers & CRM → `.claude/agents/researchers/vertical/customers-crm.md`
4. POS & Reconciliation → `.claude/agents/researchers/vertical/pos-reconciliation.md`
5. Purchasing & Suppliers → `.claude/agents/researchers/vertical/purchasing-suppliers.md`
6. Warehouse & Shipments → `.claude/agents/researchers/vertical/warehouse-shipments.md`
7. AI Agents & Intelligence → `.claude/agents/researchers/vertical/ai-agents.md`
8. Workshop & Service → `.claude/agents/researchers/vertical/workshop-service.md`
9. Settings & Security → `.claude/agents/researchers/vertical/settings-security.md`

**Horizontal researchers** (dispatch all in parallel with vertical): 10. Xero → `.claude/agents/researchers/horizontal/xero.md` 11. Cin7 → `.claude/agents/researchers/horizontal/cin7.md` 12. Shopify → `.claude/agents/researchers/horizontal/shopify.md` 13. Stripe → `.claude/agents/researchers/horizontal/stripe.md` 14. Shipping/Stock → `.claude/agents/researchers/horizontal/shipping-tbd.md`

As each researcher completes, update status.md:
`[HH:MM] 📝 [Domain] researcher: N findings written`

After all complete:
`[HH:MM] ✅ RESEARCH COMPLETE — N findings across 16 domains`

---

## PHASE 2: TRIAGE

Update status.md Phase → "TRIAGE"

Dispatch triage agent: `.claude/agents/triage-agent.md`

Provide:

- All research memory files (read and pass as context)
- Cross-platform opportunity map
- Scoring matrix (from spec)
- Instruction to write output to `.claude/memory/enhancement-program/triage/scored-findings.md`

After triage completes, log:
`[HH:MM] ✅ TRIAGE COMPLETE — CRITICAL:N HIGH:N MEDIUM:N LOW:N`

Route MEDIUM/LOW directly to Linear backlog (no board needed).
Route CRITICAL/HIGH to board queue.

---

## PHASE 3: BOARD DELIBERATION

Update status.md Phase → "BOARD"

Assemble batches:

- Trigger when 8+ findings score ≥ 50 accumulated
- OR any single finding scores ≥ 90

For each batch:

1. Log: `[HH:MM] 🎯 BATCH N SENT TO BOARD — N findings (avg score NN)`
2. Dispatch all 6 board members IN PARALLEL:
   - CEO → `.claude/agents/ceo-board-member.md`
   - CFO → `.claude/agents/cfo-board-member.md`
   - CMO → `.claude/agents/cmo-board-member.md`
   - COO → `.claude/agents/coo-board-member.md`
   - CSO → `.claude/agents/cso-board-member.md`
   - CTO → `.claude/agents/cto-board-member.md`
3. Collect verdicts. Log each as it arrives:
   `[HH:MM] [Member]: APPROVE/DEFER — "[reasoning]"`
4. Check consensus:
   - ALL APPROVE → proceed to Linear
   - ANY DEFER → Round 2 (debate)

**Round 2 — Debate:**
Provide dissenters' reasoning to all members. Re-dispatch.
Log: `[HH:MM] ⚡ DEBATE ROUND 2 — [members debating]`

**Round 3 — Escalate:**
If still not unanimous, present to Phill:

```
⚠️  DEADLOCK — Batch N, Finding: [title]
Sticking point: [one sentence]
FOR: [members + best argument]
AGAINST: [members + best argument]
Recommendation: [your recommendation]
Awaiting your decision.
```

Wait for response. Log decision to audit-trail.md.

After unanimous decision:
`[HH:MM] ✅ BATCH N UNANIMOUS — N issues → Linear [Sprint]`

Append to `.claude/memory/enhancement-program/board/deliberations.md`

---

## PHASE 4: LINEAR ISSUE CREATION

For each approved finding, create a Linear issue via MCP with:

```
Title: [Domain] [Action-oriented description]

Body:
## What's missing
[Finding description]

## Business impact
[Why this matters at $5-10M AU scale]
Triage score: NN/100

## Board decision
Unanimous — Round N — [date]
[Key reasoning from deliberation]

## Acceptance criteria
- [ ] [Testable requirement 1]
- [ ] [Testable requirement 2]
- [ ] AU compliance check (if applicable)

## Teams assigned
[Skill teams] · Effort: [estimate]

## Source
Researcher: [domain] · Finding #N
Audit: /decisions/audit-trail.md#[ref]
```

Sprint assignment:

- Score ≥ 75: Sprint 1 (until 10-day capacity)
- Score 50–74: Sprint 2 (or overflow from Sprint 1)
- Score < 50: Backlog

Log: `[HH:MM] 📋 LINEAR UPDATED — Sprint 1: N issues | Sprint 2: N issues | Backlog: N issues`

Append all decisions to audit-trail.md.

---

## PHASE 5: COMPLETION

Update status.md Phase → "COMPLETE"

Final summary to user:

```
✅ ENHANCEMENT CYCLE COMPLETE

Research: N findings across 16 domains
Triage: CRITICAL:N HIGH:N MEDIUM:N LOW:N
Board: N batches · N unanimous · N escalated to Phill
Linear: Sprint 1: N issues | Sprint 2: N issues | Backlog: N issues

Top 3 issues by score:
1. [title] — score NN — [sprint]
2. [title] — score NN — [sprint]
3. [title] — score NN — [sprint]

Next cycle: Weekly rescan triggers when new commits land in domain files.
```

---

## WEEKLY RESCAN MODE

When triggered by new commits (not a full cycle):

1. Identify which domains have new commits since last scan
2. Dispatch ONLY those domain researchers
3. Compare findings to audit-trail.md — skip anything already decided
4. Only convene board if batch threshold met (8+ findings ≥ 50, or any ≥ 90)
5. Silent if nothing new — do NOT ping user for low-signal updates
