# Using Autonomous Mode - User Guide

**For**: CCW-Online ERP Developers
**Version**: 1.0.0
**Date**: February 5, 2026

---

## What is Autonomous Mode?

Autonomous Mode is a fully automated development workflow that takes a simple task description and delivers production-ready code - complete with tests, validation, and deployment preparation.

**Think of it as:**
> A senior development team working 24/7 to implement your feature requests with perfect pattern-following and comprehensive testing.

---

## Quick Start

### 1. Initialize (One-time Setup)

```powershell
.\scripts\autonomous\init-execution.ps1
```

This creates the execution state directory.

### 2. Run Your First Task

```
/autonomous "Add a logout button to the sidebar"
```

### 3. Approve Each Phase

When prompted, say:
- `"proceed"` to continue
- `"cancel"` to stop

### 4. Review Results

You'll receive a completion report with:
- Files changed
- Tests written
- Quality metrics
- Next steps

**That's it!** You now have production-ready code.

---

## When to Use Autonomous Mode

### ✅ Perfect For:

- **Adding new components** ("Add a Recent Quotes widget")
- **Creating new endpoints** ("Add GET /api/dashboard/stats")
- **Bug fixes** ("Fix calculation error in order totals")
- **Refactoring** ("Refactor customer form to use React Hook Form")
- **Following patterns** ("Add another dashboard widget like the existing ones")

### ❌ Not Suitable For:

- **Database schema changes** (forbidden per project rules)
- **Auth modifications** (forbidden per project rules)
- **Breaking API changes** (requires special approval)
- **Vague requests** ("make the app better")
- **Multi-feature epics** (break into smaller tasks)

---

## Command Syntax

### Basic

```
/autonomous "task description"
```

Example:
```
/autonomous "Add export to CSV button on products page"
```

---

### Auto Mode (Skip Approvals)

```
/autonomous "task" --auto
```

Example:
```
/autonomous "Add tooltips to all buttons" --auto
```

**When to use:**
- Simple, safe changes
- You trust the system
- Want speed over control

**When NOT to use:**
- First time using autonomous mode
- Complex changes
- Database-related tasks
- Unclear requirements

---

### Design Review Only

```
/autonomous "task" --max-phases 2
```

Example:
```
/autonomous "Redesign dashboard layout" --max-phases 2
```

**What happens:**
- Runs Phase 1 (Discovery)
- Runs Phase 2 (Architecture)
- **STOPS** for your review
- You can resume later with `/autonomous --resume task_...`

**When to use:**
- Want to review design before implementation
- Uncertain about approach
- Large changes
- Learning the system

---

### Resume Interrupted Task

```
/autonomous --resume task_20260205_150000
```

**When to use:**
- Session timed out
- You paused for review
- Accidental cancellation
- Network interruption

---

## The 5-Phase Pipeline

### Phase 1: Discovery (5-10 min)

**What it does:**
- Analyzes the codebase
- Finds existing patterns
- Documents constraints
- Recommends files to change

**Output:**
- Discovery report
- Pattern analysis
- Constraint list
- Complexity assessment

**You'll see:**
```markdown
## 🔍 Phase 1: Discovery Complete

**Patterns Found:**
- Dashboard widgets follow Card + React.memo pattern
- API endpoints use FastAPI + Pydantic

**Constraints:**
- No database schema changes
- Must follow existing patterns

**Ready for Phase 2?**
```

---

### Phase 2: Architecture (10-15 min)

**What it does:**
- Designs the complete solution
- Specifies each component
- Creates implementation plan
- Identifies approval needs

**Output:**
- Architecture document
- Component specifications
- File-by-file plan
- Time estimate

**You'll see:**
```markdown
## 🏗️ Phase 2: Architecture Complete

**Design:**
- Create: RecentQuotesWidget.tsx
- Modify: dashboard/page.tsx
- Create: GET /api/dashboard/recent-quotes
- Tests: 4 test files

**Time Estimate:** 35 minutes
**Breaking Changes:** None

**Ready for Phase 3?**
```

---

### Phase 3: Build (20-40 min)

