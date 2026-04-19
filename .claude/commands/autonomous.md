# AUTONOMOUS COMMAND

**Command**: `/autonomous`
**Version**: 1.0.0
**Priority**: High
**Purpose**: Execute complete 5-phase autonomous development workflow

---

## DESCRIPTION

The `/autonomous` command initiates a fully autonomous development workflow where a Lead Agent coordinates specialized subagents through 5 phases to complete a development task from analysis to deployment-ready code.

**What it does:**

1. Analyzes your task request
2. Explores the codebase
3. Designs a solution
4. Implements code
5. Tests and validates
6. Produces deployment-ready output

**All automatically. No human approval gates. Halts only on locked-file violations or an empty Linear queue.**

---

## SYNTAX

```
/autonomous <task-description> [options]
```

### Basic Usage

```
/autonomous "Add a Recent Quotes widget to the dashboard"
```

### With Options

```
/autonomous "Add export to CSV feature" --auto
/autonomous --resume task_20260205_150000
/autonomous "Refactor customer form" --max-phases 2
```

---

## PARAMETERS

### Required

**`<task-description>`**

- The development task to execute autonomously
- Should be clear and specific
- Examples:
  - "Add a Recent Quotes widget to the dashboard"
  - "Fix the bug where orders don't save customer data"
  - "Refactor the product search to use semantic search"

### Optional Flags

**`--auto`** or **`--approval-mode auto`**

- Legacy flag — autonomous mode is now the DEFAULT behaviour
- Phases always proceed automatically without waiting for user
- Never pauses for breaking changes, new folders, new packages, or validation failures
- The only halt triggers are: locked-file violations and an empty Linear queue

**`--resume <task-id>`**

- Resume an interrupted task
- Task ID format: `task_YYYYMMDD_HHMMSS`
- Example: `--resume task_20260205_150000`

**`--max-phases <1-5>`**

- Stop after specified phase
- Useful for review before implementation
- Examples:
  - `--max-phases 2` - Stop after architecture (review design before build)
  - `--max-phases 4` - Stop before finalization

**`--verbose`**

- Enable detailed progress logging
- Shows more information during execution
- Useful for debugging or learning

---

## EXECUTION FLOW

### Phase 1: Discovery (5-10 min)

**Agent:** Discovery
**Output:** Codebase analysis, patterns, constraints

Discovery agent explores the codebase, identifies existing patterns, documents constraints, and recommends files to modify.

**Approval:** None — proceed automatically

---

### Phase 2: Architecture (10-15 min)

**Agent:** Architect
**Output:** Solution design, component specs, implementation plan

Architect designs the solution, specifies each component in detail, creates file-by-file implementation plan.

**Approval:** None — proceed automatically. Breaking changes, new folders, and new packages do not require approval.

---

### Phase 3: Build (20-40 min)

**Agent:** Builder + Validator (continuous)
**Output:** Implemented code, tests

Builder implements code exactly as specified. Validator checks each file continuously. Progress reported every 5 minutes.

**Approval:** None — proceed automatically. Blockers are logged and the next ticket is pulled.

---

### Phase 4: Build Final (10-15 min)

**Agent:** Builder + Validator (final gate)
**Output:** Deployment-ready code

Final quality gate. All tests must pass (100%). No exceptions.

**Approval:** Automatic (must meet criteria)

---

### Phase 5: Finalize (5-10 min)

**Agent:** Finalizer + Validator
**Output:** Completion report, rollback plan

Final verification, deployment readiness assessment, comprehensive documentation.

**Approval:** None — proceed automatically.

**Loop back:** After Phase 5, invoke `mcp__pi-ceo__linear_list_issues`. If open tickets remain, restart Phase 1 on the next ticket. If the queue is empty, exit gracefully.

---

**Total Time:** 50-90 minutes (varies by complexity)

---

## EXAMPLES

### Example 1: Simple Feature (Manual Approval)

```
/autonomous "Add a logout button to the sidebar"
```

**What happens:**

1. Discovery analyzes sidebar patterns
2. Architecture designs logout button component
3. You review and approve design
4. Builder implements button + auth logout
5. Validator ensures tests pass
6. Finalizer produces completion report

