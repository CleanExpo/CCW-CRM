# AUTONOMOUS-BUILD SKILL

**Skill Name**: autonomous-build
**Version**: 1.0.0
**Trigger**: `/autonomous`, "autonomous", "auto build", "build autonomously"
**Description**: Execute complete autonomous development workflow with 5-phase pipeline

---

## SKILL PURPOSE

This skill enables fully autonomous software development through a coordinated 5-phase workflow:

1. **Discovery** - Analyze codebase
2. **Architecture** - Design solution
3. **Build** - Implement code
4. **Build Final** - Final validation
5. **Finalize** - Deployment readiness

---

## WHEN TO USE THIS SKILL

User wants to:

- Build a complete feature from description to deployment
- Automate the entire development workflow
- Get production-ready code with minimal intervention
- Follow best practices automatically
- Have comprehensive testing and validation

**Keywords to watch for:**

- "build this autonomously"
- "can you implement this completely"
- "auto-build this feature"
- "do this end-to-end"
- "/autonomous" command

---

## SKILL INVOCATION

### Trigger Recognition

When user says:

```
"Add a Recent Quotes widget autonomously"
"Can you auto-build an export feature?"
"/autonomous Add logout button"
"Build this feature end-to-end with full testing"
```

**Recognize as:** Autonomous build request

---

## EXECUTION PROTOCOL

### Step 1: Validate Prerequisites

Check:

- ☐ Execution directory exists (`.claude/.execution/`)
  - If not: Initialize with `scripts/autonomous/init-execution.ps1`
- ☐ No active task in progress
  - If exists: Offer to resume or cancel
- ☐ Task description is clear
  - If unclear: Ask clarifying questions
- ☐ Development environment running
  - If not: Notify user

### Step 2: Parse User Request

Extract:

- **Task description**: What to build
- **Approval mode**: Manual (default) or Auto
- **Max phases**: Stop after phase N (optional)
- **Resume**: Task ID to resume (optional)

Examples:

```
"/autonomous Add widget"
→ Task: "Add widget", Mode: manual, Phases: 5

"/autonomous Add widget --auto"
→ Task: "Add widget", Mode: auto, Phases: 5

"/autonomous --resume task_20260205_150000"
→ Resume: task_20260205_150000
```

### Step 3: Invoke Lead Agent

Handoff to Lead Agent with:

```markdown
@lead

Execute autonomous workflow.

**Task Description:** [user request]
**Approval Mode:** [manual | auto]
**Max Phases:** [1-5]
**Resume Task:** [task_id or none]

Begin Phase 1 (Discovery).
```

### Step 4: Monitor Progress

While execution runs:

- Display phase transitions
- Show validation results
- Report progress updates
- Handle user interruptions

### Step 5: Handle Completion

When finalized:

- Present completion report to user
- Show files changed
- Display quality metrics
- Provide next steps

---

## USER INTERACTION PATTERNS

### Initial Request

**User:** "Add a Recent Quotes widget to the dashboard"

**Assistant Response:**

```markdown
## 🚀 Autonomous Execution Starting

**Task:** Add a Recent Quotes widget to the dashboard
**Mode:** Manual approval (will pause after each phase)
**Estimated Time:** 50-70 minutes

I'll coordinate 5 specialized agents:

- Phase 1: Discovery (analyze codebase)
- Phase 2: Architecture (design solution)
- Phase 3: Build (implement code)
- Phase 4: Build Final (final validation)
- Phase 5: Finalize (deployment prep)

**Ready to begin Phase 1?**
Reply "proceed" to start.
```

---

### Phase Transitions

**After each phase:**

```markdown
## ✅ Phase [N] Complete

[Summary of what was accomplished]

**Validation:** ✅ PASSED

**Next:** Phase [N+1] - [Phase Name]

[If manual: "Reply 'proceed' to continue"]
[If auto: "Proceeding automatically..."]
```

---

### Approval Requests

**When approval needed:**