**What it does:**
- Implements code exactly as designed
- Writes tests for each file
- Validates continuously
- Reports progress every 5 minutes

**Output:**
- Implemented code
- Test files
- Progress updates

**You'll see:**
```markdown
## 📊 Build Progress: 2/4 files complete

**Completed:**
- ✅ RecentQuotesWidget.tsx
- ✅ RecentQuotesWidget.test.tsx

**In Progress:**
- 🔨 dashboard/page.tsx

**Quality:**
- TypeScript: ✅ Passing
- Tests: ✅ 2/2 passing

**Status:** On track
```

---

### Phase 4: Build Final (10-15 min)

**What it does:**
- Completes remaining work
- Achieves 100% test pass rate
- Validates deployment readiness
- Strict quality gate

**Output:**
- Final code
- All tests passing
- Quality report

**You'll see:**
```markdown
## ✅ Phase 4: Build Final Complete

**Quality Report:**
- ✅ TypeScript: 0 errors
- ✅ Lint: 0 warnings
- ✅ Tests: 4/4 passing (100%)

**Breaking Changes:** None

**Proceeding to Phase 5...**
```

---

### Phase 5: Finalize (5-10 min)

**What it does:**
- Final verification
- Deployment readiness check
- Creates rollback plan
- Documents everything

**Output:**
- Completion report
- File change manifest
- Rollback plan
- Next steps

**You'll see:**
```markdown
## 🎉 Autonomous Execution Complete!

**Duration:** 42 minutes
**Files Changed:** 4 (2 created, 2 modified)
**Tests:** 4/4 passing
**Status:** ✅ Ready for deployment

**Next Steps:**
1. Review changes
2. Test manually
3. Deploy when ready
```

---

## Interacting During Execution

### Proceeding to Next Phase

When you see:
```markdown
**Ready for Phase 2?**
```

Say:
- `"proceed"`
- `"continue"`
- `"approved"`
- `"yes"`
- `"go ahead"`

---

### Canceling

At any time, say:
- `"cancel"`
- `"stop"`
- `"abort"`

**What happens:**
- Current step completes safely
- State saved to disk
- You can resume later

---

### Pausing for Review

Say:
- `"pause"`
- `"hold"`
- `"wait"`

**Use cases:**
- Want to review architecture before build
- Need to discuss with team
- Taking a break

---

### Asking Questions

During execution, you can ask:
- `"show me the architecture"`
- `"what phase are we on?"`
- `"how much time left?"`
- `"show me the handoff document"`

---

## Understanding the Output

### Completion Report

After Phase 5, you'll receive a comprehensive report:

```markdown
## 🎉 Completion Report

**Task:** Add Recent Quotes widget
**Duration:** 42 minutes
**Status:** ✅ COMPLETED

### Files Changed

**Created (2):**
- apps/web/components/dashboard/RecentQuotesWidget.tsx
- apps/web/__tests__/components/dashboard/RecentQuotesWidget.test.tsx

**Modified (2):**
- apps/web/app/(dashboard)/dashboard/page.tsx
- apps/backend/src/api/routes/demo_dashboard.py

### Quality Report

- ✅ Tests: 4/4 passing (100%)
- ✅ TypeScript: 0 errors
- ✅ Lint: 0 warnings
- ✅ Test Coverage: 95%

### Deployment Readiness

**Status:** ✅ READY

**Rollback Plan:**
```bash
git revert [commit-hash]
```

**Next Steps:**
1. Review code changes
2. Test feature manually
3. Commit and deploy
```

---

### File Change Manifest

For each file, you get:

**Created Files:**
- **Purpose**: What it does
- **Lines**: How big
- **Pattern**: What it follows
- **Key features**: Main capabilities

**Modified Files:**
- **Lines changed**: How much
- **What changed**: Specific modifications
- **Impact**: What it affects

---

### Quality Metrics

**Tests:**
- Total tests written
- Tests passing (must be 100%)
- Coverage percentage

**Code Quality:**
- TypeScript errors (must be 0)
- Lint warnings (must be 0)
- Pattern compliance

**Compliance:**
- Breaking changes (should be none)
- Forbidden changes (must be none)
- Unauthorized changes (must be none)

