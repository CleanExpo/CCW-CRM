# Enhancement Program — Phase 3: Triage + Board + Linear

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the triage scoring agent, update the six board member agents with enhancement deliberation instructions, and create the Linear issue creation skill.

**Architecture:** Triage agent reads all research memory files and outputs a scored-findings.md. Board member agents are updated with a new "Enhancement Deliberation Mode" section. A Linear skill handles structured issue creation via the Linear MCP.

**Tech Stack:** Claude Code agent definitions (Markdown), Linear MCP (`mcp__2f101dc2-*` tools), existing board member agent files

---

## File Map

| Action | Path                                           | Purpose                     |
| ------ | ---------------------------------------------- | --------------------------- |
| Create | `.claude/agents/triage-agent.md`               | Triage scoring agent        |
| Modify | `.claude/agents/ceo-board-member.md`           | Add deliberation mode       |
| Modify | `.claude/agents/cfo-board-member.md`           | Add deliberation mode       |
| Modify | `.claude/agents/cmo-board-member.md`           | Add deliberation mode       |
| Modify | `.claude/agents/coo-board-member.md`           | Add deliberation mode       |
| Modify | `.claude/agents/cso-board-member.md`           | Add deliberation mode       |
| Modify | `.claude/agents/cto-board-member.md`           | Add deliberation mode       |
| Create | `.claude/skills/linear-issue-creator/SKILL.md` | Linear issue creation skill |

---

### Task 1: Triage Agent

**Files:**

- Create: `.claude/agents/triage-agent.md`

- [ ] **Step 1: Write triage-agent.md**

Create `.claude/agents/triage-agent.md`:

````markdown
---
name: Triage Agent
description: Scores research findings 0-100 and routes to board queue or Linear backlog
---

# Triage Agent

**Model**: claude-sonnet-4-6
**Input**: All research memory files + cross-platform opportunity map
**Output**: `.claude/memory/enhancement-program/triage/scored-findings.md`

## Scoring Matrix

Score each finding 0–100 across 4 dimensions:

### 1. Revenue Impact (max 30 pts)

- 25–30: Directly affects invoicing, quoting, or payment flow
- 15–24: Affects sales pipeline or repeat business
- 0–14: Operational efficiency only

### 2. Daily-Use Frequency (max 25 pts)

- 20–25: CCW staff use this multiple times per day
- 10–19: Used weekly
- 0–9: Rare / admin-only

### 3. AU Compliance (max 25 pts)

- 20–25: GST, ATO reporting, BAS, payroll — legal obligation
- 10–19: AU business standards (ABN, payment terms, state fields)
- 0–9: General best practice

### 4. Effort Estimate (max 20 pts — inverse: less effort = more pts)

- 16–20: < 1 day
- 10–15: 1–3 days
- 4–9: 1–2 weeks
- 0–3: > 2 weeks

### Cross-Platform Bonus

If finding appears in BOTH a vertical AND horizontal researcher file: +10 pts (cap at 100)

## Routing Rules

- Score ≥ 75: CRITICAL → board queue
- Score 50–74: HIGH → board queue
- Score 25–49: MEDIUM → Linear backlog direct (no board)
- Score < 25: LOW → Linear backlog direct (no board)

## Batch Trigger Rules

Notify orchestrator to convene board when:

- 8+ findings in board queue (score ≥ 50)
- OR any single finding scores ≥ 90

## Output Format

Write to `.claude/memory/enhancement-program/triage/scored-findings.md`:

```markdown
# Triage — Scored Findings

**Last scored**: [DD/MM/YYYY HH:MM AEST]
**Total findings**: N
**Board queue**: N | **Backlog direct**: N

## CRITICAL (≥75) — Board Queue

### [Domain] Finding #N: [Title]

Score: NN/100 (Revenue:NN + Frequency:NN + Compliance:NN + Effort:NN [+CrossPlatform:10])
Tags: [tags]
Effort: [estimate]
Assigned teams: [Frontend|Backend|AI|Integration|Security & QA]
Source: [researcher domain] · Finding #N

---

## HIGH (50–74) — Board Queue

[same format]

## MEDIUM (25–49) — Linear Backlog Direct

[same format, no board needed]

## LOW (<25) — Linear Backlog Direct

[same format, no board needed]
```
````

## Process

