# Enhancement Program — Phase 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the memory store directory structure, the master orchestrator skill, and the live status streaming mechanism that all subsequent phases depend on.

**Architecture:** A SKILL.md file at `.claude/skills/enhancement-program/SKILL.md` acts as the orchestrator — it instructs Claude exactly how to run the full enhancement program using the Agent tool to dispatch subagents. Memory store files under `.claude/memory/enhancement-program/` provide persistent state across sessions.

**Tech Stack:** Claude Code skills (Markdown), Agent tool for subagent dispatch, structlog-style status updates written to `.claude/memory/enhancement-program/status.md`

---

## File Map

| Action | Path                                                                   | Purpose                     |
| ------ | ---------------------------------------------------------------------- | --------------------------- |
| Create | `.claude/memory/enhancement-program/status.md`                         | Live progress feed          |
| Create | `.claude/memory/enhancement-program/decisions/audit-trail.md`          | Append-only decision log    |
| Create | `.claude/memory/enhancement-program/triage/scored-findings.md`         | Triage agent output         |
| Create | `.claude/memory/enhancement-program/board/deliberations.md`            | Board deliberation log      |
| Create | `.claude/memory/enhancement-program/research/.gitkeep`                 | Research domain placeholder |
| Create | `.claude/memory/enhancement-program/cross-platform/opportunity-map.md` | Cross-platform gaps         |
| Create | `.claude/skills/enhancement-program/SKILL.md`                          | Master orchestrator skill   |

---

### Task 1: Memory Store Directory Structure

**Files:**

- Create: `.claude/memory/enhancement-program/status.md`
- Create: `.claude/memory/enhancement-program/decisions/audit-trail.md`
- Create: `.claude/memory/enhancement-program/triage/scored-findings.md`
- Create: `.claude/memory/enhancement-program/board/deliberations.md`
- Create: `.claude/memory/enhancement-program/cross-platform/opportunity-map.md`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p ".claude/memory/enhancement-program/decisions"
mkdir -p ".claude/memory/enhancement-program/triage"
mkdir -p ".claude/memory/enhancement-program/board"
mkdir -p ".claude/memory/enhancement-program/research"
mkdir -p ".claude/memory/enhancement-program/cross-platform"
```

Expected: No output, directories created.

- [ ] **Step 2: Create status.md (live progress feed)**

Create `.claude/memory/enhancement-program/status.md`:

```markdown
# Enhancement Program — Live Status

**Last Updated**: —
**Cycle**: —
**Phase**: Not started

## Current Activity

Awaiting orchestrator start.

## Research Progress

| Domain                   | Status     | Findings |
| ------------------------ | ---------- | -------- |
| Orders & Quotes          | ⏳ Pending | —        |
| Products & Inventory     | ⏳ Pending | —        |
| Customers & CRM          | ⏳ Pending | —        |
| POS & Reconciliation     | ⏳ Pending | —        |
| Purchasing & Suppliers   | ⏳ Pending | —        |
| Warehouse & Shipments    | ⏳ Pending | —        |
| AI Agents & Intelligence | ⏳ Pending | —        |
| Workshop & Service       | ⏳ Pending | —        |
| Settings & Security      | ⏳ Pending | —        |
| Xero                     | ⏳ Pending | —        |
| Cin7                     | ⏳ Pending | —        |
| Shopify                  | ⏳ Pending | —        |
| Stripe                   | ⏳ Pending | —        |
| Shipping/Stock (TBD)     | ⏳ Pending | —        |

## Triage Summary

CRITICAL: 0 | HIGH: 0 | MEDIUM: 0 | LOW: 0

## Board Batches

No batches processed yet.

## Linear Issues Created

Sprint 1: 0 | Sprint 2: 0 | Backlog: 0
```

- [ ] **Step 3: Create audit-trail.md**

Create `.claude/memory/enhancement-program/decisions/audit-trail.md`:

```markdown
# Enhancement Program — Audit Trail

Append-only. Each entry records a board decision, user override, or triage routing decision.
Format: `## [YYYY-MM-DD HH:MM] [type] — [title]`

---