---

## Common Scenarios

### Scenario 1: Add Dashboard Widget

**Task:**
```
/autonomous "Add a Recent Orders widget to dashboard"
```

**What happens:**
1. Discovers existing widget patterns (5 min)
2. Designs widget + endpoint (10 min)
3. Implements component + API + tests (25 min)
4. Final validation (5 min)
5. Produces completion report (3 min)

**Result:** Complete widget ready to deploy (48 min total)

---

### Scenario 2: Bug Fix

**Task:**
```
/autonomous "Fix bug where order totals don't include tax"
```

**What happens:**
1. Finds order calculation code (3 min)
2. Designs fix with tax calculation (8 min)
3. Implements fix + adds tests (15 min)
4. Validates fix doesn't break existing (5 min)
5. Documents fix + rollback plan (3 min)

**Result:** Bug fixed with tests (34 min total)

---

### Scenario 3: Review Architecture First

**Task:**
```
/autonomous "Add semantic search to products" --max-phases 2
```

**What happens:**
1. Discovers search patterns (8 min)
2. Designs semantic search solution (15 min)
3. **STOPS** - presents architecture for review

**You review architecture, then:**
```
/autonomous --resume task_20260205_150000
```

**Continues:**
4. Implements semantic search (45 min)
5. Final validation (10 min)
6. Completion report (5 min)

**Result:** Large feature with design review (83 min total)

---

## Troubleshooting

### Problem: "Execution directory not found"

**Solution:**
```powershell
.\scripts\autonomous\init-execution.ps1
```

---

### Problem: "Task already in progress"

**Check what's running:**
```powershell
.\scripts\autonomous\validate-state.ps1
```

**Options:**
1. Resume current task: `/autonomous --resume task_...`
2. Cancel and cleanup: `.\scripts\autonomous\cleanup-execution.ps1`

---

### Problem: "Validation keeps failing"

**What to do:**
1. Check validation report:
   ```powershell
   Get-Content .claude\.execution\validation-reports\phase-3-validation.json
   ```
2. Review specific issues
3. May need manual intervention
4. Cancel if needed, fix manually

---

### Problem: "No progress updates"

**What to do:**
1. Check execution log:
   ```powershell
   Get-Content .claude\.execution\execution-log.jsonl -Tail 10
   ```
2. Last event shows current state
3. May be working on long file
4. Can cancel and resume if truly stuck

---

### Problem: "Forbidden change detected"

**What happened:**
- Architecture tried to modify database schema, auth code, or break APIs
- System automatically BLOCKED

**What to do:**
1. Review alternative approaches suggested
2. Revise task requirements
3. Approve alternative approach

**Example:**
```markdown
## 🚫 BLOCKED: Forbidden Change

This task requires modifying database schema (forbidden).

**Alternative approaches:**
1. Use existing metadata JSON field
2. Handle in application layer only
3. Request schema change approval separately

**Which approach should I use?**
```

---

## Advanced Usage

### Chaining Tasks

Complete multiple features sequentially:

```
# Task 1
/autonomous "Add Recent Quotes widget"
# Wait for completion...

# Task 2 (uses patterns from Task 1)
/autonomous "Add Recent Orders widget"
# Faster because pattern established
```

---

### Batch Processing (Future)

Not yet supported, but planned:
```
/autonomous --batch tasks.json
```

Where `tasks.json`:
```json
[
  {"task": "Add logout button", "auto": true},
  {"task": "Add export CSV", "auto": true},
  {"task": "Fix tax calculation", "auto": false}
]
```

---

### Custom Validation Rules (Advanced)

Edit `.claude/agents/validator-agent.md` to add project-specific checks.

---

## Best Practices

### Writing Good Task Descriptions

**✅ Good:**
- "Add a logout button to the sidebar"
- "Fix calculation error in order totals where tax isn't included"
- "Refactor customer form to use React Hook Form pattern"
- "Add GET /api/dashboard/stats endpoint returning user count and order count"

**❌ Bad:**
- "Improve dashboard" (too vague)
- "Fix bugs" (which bugs?)
- "Make it better" (what specifically?)
- "Update things" (what things?)