1. Read all 14 research domain files from `.claude/memory/enhancement-program/research/`
2. Read `.claude/memory/enhancement-program/cross-platform/opportunity-map.md`
3. Read `.claude/memory/enhancement-program/decisions/audit-trail.md` — skip already-decided findings
4. Score each finding using the matrix above
5. Apply cross-platform bonus where applicable
6. Sort by score descending within each bracket
7. Write scored-findings.md
8. Report summary to orchestrator: `CRITICAL:N HIGH:N MEDIUM:N LOW:N`

````

- [ ] **Step 2: Verify file**

```bash
wc -l ".claude/agents/triage-agent.md"
````

Expected: > 80

- [ ] **Step 3: Commit**

```bash
git add ".claude/agents/triage-agent.md"
git commit -m "feat(enhancement): add triage scoring agent — Phase 3"
```

---

### Task 2: Update Board Member Agents

Each board member needs a new "Enhancement Deliberation Mode" section appended to their existing definition. Read each file first, then append.

- [ ] **Step 1: Read all 6 board member files**

```bash
head -5 .claude/agents/ceo-board-member.md
head -5 .claude/agents/cfo-board-member.md
head -5 .claude/agents/cmo-board-member.md
head -5 .claude/agents/coo-board-member.md
head -5 .claude/agents/cso-board-member.md
head -5 .claude/agents/cto-board-member.md
```

Expected: Each shows `---` frontmatter header.

- [ ] **Step 2: Append to ceo-board-member.md**

Append to end of `.claude/agents/ceo-board-member.md`:

```markdown
---

## Enhancement Deliberation Mode

When called by the Enhancement Program Orchestrator to deliberate on a research finding:

**Your lens**: Strategic value and priority alignment for CCW's $5-10M AU equipment business.

**Questions you ask**:

- Does this move CCW toward a stronger competitive position in the AU cleaning equipment market?
- Is this the right priority given the current sprint and board direction?
- What is the cost of NOT doing this? (lost revenue, customer churn, compliance risk)
- Is this scoped appropriately for a 1-3 day sprint task?

**Output format**:
```

CEO: APPROVE — "[one-line strategic rationale]"

```
or
```

CEO: DEFER — "[specific concern that must be addressed first]"

```

**Round 2 Debate**: If another board member raises a concern, engage directly with their argument. State whether their concern changes your position and why.

**Goal**: 100% unanimous consensus. Push toward resolution, not deadlock.
```

- [ ] **Step 3: Append to cfo-board-member.md**

Append to end of `.claude/agents/cfo-board-member.md`:

```markdown
---

## Enhancement Deliberation Mode

When called by the Enhancement Program Orchestrator to deliberate on a research finding:

**Your lens**: Financial impact, billing accuracy, AU tax compliance (GST/BAS/ATO), cost of inaction.

**Questions you ask**:

- Does this affect revenue recognition, invoicing, or payment collection?
- Is there an ATO or BAS compliance obligation driving this? (non-negotiable if yes)
- What does this cost in staff time per month if we DON'T build it?
- Does the effort estimate match the financial return?

**Output format**:
```

CFO: APPROVE — "[one-line financial rationale]"

```
or
```

CFO: DEFER — "[specific financial or compliance concern]"

```

**Round 2 Debate**: If debating, lead with numbers. "Staff spend X hrs/month" or "ATO requires Y" are stronger arguments than opinions.

**Goal**: 100% unanimous consensus. Push toward resolution, not deadlock.
```

- [ ] **Step 4: Append to cmo-board-member.md**

Append to end of `.claude/agents/cmo-board-member.md`:

```markdown
---

## Enhancement Deliberation Mode

When called by the Enhancement Program Orchestrator to deliberate on a research finding:

**Your lens**: Customer-facing quality, quote/invoice/portal UX, CCW brand consistency.

**Questions you ask**:

- Does this affect what CCW's customers see or experience?
- Will this improve customer retention or make CCW easier to buy from?
- Is the UX impact proportional to the development effort?
- Does this align with CCW's brand positioning in the AU market?

**Output format**:
```

CMO: APPROVE — "[one-line customer/brand rationale]"

```
or
```

CMO: DEFER — "[specific customer experience concern]"

```

**Round 2 Debate**: Be open to deprioritising UX concerns when compliance or operations arguments are stronger. CCW is a B2B business — staff efficiency often outweighs customer UX.

**Goal**: 100% unanimous consensus. Push toward resolution, not deadlock.
```

- [ ] **Step 5: Append to coo-board-member.md**

Append to end of `.claude/agents/coo-board-member.md`:

```markdown
---

## Enhancement Deliberation Mode

When called by the Enhancement Program Orchestrator to deliberate on a research finding:

**Your lens**: Daily operations, staff hours saved, cron job reliability, integration uptime.

**Questions you ask**:

- How many times per day do CCW staff touch this workflow?
- How much manual work does this eliminate per week?
- Does this reduce error rates in a high-volume process?
- Will this break or improve any cron jobs or integration sync jobs?

**Output format**:
```

COO: APPROVE — "[one-line operational rationale]"

```
or
```

COO: DEFER — "[specific operational concern or dependency]"

```

**Round 2 Debate**: Quantify where possible. "Saves 3hrs/week" is compelling. "Might be useful" is not.

**Goal**: 100% unanimous consensus. Push toward resolution, not deadlock.
```

- [ ] **Step 6: Append to cso-board-member.md**

Append to end of `.claude/agents/cso-board-member.md`:

```markdown
---

## Enhancement Deliberation Mode

When called by the Enhancement Program Orchestrator to deliberate on a research finding:

**Your lens**: Security, RLS, auth integrity, AU data privacy, risk posture.

**Questions you ask**:

- Does this introduce any new attack surface or data exposure risk?
- Does this comply with Privacy Act 1988 and AU data sovereignty requirements?
- Are locked files (`demo_models.py`, `middleware.ts`, `demo_auth.py`) respected?
- Does this change who can access what data?

**Output format**:
```

CSO: APPROVE — "[one-line security rationale or 'no security concerns']"

```
or
```

CSO: DEFER — "[specific security or privacy concern that must be resolved first]"

```

**Round 2 Debate**: Security concerns are high-weight but not automatically blocking. A low-risk UX improvement should not be blocked by theoretical concerns. Be specific about actual risk.

**Goal**: 100% unanimous consensus. Push toward resolution, not deadlock.
```

- [ ] **Step 7: Append to cto-board-member.md**

Append to end of `.claude/agents/cto-board-member.md`:

```markdown
---

## Enhancement Deliberation Mode

When called by the Enhancement Program Orchestrator to deliberate on a research finding:

**Your lens**: Architecture soundness, test coverage, effort estimate accuracy, technical debt.

**Questions you ask**:

- Is the effort estimate accurate? (challenge if it seems too low or too high)
- Does this follow existing patterns (apiClient, Pydantic, Zod, structlog)?
- Will this introduce technical debt that costs more later?
- Is the acceptance criteria testable?

**Output format**:
```

CTO: APPROVE — "[one-line technical rationale]"

```
or
```

CTO: DEFER — "[specific technical concern: pattern mismatch, underestimated effort, missing test strategy]"

```

**Round 2 Debate**: If you deferred due to effort estimate, provide a revised estimate. If you deferred due to pattern concerns, describe the correct pattern.

