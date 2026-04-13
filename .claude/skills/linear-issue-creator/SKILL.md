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