**Characteristics of good descriptions:**
- Specific action ("Add", "Fix", "Refactor")
- Clear target ("logout button", "order totals", "customer form")
- Context when needed ("to sidebar", "where tax isn't included")
- Single responsibility (one feature per task)

---

### Choosing Approval Mode

**Use Manual Mode when:**
- First time using autonomous
- Complex features
- Database-related (will be blocked anyway)
- Uncertain requirements
- Want maximum control

**Use Auto Mode when:**
- Simple UI components
- Following established patterns
- Bug fixes (non-breaking)
- Trusted system behavior
- Time-sensitive

---

### When to Review Architecture

**Review architecture (--max-phases 2) when:**
- Large features
- Uncertain approach
- Multiple valid solutions
- Want to discuss with team
- Learning the system

---

### Managing Execution State

**Check state regularly:**
```powershell
# Current status
.\scripts\autonomous\validate-state.ps1

# Task details
.\scripts\autonomous\resume-task.ps1
```

**Clean up periodically:**
```powershell
# Archive tasks older than 7 days
.\scripts\autonomous\cleanup-execution.ps1 -ArchiveOlderThanDays 7
```

---

## Tips & Tricks

### Tip 1: Test in Development First

Always run autonomous mode in development environment first.

### Tip 2: Commit Frequently

After each successful autonomous execution, commit the changes:

```bash
git add .
git commit -m "feat: Add Recent Quotes widget

Autonomous execution task_20260205_150000
- Created RecentQuotesWidget component
- Added /api/dashboard/recent-quotes endpoint
- Added 4 tests (all passing)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push
```

### Tip 3: Review Before Deploying

Even though autonomous mode produces deployment-ready code, always:
1. Review the code changes
2. Test manually in development
3. Run full test suite
4. Deploy to staging first (if available)

### Tip 4: Keep Tasks Small

Break large features into smaller autonomous tasks:

**Instead of:**
```
/autonomous "Build complete user management system"
```

**Do:**
```
/autonomous "Add user list page"
/autonomous "Add create user form"
/autonomous "Add edit user form"
/autonomous "Add delete user confirmation"
```

### Tip 5: Use Verbose Logs for Learning

First few times, enable verbose mode:
```
/autonomous "task" --verbose
```

This shows more detail and helps you understand the system.

---

## FAQ

**Q: How long does it take?**
A: 40-90 minutes typically. Simple features: 30-40 min. Complex features: 60-90 min.

**Q: Can I run multiple tasks in parallel?**
A: Not yet. One task at a time. Planned for future.

**Q: Does it make git commits?**
A: No. You commit when ready. Rollback plans use git revert.

**Q: What if I disagree with the architecture?**
A: Cancel after Phase 2, provide feedback, restart with revised requirements.

**Q: Can it modify database schema?**
A: No. Forbidden per project rules. System will block automatically.

**Q: What if tests fail?**
A: System retries automatically (max 3). After 3 failures, escalates to you.

**Q: Can I pause and resume later?**
A: Yes! Say "pause", state is saved, resume anytime with `/autonomous --resume task_...`

**Q: How do I see what it's doing?**
A: Progress updates every 5 minutes. Check logs: `.claude/.execution/execution-log.jsonl`

**Q: Is the code good quality?**
A: Yes. Follows existing patterns exactly, 100% test coverage, lint/type checks pass.

**Q: Can I trust it?**
A: For safe, pattern-following work: yes. For critical changes: review first.

---

## Getting Help

**Documentation:**
- Architecture: `docs/specs/AUTONOMOUS-FRAMEWORK-ARCHITECTURE.md`
- This guide: `docs/guides/USING-AUTONOMOUS-MODE.md`
- Command reference: `.claude/commands/autonomous.md`

**Support:**
- Check execution logs: `.claude/.execution/execution-log.jsonl`
- Validate state: `.\scripts\autonomous\validate-state.ps1`
- GitHub issues: `https://github.com/anthropics/claude-code/issues`

---

**Happy autonomous building!** 🚀

---

**Created**: February 5, 2026
**Version**: 1.0.0
**For**: CCW-Online ERP Project