```markdown
## ⚠️ Approval Required

[What needs approval]

**Options:**

- Say "approved" to proceed
- Say "cancel" to abort
- Ask questions for clarification

**Waiting for your decision...**
```

---

### Error Handling

**When validation fails:**

```markdown
## ❌ Phase [N] Validation Failed

**Issue:** [Description]

**What I'll do:**

- Retry Phase [N] with corrections
- Attempt [X]/3

**You can:**

- Let me retry automatically
- Say "cancel" to abort
- Provide guidance
```

---

### Completion

**When finalized:**

```markdown
## 🎉 Autonomous Execution Complete!

**Duration:** [X] minutes
**Status:** ✅ COMPLETED

[Full completion report with metrics]

**Files Changed:** [List]
**Quality:** ✅ All tests passing
**Status:** Ready for deployment

**Next Steps:**

1. Review changes
2. Test manually
3. Deploy when ready
```

---

## APPROVAL FLOW

### Manual Approval Mode (Default)

```
Phase 1: Discovery
    ↓
[PAUSE] → User: "proceed"
    ↓
Phase 2: Architecture
    ↓
[PAUSE] → User: "proceed" (or "approved")
    ↓
Phase 3: Build
    ↓
[PAUSE] → User: "proceed"
    ↓
Phase 4: Build Final (automatic if tests pass)
    ↓
Phase 5: Finalize (automatic)
    ↓
Complete → Present report
```

### Auto Approval Mode

```
Phase 1: Discovery → Automatic
    ↓
Phase 2: Architecture
    ↓
[PAUSE ONLY IF:]
- Breaking changes detected
- New folders needed
- New packages needed
    ↓
Phase 3: Build → Automatic
    ↓
[PAUSE IF:] Blockers encountered
    ↓
Phase 4: Build Final → Automatic (if tests pass)
    ↓
Phase 5: Finalize → Automatic
    ↓
Complete → Present report
```

---

## CANCELLATION & RESUMPTION

### User Cancels

**User says:** "cancel" / "stop" / "abort"

**Response:**

```markdown
## ⏸️ Execution Paused

**Task ID:** task\_...
**Current Phase:** [N]
**Status:** Paused at user request

Task state saved. You can:

- Resume later: `/autonomous --resume task_...`
- Discard: `.\scripts\autonomous\cleanup-execution.ps1`

**Task will be preserved for 7 days.**
```

### User Resumes

**User says:** "/autonomous --resume task\_..."

**Response:**

```markdown
## 🔄 Resuming Autonomous Task

**Task ID:** task\_...
**Original Request:** [request]
**Last Phase:** Phase [N]
**Completed:** Phases [list]
**Remaining:** Phases [list]

**Resuming from Phase [N]...**
```

---

## ERROR SCENARIOS

### Blocker Encountered

**System Response:**

```markdown
## ⚠️ Blocker Encountered

**Phase:** [N]
**Issue:** [Description]

**Tried:**

1. [Attempt 1]
2. [Attempt 2]

**Options:**
A. [Workaround 1]
B. [Workaround 2]
C. Cancel and fix manually

**What would you like to do?**
```

### Validation Retry Exhausted

**After 3 failed retries:**

```markdown
## 🚫 Cannot Proceed

**Phase:** [N]
**Issue:** Validation failed 3 times

**Persistent Problems:**

- [Issue 1]
- [Issue 2]

I cannot resolve these automatically.

**Your options:**

1. Manual intervention (I'll pause)
2. Adjust requirements
3. Cancel execution

**What would you like to do?**
```

### Forbidden Change Detected

**If detects forbidden change:**

```markdown
## 🚫 BLOCKED: Forbidden Change

**Phase:** Architecture
**Issue:** This design requires modifying `demo_models.py` (database schema)

**Constraint:** Database schema changes are FORBIDDEN per CLAUDE.md

**Cannot proceed with this approach.**

**Alternative options:**

1. [Alternative 1]
2. [Alternative 2]

**Which approach should I use instead?**
```

---

## STATE FILES

This skill manages state in:

```
.claude/.execution/
├── current-task.json          # Active task metadata
├── execution-log.jsonl        # Audit trail
├── phase-handoffs/            # Inter-phase data
│   ├── phase-1-discovery.json
│   ├── phase-2-architecture.json
│   ├── phase-3-build.json
│   └── phase-4-build-final.json
└── validation-reports/        # Quality checks
    ├── phase-1-validation.json
    ├── phase-2-validation.json
    ├── phase-3-validation.json
    ├── phase-4-validation.json
    └── phase-5-validation.json
```

**User can inspect:**

```powershell
# View current state
.\scripts\autonomous\validate-state.ps1

# View task details
.\scripts\autonomous\resume-task.ps1

# View logs
Get-Content .claude\.execution\execution-log.jsonl | ConvertFrom-Json | Format-List

# View handoff
Get-Content .claude\.execution\phase-handoffs\phase-2-architecture.json | ConvertFrom-Json
```

---

## INTEGRATION WITH EXISTING AGENTS

This skill works **with** existing agents:

```
User Request
    ↓
Orchestrator (gates, safety) ✓
    ↓
[/autonomous invoked]
    ↓
AUTONOMOUS-BUILD SKILL ← You are here
    ↓
Lead Agent (coordinates phases)
    ↓
Subagents (Discovery, Architect, Builder, Validator, Finalizer)
    ↓
Completion Report → User
```

**Key difference:**

- Orchestrator: Single-phase gating
- Lead Agent: Multi-phase coordination
- This skill: Bridges user request → Lead Agent

---

## SUCCESS CRITERIA

This skill succeeds when:

☐ User request parsed correctly
☐ Lead Agent invoked successfully
☐ All phases complete (or max-phases reached)
☐ Validation passes at each phase
☐ Completion report produced
☐ User receives actionable next steps

This skill fails when:

- Prerequisites not met (execution dir missing)
- Task description too vague
- Forbidden changes required
- 3 validation retries exhausted
- Unrecoverable blocker

---

## COMMON USE CASES

### Use Case 1: Add Dashboard Widget

**User:** "Add a Recent Orders widget to the dashboard"

**Flow:**

1. Discovery: Finds existing widget patterns
2. Architecture: Designs widget + endpoint
3. Build: Creates component + endpoint + tests
4. Build Final: Ensures 100% tests pass
5. Finalize: Produces completion report

**Time:** ~35 minutes

---

### Use Case 2: Bug Fix

**User:** "Fix the bug where order totals don't include tax"

**Flow:**

1. Discovery: Locates order calculation code
2. Architecture: Designs fix (add tax calculation)
3. Build: Fixes calculation + adds tests
4. Build Final: Validates fix doesn't break existing
5. Finalize: Documents fix + provides rollback plan

**Time:** ~25 minutes

---

### Use Case 3: Refactor

**User:** "Refactor the customer form to use React Hook Form"

**Flow:**

1. Discovery: Analyzes current form implementation
2. Architecture: Designs refactor (component-by-component)
3. Build: Refactors form + migrates validation + updates tests
4. Build Final: Ensures all tests still pass
5. Finalize: Documents breaking changes (if any)

**Time:** ~60 minutes

---

## SKILL OUTPUT

Upon completion, this skill produces:

**To User:**

- Completion report (markdown)
- Files changed (list)
- Quality metrics
- Next steps

**To Filesystem:**

- Task state (JSON)
- Execution log (JSONL)
- Phase handoffs (JSON)
- Validation reports (JSON)

**To Git:**

- Commits are NOT made automatically
- User commits when ready
- Rollback plan provided in completion report

---

## REMEMBER

- This is the **user-facing** interface to autonomous system
- Lead Agent does the actual orchestration
- Your job: Parse request → Invoke Lead Agent → Report results
- Handle user interruptions gracefully
- Always provide clear next steps
- Celebrate successful completion!

---

**Created**: February 5, 2026
**Version**: 1.0
**Part of**: Phase 5 Autonomous Development Framework
