# /sync-linear — Orchestrate Gap-to-Linear Workflow

Orchestrates the complete gap detection → prioritization → PRD → Linear sync workflow in a single command.

## What It Does

Chains 4 PI commands in sequence:

1. **/pi-cross-ref** - Find orphan routes, pages, API clients
2. **/pi-prioritize** - Score gaps by Impact × Effort → Priority matrix
3. **/pi-prd** - Generate PRD from gap analysis findings
4. **/pi-issues** - Sync PRD items to Linear via browser automation

## State Management

Creates execution state in `.claude/.execution/gap-sync/{sync_id}/`:

```json
{
  "sync_id": "sync_20260323_143000",
  "created_at": "ISO 8601 timestamp",
  "status": "pending|in_progress|completed|failed",
  "current_step": 1,
  "steps": [
    {
      "step_id": 1,
      "name": "pi-cross-ref",
      "status": "pending|in_progress|completed|failed",
      "started_at": null,
      "completed_at": null,
      "output_path": ".claude/.execution/gap-sync/{sync_id}/step-1-cross-ref.md",
      "error": null
    },
    {
      "step_id": 2,
      "name": "pi-prioritize",
      "status": "pending",
      "started_at": null,
      "completed_at": null,
      "output_path": ".claude/.execution/gap-sync/{sync_id}/step-2-prioritize.md",
      "error": null
    },
    {
      "step_id": 3,
      "name": "pi-prd",
      "status": "pending",
      "started_at": null,
      "completed_at": null,
      "output_path": "docs/PRD-CCW-GAPS-{date}.md",
      "error": null
    },
    {
      "step_id": 4,
      "name": "pi-issues",
      "status": "pending",
      "started_at": null,
      "completed_at": null,
      "output_path": "docs/gaps/linear-import.csv",
      "issues_created": 0,
      "error": null
    }
  ],
  "total_issues_created": 0,
  "rollback_performed": false
}
```

## Execution Protocol

### Step 1: Initialize Sync

```markdown
## 🔄 Starting Gap-to-Linear Sync

**Sync ID:** sync_20260323_143000
**Created:** 2026-03-23T14:30:00Z

I'll execute 4 steps to sync gaps to Linear:

1. ⏳ Cross-reference routes, pages, API clients
2. ⏳ Prioritize gaps by impact and effort
3. ⏳ Generate PRD from findings
4. ⏳ Create Linear issues from PRD

**Starting Step 1...**
```

Create sync directory:

```
.claude/.execution/gap-sync/sync_20260323_143000/
```

Create state file:

```
.claude/.execution/gap-sync/sync_20260323_143000/state.json
```

### Step 2: Execute Each Step Sequentially

For each step (1-4):

**Start Step:**

```markdown
## 📋 Step [N]: [Step Name]

**Status:** Starting...
```

Update state:

```json
{
  "current_step": N,
  "steps[N-1].status": "in_progress",
  "steps[N-1].started_at": "ISO 8601 timestamp"
}
```

**Execute PI Command:**

Invoke the corresponding PI command:

- Step 1: `/pi-cross-ref`
- Step 2: `/pi-prioritize` (uses output from step 1)
- Step 3: `/pi-prd` (uses output from step 2)
- Step 4: `/pi-issues` (uses output from step 3)

**Capture Output:**

Save command output to step output file:

```
.claude/.execution/gap-sync/{sync_id}/step-[N]-[name].md
```

**Complete Step:**

```markdown
## ✅ Step [N] Complete

**Duration:** [X] seconds
**Output:** [output_path]

**Key findings:**

- [Finding 1]
- [Finding 2]

**Proceeding to Step [N+1]...**
```

Update state:

```json
{
  "steps[N-1].status": "completed",
  "steps[N-1].completed_at": "ISO 8601 timestamp"
}
```

### Step 3: Handle Errors

If any step fails:

```markdown
## ❌ Step [N] Failed

**Error:** [error message]

**What went wrong:**
[Detailed explanation]

**Options:**
A. Retry Step [N]
B. Skip to Step [N+1] (not recommended)
C. Cancel sync

**Rollback?**
If Step 4 (Linear issue creation) was reached, I can rollback created issues.

**What would you like to do?**
```

Update state:

```json
{
  "status": "failed",
  "steps[N-1].status": "failed",
  "steps[N-1].error": "error message"
}
```

### Step 4: Rollback (if Step 4 reached and user requests)

If Step 4 (pi-issues) created Linear issues and user wants to rollback:

```markdown
## 🔄 Rolling Back Linear Issues

**Issues created:** [X]
**Rollback method:** Delete via Linear API

**Rolling back...**
```

For each created issue:

1. Read `docs/gaps/linear-import.csv` for issue IDs
2. Call Linear API to delete each issue
3. Log deleted issue IDs

Update state:

```json
{
  "rollback_performed": true,
  "total_issues_created": 0
}
```

```markdown
## ✅ Rollback Complete

**Deleted [X] Linear issues**

Sync state has been rolled back. You can retry with `/sync-linear`.
```

### Step 5: Complete Sync

```markdown
## 🎉 Gap-to-Linear Sync Complete

**Sync ID:** sync_20260323_143000
**Duration:** [X] minutes
**Status:** COMPLETED

### Steps Completed:

1. ✅ Cross-reference (Step 1) - [N] gaps found
2. ✅ Prioritize (Step 2) - Priority matrix generated
3. ✅ PRD (Step 3) - docs/PRD-CCW-GAPS-{date}.md
4. ✅ Linear Issues (Step 4) - [X] issues created

### Summary:

**Total Gaps Found:** [N]
**High Priority:** [X]
**Medium Priority:** [Y]
**Low Priority:** [Z]

**Linear Issues Created:** [X]
**Project:** UNI (CCW-ERP-CRM)

### Next Steps:

1. Review PRD: docs/PRD-CCW-GAPS-{date}.md
2. Triage Linear issues in UNI project
3. Assign priority gaps to sprints

**All gaps have been synced to Linear.**
```

Update state:

```json
{
  "status": "completed",
  "total_issues_created": X
}
```

Update decisions log:

```markdown
## Gap Sync [Date]

**Sync ID:** sync_20260323_143000
**Gaps Found:** [N]
**Issues Created:** [X]
**PRD:** docs/PRD-CCW-GAPS-{date}.md
**Linear Import:** docs/gaps/linear-import.csv
```

Append to `.claude/memory/decisions-log.md`.

---

## Usage

```bash
/sync-linear
```

Or in chat:

```
Sync gaps to Linear
```

---

## Prerequisites

☐ Browser automation configured (for pi-issues)
☐ Linear API token set in environment
☐ Chrome/Edge browser installed
☐ Catalogs up-to-date (ROUTES.md, PAGES.md)

---

## Output Artifacts

After successful sync:

```
.claude/.execution/gap-sync/sync_20260323_143000/
├── state.json
├── step-1-cross-ref.md
├── step-2-prioritize.md
├── step-3-prd.md (copy of PRD)
└── step-4-issues.md (Linear import log)

docs/
├── PRD-CCW-GAPS-2026-03-23.md
└── gaps/
    ├── linear-import.csv
    └── linear-creation-log.txt

.claude/memory/decisions-log.md (updated)
```

---

## Error Recovery

**If Step 1 (pi-cross-ref) fails:**

- Check that ROUTES.md and PAGES.md catalogs exist
- Ensure catalogs are up-to-date
- Retry: `/pi-cross-ref` manually, then `/sync-linear --resume`

**If Step 2 (pi-prioritize) fails:**

- Check that step-1 output exists
- Ensure priority scoring logic is clear
- Retry: `/sync-linear --resume`

**If Step 3 (pi-prd) fails:**

- Check that step-2 output exists
- Ensure docs/ directory is writable
- Retry: `/sync-linear --resume`

**If Step 4 (pi-issues) fails:**

- Check Linear API token is valid
- Check browser automation is working
- Check docs/gaps/ directory exists
- **IMPORTANT:** Issues may have been partially created
- Rollback: `/sync-linear --rollback sync_20260323_143000`
- Retry: `/sync-linear`

---

## Resume Capability

If sync is interrupted:

```bash
/sync-linear --resume sync_20260323_143000
```

Will load state and continue from last completed step.

---

## Advanced Options

```bash
# Skip step 4 (don't create Linear issues, just generate PRD)
/sync-linear --skip-linear

# Dry run (show what would be created, don't actually create)
/sync-linear --dry-run

# Rollback a specific sync
/sync-linear --rollback sync_20260323_143000
```

---

## Remember

- This is a **multi-step orchestration** - each step depends on the previous
- Step 4 (Linear issue creation) is **irreversible without rollback**
- Always review the PRD (Step 3) before approving Step 4
- State is preserved for resumption and rollback

---

**If you're reading this file, you are executing the sync-linear orchestrator.**