<!-- Entries appended below by orchestrator and board agents -->
```

- [ ] **Step 4: Create scored-findings.md**

Create `.claude/memory/enhancement-program/triage/scored-findings.md`:

```markdown
# Triage — Scored Findings

**Last scored**: —
**Total findings**: 0

## CRITICAL (≥75)

_None yet_

## HIGH (50–74)

_None yet_

## MEDIUM (25–49)

_None yet_

## LOW (<25)

_None yet_
```

- [ ] **Step 5: Create deliberations.md**

Create `.claude/memory/enhancement-program/board/deliberations.md`:

```markdown
# Board Deliberations Log

**Format per batch:**

## Batch N — [date] — [verdict]

### Finding: [title] (score: NN)

CEO: [APPROVE/DEFER] — "[reasoning]"
CFO: [APPROVE/DEFER] — "[reasoning]"
CMO: [APPROVE/DEFER] — "[reasoning]"
COO: [APPROVE/DEFER] — "[reasoning]"
CSO: [APPROVE/DEFER] — "[reasoning]"
CTO: [APPROVE/DEFER] — "[reasoning]"
Round: N | Decision: UNANIMOUS / ESCALATED

---
```

- [ ] **Step 6: Create opportunity-map.md**

Create `.claude/memory/enhancement-program/cross-platform/opportunity-map.md`:

```markdown
# Cross-Platform Opportunity Map

Maintained by triage agent. Maps internal vertical gaps to external platform gaps.
When both a vertical and horizontal researcher flag the same gap, triage scores it +10.

## Active Opportunities

_None identified yet — populate after first research cycle_

## Format

### [Opportunity Title]

- **Vertical gap**: [internal module + finding ref]
- **Horizontal gap**: [platform + finding ref]
- **Score boost**: +10 applied
- **Combined score**: NN/100
```

- [ ] **Step 7: Commit**

```bash
git add .claude/memory/enhancement-program/
git commit -m "chore(enhancement): create memory store directory structure — Phase 1"
```

Expected: 6 files added, commit created.

---

### Task 2: Master Orchestrator Skill

**Files:**

- Create: `.claude/skills/enhancement-program/SKILL.md`

- [ ] **Step 1: Create skill directory**

```bash
mkdir -p ".claude/skills/enhancement-program"
```

- [ ] **Step 2: Write SKILL.md**

Create `.claude/skills/enhancement-program/SKILL.md`:

````markdown
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
````

- [ ] **Step 3: Verify skill file is valid markdown**

```bash
# Check file exists and has content
wc -l ".claude/skills/enhancement-program/SKILL.md"
```

Expected: Line count > 100

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/enhancement-program/
git commit -m "feat(enhancement): add master orchestrator skill — Phase 1"
```

---

### Task 3: Smoke Test — Foundation

**Goal**: Verify the memory store structure is correct and the skill file is readable.

- [ ] **Step 1: Verify all memory files exist**

```bash
find ".claude/memory/enhancement-program" -type f | sort
```

Expected output:

```
.claude/memory/enhancement-program/board/deliberations.md
.claude/memory/enhancement-program/cross-platform/opportunity-map.md
.claude/memory/enhancement-program/decisions/audit-trail.md
.claude/memory/enhancement-program/research/.gitkeep
.claude/memory/enhancement-program/status.md
.claude/memory/enhancement-program/triage/scored-findings.md
```

- [ ] **Step 2: Verify skill file loads**

```bash
head -5 ".claude/skills/enhancement-program/SKILL.md"
```

Expected:

```
# Enhancement Program Orchestrator
```

- [ ] **Step 3: Verify status.md has all 14 domains listed**

```bash
grep -c "Pending" ".claude/memory/enhancement-program/status.md"
```

Expected: `14`

- [ ] **Step 4: Verify audit trail is append-only (has comment marker)**

```bash
grep "Entries appended" ".claude/memory/enhancement-program/decisions/audit-trail.md"
```

Expected: Returns the comment line.

- [ ] **Step 5: Final commit**

```bash
git add .
git status
git commit -m "test(enhancement): Phase 1 foundation smoke test passing — all memory files verified"
```

---

**Phase 1 complete when:** All memory files exist, skill file loads, smoke tests pass.
**Next:** Phase 2 — Researcher Swarm