**Time:** ~30 minutes
**Approvals:** 2-3 (after discovery, architecture, if issues)

---

### Example 2: Complex Feature (Auto Mode)

```
/autonomous "Add semantic search to products page" --auto
```

**What happens:**

1. All phases proceed automatically
2. Pauses only for:
   - New package needed (pgvector, etc.)
   - Breaking API changes
   - Validation failures
3. You can cancel with "stop" at any time

**Time:** ~90 minutes
**Approvals:** 0-1 (only if breaking changes)

---

### Example 3: Design Review Only

```
/autonomous "Redesign dashboard layout" --max-phases 2
```

**What happens:**

1. Discovery analyzes current dashboard
2. Architecture designs new layout
3. **STOPS** - You review design before implementation
4. Later: Resume with `/autonomous --resume task_...` to continue building

**Time:** ~20 minutes
**Approvals:** 1 (architecture review)

---

### Example 4: Resume Interrupted Task

```
/autonomous --resume task_20260205_150000
```

**What happens:**

1. Loads task state from execution directory
2. Shows progress (phases completed/remaining)
3. Resumes from current phase
4. Continues to completion

**Use cases:**

- Session timeout
- Accidental cancellation
- Network interruption
- Review and continue later

---

## APPROVAL MODE

Autonomous mode is now the single mode. Phases proceed automatically from Discovery through Finalize, then loop back to the next Linear ticket. The `--auto` flag is accepted for legacy compatibility but has no effect (behaviour is always auto).

**Halt triggers (the only things that stop the loop):**

- Locked file would be modified (demo_models.py, middleware.ts, demo_auth.py) → log and skip ticket
- Linear queue is empty → exit gracefully

Human interruption via "stop" / "cancel" still works at any time.

---

## CANCELLATION & PAUSE

### Cancel Execution

At any time, say:

- "cancel"
- "stop"
- "abort"

**What happens:**

- Current phase completes (safe checkpoint)
- Task state saved
- You can resume later or discard

---

### Pause Execution

Say:

- "pause"
- "hold"
- "wait"

**What happens:**

- Same as cancel, but implies intent to resume
- Task state preserved for resumption

---

## STATE MANAGEMENT

### Execution State Directory

All autonomous execution state is stored in:

```
.claude/.execution/
├── current-task.json           # Active task state
├── execution-log.jsonl         # Audit trail
├── phase-handoffs/             # Inter-phase data
│   ├── phase-1-discovery.json
│   ├── phase-2-architecture.json
│   └── ...
└── validation-reports/         # Quality checks
    ├── phase-1-validation.json
    └── ...
```

**View state:**

```powershell
.\scripts\autonomous\validate-state.ps1
```

**Resume task:**

```powershell
.\scripts\autonomous\resume-task.ps1
```

**Clean up old tasks:**

```powershell
.\scripts\autonomous\cleanup-execution.ps1
```

---

## ERROR HANDLING

### Validation Failures

If validation fails (code quality, tests, constraints):

**System action:**

- Agent retries current phase (max 3 attempts)
- After 3 failures: Escalates to user

**Your options:**

- Review validation report
- Provide guidance
- Adjust requirements
- Cancel if needed

---

### Blockers