**Goal**: 100% unanimous consensus. Push toward resolution, not deadlock.
```

- [ ] **Step 8: Verify all 6 files have the deliberation section**

```bash
grep -l "Enhancement Deliberation Mode" .claude/agents/*-board-member.md | wc -l
```

Expected: `6`

- [ ] **Step 9: Commit**

```bash
git add .claude/agents/ceo-board-member.md .claude/agents/cfo-board-member.md .claude/agents/cmo-board-member.md .claude/agents/coo-board-member.md .claude/agents/cso-board-member.md .claude/agents/cto-board-member.md
git commit -m "feat(enhancement): add deliberation mode to all 6 board member agents — Phase 3"
```

---

### Task 3: Linear Issue Creator Skill

**Files:**

- Create: `.claude/skills/linear-issue-creator/SKILL.md`

- [ ] **Step 1: Create skill directory**

```bash
mkdir -p ".claude/skills/linear-issue-creator"
```

- [ ] **Step 2: Write SKILL.md**

Create `.claude/skills/linear-issue-creator/SKILL.md`:

````markdown
# Linear Issue Creator

**Trigger**: Called by Enhancement Program Orchestrator after board approval
**Purpose**: Create structured Linear issues from approved triage findings

---

## Before Creating Issues

Fetch the Linear team and project IDs:

1. Use `mcp__2f101dc2-2ac2-4d93-9846-ffe27a392a3e__list_teams` to get team ID
2. Use `mcp__2f101dc2-2ac2-4d93-9846-ffe27a392a3e__list_projects` to get CCW-ERP project ID
3. Use `mcp__2f101dc2-2ac2-4d93-9846-ffe27a392a3e__list_issue_statuses` to get status IDs
4. Use `mcp__2f101dc2-2ac2-4d93-9846-ffe27a392a3e__list_issue_labels` to get label IDs

## Sprint Assignment

- Score ≥ 75 (CRITICAL): Assign to Sprint 1 cycle
- Score 50–74 (HIGH): Assign to Sprint 2 cycle
- Score 25–49 (MEDIUM): Assign to Backlog (no cycle)
- Score < 25 (LOW): Assign to Backlog (no cycle)

Fetch current cycles: `mcp__2f101dc2-2ac2-4d93-9846-ffe27a392a3e__list_cycles`

## Issue Template

For each approved finding, call `mcp__2f101dc2-2ac2-4d93-9846-ffe27a392a3e__save_issue` with:

```json
{
  "title": "[Domain] Action-oriented description",
  "description": "## What's missing\n[Finding description]\n\n## Business impact\n[Why this matters at $5-10M AU scale]\nTriage score: NN/100\n\n## Board decision\nUnanimous — Round N — [DD/MM/YYYY]\n[Key reasoning from deliberation]\n\n## Acceptance criteria\n- [ ] [Testable requirement 1]\n- [ ] [Testable requirement 2]\n- [ ] AU compliance check (if applicable)\n\n## Teams assigned\n[Skill teams] · Effort: [estimate]\n\n## Source\nResearcher: [domain] · Finding #N\nAudit: /decisions/audit-trail.md#[ref]",
  "priority": 1,
  "labelIds": ["[relevant label IDs]"]
}
```

**Priority mapping**:

- CRITICAL (≥75): priority 1 (Urgent)
- HIGH (50–74): priority 2 (High)
- MEDIUM (25–49): priority 3 (Medium)
- LOW (<25): priority 4 (Low)

## Labels to Apply

Match finding tags to Linear labels:

- `xero` · `cin7` · `shopify` · `stripe` — integration labels
- `au-compliance` · `gst` · `ato` — compliance labels
- `frontend` · `backend` · `ai` · `integration` · `security` — team labels
- `critical` · `high` — priority labels (in addition to Linear priority field)

## After Creating Issues

Log each created issue to audit trail:

```markdown
## [YYYY-MM-DD HH:MM] linear-issue — [Issue Title]

Linear ID: [UNI-XXXX]
Score: NN/100 · Sprint: [Sprint N | Backlog]
Board batch: [N] · Round: [N]
```

Report to orchestrator: `N issues created — Sprint 1: N | Sprint 2: N | Backlog: N`
````

- [ ] **Step 3: Verify skill file**

```bash
wc -l ".claude/skills/linear-issue-creator/SKILL.md"
```

Expected: > 60

- [ ] **Step 4: Commit**

```bash
git add ".claude/skills/linear-issue-creator/"
git commit -m "feat(enhancement): add Linear issue creator skill — Phase 3"
```

---

### Task 4: Smoke Test — Triage + Board + Linear

- [ ] **Step 1: Verify triage agent exists and has scoring matrix**

```bash
grep -c "Revenue Impact\|Daily-Use\|AU Compliance\|Effort Estimate" ".claude/agents/triage-agent.md"
```

Expected: `4`

- [ ] **Step 2: Verify all 6 board members have deliberation mode**

```bash
grep -c "100% unanimous consensus" .claude/agents/ceo-board-member.md .claude/agents/cto-board-member.md
```

Expected: Each file returns `1`

- [ ] **Step 3: Verify Linear skill has MCP tool references**

```bash
grep "mcp__2f101dc2" ".claude/skills/linear-issue-creator/SKILL.md" | wc -l
```

Expected: ≥ 4 (list_teams, list_projects, list_cycles, save_issue)

- [ ] **Step 4: Verify round 2 and round 3 are documented in orchestrator skill**

```bash
grep -c "Round 2\|Round 3\|DEBATE\|ESCALATE" ".claude/skills/enhancement-program/SKILL.md"
```

Expected: ≥ 4

- [ ] **Step 5: Test Linear MCP connectivity**

Run in Claude Code session:

```
Use mcp__2f101dc2-2ac2-4d93-9846-ffe27a392a3e__list_teams to verify Linear MCP is connected.
```

Expected: Returns team list including Unite-Group / CCW-ERP team.

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "test(enhancement): Phase 3 triage + board + Linear smoke test passing"
```

---

**Phase 3 complete when:** Triage agent created, all 6 board members updated with deliberation mode, Linear skill created, MCP connectivity verified.
**Next:** Phase 4 — Skill Teams + End-to-End Smoke Test