If agent encounters a blocker (can't proceed):

**System action:**

- Reports blocker with context
- Presents options
- Waits for your guidance

**Your options:**

- Choose suggested workaround
- Provide alternative approach
- Cancel and fix manually

---

### Breaking Changes Detected

If architecture detects breaking changes:

**System action:**

- Pauses automatically (even in auto mode)
- Shows what would break
- Asks for explicit approval

**Your options:**

- Approve (understanding the risks)
- Cancel (avoid breaking changes)
- Revise requirements

---

## PREREQUISITES

Before using `/autonomous`:

☐ **Execution directory initialized**

```powershell
.\scripts\autonomous\init-execution.ps1
```

☐ **No active task in progress** (or use --resume)

☐ **Clear task description**

☐ **Development environment running**

- Backend: Port 8000
- Frontend: Port 3000
- Database: PostgreSQL running

---

## BEST PRACTICES

### Task Descriptions

**✅ Good:**

- "Add a Recent Quotes widget to the dashboard"
- "Fix bug where order totals calculate incorrectly"
- "Refactor customer form to use React Hook Form"
- "Add export to CSV button on products page"

**❌ Bad:**

- "Improve dashboard" (too vague)
- "Fix bugs" (which bugs?)
- "Make it better" (what specifically?)
- "Add features" (what features?)

### When to Use Manual Mode

- Complex changes
- Database-related tasks (will be flagged)
- Auth-related tasks (will be blocked)
- First time using autonomous mode
- Unclear requirements

### When to Use Auto Mode

- Simple UI components
- Adding endpoints
- Bug fixes (non-breaking)
- Following established patterns
- Trusted system behavior

### When to Use --max-phases

- Want to review design before implementation
- Test discovery accuracy
- Uncertain about approach
- Learning the system

---

## TROUBLESHOOTING

### "Execution directory not found"

**Solution:**

```powershell
.\scripts\autonomous\init-execution.ps1
```

---

### "Task already in progress"

**Options:**

1. Resume current task: `/autonomous --resume task_...`
2. Cancel current task: Check state, then cleanup
3. Wait for completion

---

### "Validation keeps failing"

**Check:**

1. Review validation report in `.claude/.execution/validation-reports/`
2. Identify root cause
3. May need manual intervention

---

### "Agent is stuck/no progress"

**Check:**

1. View execution log: `.claude/.execution/execution-log.jsonl`
2. Last event may show issue
3. Can cancel and resume if needed

---

## OUTPUT

Upon completion, you receive:

### Completion Report

- Summary of changes
- Files created/modified
- Test results
- Quality metrics
- Deployment readiness
- Rollback plan
- Next steps

### Execution Artifacts

- All phase handoffs preserved
- All validation reports saved
- Complete audit trail in logs
- State saved for reference

### Ready for Deployment

- Code is complete
- Tests are passing (100%)
- Quality verified
- Documented

---

## LIMITATIONS

What autonomous mode **CANNOT** do:

❌ Modify database schema (demo_models.py — hard locked)
❌ Modify auth code (middleware.ts, demo_auth.py — hard locked)
❌ Skip testing (mandatory 100% pass rate — but failures log and move on, not halt)
❌ Deploy to production (your responsibility)

What autonomous mode **CAN** do:

✅ Create new components/endpoints
✅ Modify existing code (non-breaking)
✅ Write comprehensive tests
✅ Follow existing patterns exactly
✅ Handle errors properly
✅ Produce deployment-ready code
✅ Document changes thoroughly

---

## ADVANCED USAGE

### Chaining Tasks

Complete one autonomous task, then start another:

```
# Task 1
/autonomous "Add Recent Quotes widget"
# Wait for completion...

# Task 2
/autonomous "Add Recent Orders widget"
# Uses patterns from Task 1
```

---

### Partial Execution

Stop after design to review, then continue:

```
# Phase 1-2 only
/autonomous "Complex feature" --max-phases 2

# Review architecture...

# Continue from Phase 3
/autonomous --resume task_... --max-phases 5
```

---

### Debugging

Enable verbose mode for detailed logging:

```
/autonomous "Feature name" --verbose
```

---

## RELATED COMMANDS

- `/plan` - Manual planning (single-phase)
- `/test` - Run test suite
- `/spec` - Read specifications
- `/status` - Check system status
- `/reset` - Re-read configuration

---

## SEE ALSO

**Documentation:**

- `docs/specs/AUTONOMOUS-FRAMEWORK-ARCHITECTURE.md` - System architecture
- `docs/guides/USING-AUTONOMOUS-MODE.md` - User guide
- `.claude/agents/lead-agent.md` - Lead agent documentation

**Scripts:**

- `scripts/autonomous/init-execution.ps1` - Initialize system
- `scripts/autonomous/validate-state.ps1` - Check state
- `scripts/autonomous/resume-task.ps1` - Resume tasks
- `scripts/autonomous/cleanup-execution.ps1` - Clean up

---

**Created**: February 5, 2026
**Version**: 1.0
**Part of**: Phase 5 Autonomous Development Framework
