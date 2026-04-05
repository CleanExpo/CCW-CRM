# Claude Code Framework Guide

## Overview

The Claude Code Framework is a comprehensive agent-based development system designed to ensure consistent, high-quality development practices for CCW-Online ERP. It enforces strict rules, provides structured workflows, and prevents common development mistakes.

**Based on:** Vision Builder pattern for production-grade Claude Code development

**Location:** `.claude/` directory in project root

---

## Quick Start

### First Session (Every Time You Start Claude Code)

1. Read `.claude/STARTUP.md` - Session initialization instructions
2. Read `.claude/CLAUDE.md` - Full system instructions
3. Check `docs/IMPLEMENTATION-PROGRESS.md` - Current project status
4. Check `.claude/.execution` - Active task state

### Before Writing Any Code

```bash
/plan   # Create implementation plan
        # Wait for approval
        # Then implement
```

### Running Commands

Commands are prefixed with `/`:
- `/plan` - Create detailed implementation plan
- `/spec` - Read specifications and requirements
- `/test` - Run test suite
- `/audit` - Validate project structure
- `/reset` - Re-read all configuration

---

## Framework Architecture

### 📁 Directory Structure

```
.claude/
├── STARTUP.md              # Read first at every session start
├── CLAUDE.md               # Full system instructions (source of truth)
├── .directives             # Automatic rule enforcement
├── .execution              # Task state tracking
├── mcp-servers.json        # Model Context Protocol configuration
├── agents/                 # Agent definitions
│   ├── orchestrator.md     # Gatekeeper - enforces all rules
│   ├── planner.md          # Creates detailed implementation plans
│   ├── coder.md            # Implements plans exactly as written
│   └── reviewer.md         # Quality gate before deployment
├── skills/                 # Reusable capabilities
│   ├── context-monitor/    # Monitor conversation context usage
│   ├── docker-ops/         # Docker container management
│   └── spec-interview/     # Requirements gathering interviews
├── commands/               # Command definitions
│   ├── plan.md
│   ├── spec.md
│   ├── test.md
│   ├── audit.md
│   └── reset.md
└── hooks/                  # Git hooks
    ├── pre-commit.sh       # Validates before commit
    ├── post-task.sh        # Cleanup after task completion
    └── context-check.sh    # Warns on high context usage
```

---

## Agent System

The framework uses a 4-agent system with clear responsibilities:

### 1. Orchestrator Agent (Gatekeeper)

**Role:** Enforces all rules and gates before any action

**Gates Enforced:**
- ☐ Gate 1: Has `.claude/STARTUP.md` been read?
- ☐ Gate 2: Has `.claude/CLAUDE.md` been read?
- ☐ Gate 3: Is there a plan?
- ☐ Gate 4: Is the plan approved?
- ☐ Gate 5: Will this modify database schema?
- ☐ Gate 6: Will this modify auth code?
- ☐ Gate 7: Will this break existing APIs?
- ☐ Gate 8: Does this require new packages?
- ☐ Gate 9: Does this create new folders?

**When Active:** At the start of every conversation, before any coding

**Decision:** Allows/blocks tasks based on gate evaluation

### 2. Planner Agent (Architect)

**Role:** Creates detailed, comprehensive implementation plans

**Responsibilities:**
- List all files to create/modify
- Break down work into atomic steps
- Identify risks and mitigation strategies
- Check for breaking changes
- Define success criteria
- Create rollback plans

**Output:** Structured plan in markdown format (see template below)

**When Active:** When `/plan` command is run or coding is requested without a plan

### 3. Coder Agent (Implementer)

**Role:** Implements plans exactly as written

**Responsibilities:**
- Follow plan step-by-step
- One file at a time
- Report progress every 5 minutes
- Test as you go
- Never deviate from plan

**Rules:**
- No random changes
- No "improvements" not in plan
- No assumptions
- Ask if unclear

**When Active:** After plan is approved

### 4. Reviewer Agent (Quality Gate)

**Role:** Final quality check before deployment

**Checklist:**
- ✅ Code Quality (types, error handling, patterns, no dead code)
- ✅ Security (no secrets, input validation, no SQL injection)
- ✅ Tests (exist, pass, edge cases covered)
- ✅ Structure (authorized folders, correct locations)
- ✅ Plan Compliance (all items complete, nothing extra)
- ✅ Breaking Changes (none unless approved)

**When Active:** After implementation, before marking task complete

---

## Command Reference

### `/plan` - Create Implementation Plan

**Usage:** Always run before writing code

**What It Does:**
1. Analyzes the requested feature/fix
2. Lists all files to create/modify
3. Breaks down into steps
4. Identifies risks
5. Checks for breaking changes
6. Creates success criteria

**Output Format:**
```markdown
# Plan: [Feature Name]

## 1. Objective
[One sentence: what are we building]

## 2. Files to Create/Modify
- [ ] apps/web/... — [what changes]
- [ ] apps/backend/... — [what changes]

## 3. Implementation Steps
1. [First thing to do]
2. [Second thing to do]
3. [Test it]

## 4. Folder Check
- Creating any new top-level folders? NO / YES (requires approval)

## 5. Package Check
- Adding any new packages? NO / YES (list packages, justify)

## 6. Breaking Change Check
- Modifying database schema? NO / YES (BLOCKED unless approved)
- Modifying auth code? NO / YES (BLOCKED - never allowed)
- Breaking existing API contracts? NO / YES (BLOCKED unless approved)

## 7. Success Criteria
- [ ] [How we know it works]
- [ ] Tests pass
- [ ] No breaking changes

## 8. Risks & Mitigation
- **Risk:** [What could go wrong]
- **Mitigation:** [How we'll handle it]

## 9. Rollback Plan
- [How to undo changes if something breaks]

## 10. Testing Strategy
- [What tests to write/run]
- [How to verify it works]
```

**Next Step:** Wait for user approval before implementing

---

### `/spec` - Read Specifications

**Usage:** When requirements are unclear or you need context

**What It Does:**
1. Reads `.claude/CLAUDE.md` (system instructions)
2. Reads `docs/specs/` (if specifications exist)
3. Reads `docs/IMPLEMENTATION-PROGRESS.md` (current status)
4. Summarizes relevant information

**When To Use:**
- Starting a new feature
- Unclear about requirements
- Need to understand existing patterns
- Confused about project architecture

---

### `/test` - Run Test Suite

**Usage:** Before marking any task complete

**What It Does:**
```bash
# Run all tests
pnpm run check:all

# Specific scopes:
/test frontend    # pnpm --filter web run test
/test backend     # cd apps/backend && pytest
/test unit        # Unit tests only
/test e2e         # E2E tests only
```

**Output:**
- Test results (pass/fail)
- Coverage report (if applicable)
- Error details (if failures)

**Rule:** All tests MUST pass before marking task complete

---

### `/audit` - Validate Project Structure

**Usage:** Before deployment, periodically during development

**What It Does:**
1. Checks folder structure (no unauthorized folders)
2. Checks required files exist
3. Checks for forbidden patterns (console.log in src/)
4. Validates code quality
5. Checks for security issues

**Output:**
```
✅ Folder structure valid
✅ Required files present
⚠️  console.log found in 3 files
✅ No forbidden folders
```

**When To Use:**
- Before creating a pull request
- After significant refactoring
- When unsure if you've violated structure rules

---

### `/reset` - Re-read All Configuration

**Usage:** When confused, after context reset, when behavior seems off

**What It Does:**
1. Clears internal state
2. Re-reads `.claude/STARTUP.md`
3. Re-reads `.claude/CLAUDE.md`
4. Re-reads `.claude/.execution`
5. Reports current task state

**When To Use:**
- Feeling confused about instructions
- After a long conversation (context degradation)
- Behavior doesn't match rules
- Starting fresh on a task

---

## Skills

### Context Monitor

**Trigger:** Automatic (checks every message)

**Thresholds:**
- 🟢 < 80k tokens: Normal
- 🟡 80k-120k: Warning
- 🟠 120k-150k: High - compact soon
- 🔴 > 150k: Critical - auto-compact

**Action:** Warns when context is high, suggests `/reset` or conversation compaction

---

### Docker Ops

**Commands:**
- `/docker status` - Show container status
- `/docker up` - Start all containers
- `/docker down` - Stop all containers
- `/docker logs [service]` - View container logs
- `/docker reset` - Reset containers and volumes

**When To Use:**
- Database not responding
- Container errors
- Fresh start needed

---

### Spec Interview

**Trigger:** When requirements are incomplete or unclear

**Questions Asked:**
1. **What:** What exactly are we building?
2. **Who:** Who will use this feature?
3. **Success:** How do we know it works?
4. **Constraints:** Any limitations or rules?
5. **Edge Cases:** What unusual scenarios should we handle?
6. **Integration:** What existing systems does this affect?

**Output:** Comprehensive requirements document

**When To Use:**
- User request is vague
- Unclear about scope
- Need to validate assumptions

---

## Workflow Examples

### Example 1: Adding a New Feature

```
User: "Add a 'bulk delete' feature for products"

Agent (Orchestrator): Running gates...
✅ Gate 1-4: Passed (startup read, instructions read, no plan yet, no approval yet)
⚠️  Gate 3: BLOCKED - No plan exists. Running /plan...

Agent (Planner): Creating plan...

# Plan: Bulk Delete Products Feature

## 1. Objective
Add ability to select multiple products and delete them in one action

## 2. Files to Create/Modify
- [ ] apps/web/app/(dashboard)/products/page.tsx — Add checkbox selection UI
- [ ] apps/web/app/(dashboard)/products/components/BulkDeleteDialog.tsx — New confirmation dialog
- [ ] apps/backend/src/api/routes/demo_lists.py — Add DELETE /api/products/bulk endpoint

## 3. Implementation Steps
1. Add checkbox column to products table
2. Track selected product IDs in React state
3. Add "Delete Selected" button (disabled if none selected)
4. Create BulkDeleteDialog component with confirmation
5. Create backend endpoint for bulk delete
6. Test with 1 product, 10 products, all products
7. Verify cascading deletes work (order_items, quote_items)

## 4. Folder Check
- Creating any new top-level folders? **NO**

## 5. Package Check
- Adding any new packages? **NO**

## 6. Breaking Change Check
- Modifying database schema? **NO**
- Modifying auth code? **NO**
- Breaking existing API contracts? **NO** (new endpoint, not modifying existing)

## 7. Success Criteria
- [ ] Can select multiple products
- [ ] Confirmation dialog shows count of items to delete
- [ ] Backend deletes all selected products in one transaction
- [ ] Frontend refreshes to show deleted items removed
- [ ] Tests pass

## 8. Risks & Mitigation
- **Risk:** User accidentally deletes many products
- **Mitigation:** Clear confirmation dialog with count, undo not supported so emphasize caution

## 9. Rollback Plan
- Revert commit
- Database has soft-delete (is_active = false) so can be recovered

## 10. Testing Strategy
- Unit test: BulkDeleteDialog renders correctly
- Integration test: DELETE /api/products/bulk with 5 IDs
- E2E test: Select 3 products, click delete, confirm, verify gone

---

User: "Approved"

Agent (Coder): Implementing step 1/7...
[Creates checkbox column in products table]

Agent (Coder): Implementing step 2/7...
[Adds state management for selected IDs]

Agent (Coder): Implementing step 3/7...
[Adds "Delete Selected" button]

... (continues through all steps)

Agent (Coder): All steps complete. Running tests...

Agent (Reviewer): Running quality gate...
✅ Code Quality: Types present, error handling correct
✅ Security: No issues
✅ Tests: Passing (3 new tests added)
✅ Structure: Files in correct locations
✅ Plan Compliance: All 7 steps completed
✅ Breaking Changes: None

Agent (Reviewer): APPROVED FOR DEPLOYMENT

Agent: Reporting back...

---

✅ Task Complete

**What was done:**
- Added checkbox selection to products table
- Created BulkDeleteDialog component with confirmation
- Added DELETE /api/products/bulk endpoint
- Implemented bulk delete with transaction safety
- Added 3 tests (all passing)

**Files changed:**
- apps/web/app/(dashboard)/products/page.tsx (modified)
- apps/web/app/(dashboard)/products/components/BulkDeleteDialog.tsx (created)
- apps/backend/src/api/routes/demo_lists.py (modified)

**Tests:** ✅ All passing (type-check, lint, unit, integration)

**Next steps:** None - feature complete
```

---

### Example 2: Fixing a Bug

```
User: "Products page crashes when search is empty"

Agent (Orchestrator): Running gates...
✅ Gates 1-2: Passed
⚠️  Gate 3: No plan. Running /plan...

Agent (Planner): Creating plan...

# Plan: Fix Empty Search Crash

## 1. Objective
Fix crash when search input is empty string

## 2. Files to Modify
- [ ] apps/web/app/(dashboard)/products/page.tsx — Add null check before search

## 3. Implementation Steps
1. Reproduce bug (search with empty string)
2. Identify root cause (likely null/undefined check missing)
3. Add proper null/empty check
4. Test with empty string, null, undefined, whitespace
5. Add test case for empty search

## 4. Breaking Change Check
- Modifying database schema? **NO**
- Modifying auth code? **NO**
- Breaking existing API contracts? **NO**

## 5. Success Criteria
- [ ] No crash on empty search
- [ ] Shows all products when search is empty
- [ ] Test added for empty search

## 6. Testing Strategy
- Manual: Try empty search, verify no crash
- Unit test: Render page with search=""

---

User: "Approved"

Agent (Coder): Step 1 - Reproducing bug...
[Tests and confirms crash]

Agent (Coder): Step 2 - Found root cause...
Line 45: products.filter(p => p.name.includes(search))
Issue: search is empty string, but should show all products

Agent (Coder): Step 3 - Fixing...
[Adds: if (!search || search.trim() === "") return products;]

Agent (Coder): Step 4 - Testing edge cases...
✅ Empty string: Works
✅ Null: Works
✅ Undefined: Works
✅ Whitespace: Works

Agent (Coder): Step 5 - Adding test...
[Creates test case]

Agent (Reviewer): Running quality gate...
✅ All checks passed

---

✅ Bug Fixed

**What was done:**
- Added null/empty check before search filter
- Tested all edge cases
- Added regression test

**Files changed:**
- apps/web/app/(dashboard)/products/page.tsx (modified)

**Tests:** ✅ All passing
```

---

## Forbidden Actions

These actions are **NEVER** allowed under ANY circumstances:

### 1. Modifying Database Schema

**Files:**
- `apps/backend/src/db/demo_models.py`

**Forbidden:**
- Adding/removing/renaming columns
- Changing table names
- Modifying enum types
- Creating new migrations

**Why:** Production data risk, requires careful migration planning

**Exception:** Only with explicit user approval + migration plan

---

### 2. Modifying Auth Code

**Files:**
- `apps/web/middleware.ts` (JWT auth middleware)
- `apps/backend/src/api/routes/demo_auth.py` (auth endpoints)

**Forbidden:**
- Changing password hashing
- Modifying token generation/validation
- Disabling authentication checks
- Bypassing security

**Why:** Security vulnerabilities, potential data leaks

**Exception:** **NEVER** - these files are permanently locked

---

### 3. Breaking Existing API Contracts

**Forbidden:**
- Changing response structure of existing endpoints
- Renaming API routes
- Changing required vs optional parameters
- Removing fields from responses

**Why:** Crashes frontend, breaks integrations

**Exception:** Only with explicit approval + frontend migration

---

### 4. Unauthorized Folder Creation

**Forbidden:**
- Creating new top-level folders without approval
- Creating `temp/`, `tmp/`, `old/`, `backup/` folders anywhere

**Why:** Deployment issues, repository clutter

**Check:** Run `pnpm audit` to validate structure

---

### 5. Coding Without a Plan

**Forbidden:**
- Writing code without running `/plan` first
- Implementing features without approval

**Why:** Wasted effort, wrong direction

**Rule:** ALWAYS run `/plan` and get approval before coding

---

## Best Practices

### 1. Start Every Session Right

```markdown
☐ Read .claude/STARTUP.md
☐ Read .claude/CLAUDE.md
☐ Check current task in .claude/.execution
☐ Check project status in docs/IMPLEMENTATION-PROGRESS.md
```

### 2. Always Plan Before Coding

```markdown
User requests feature
→ Run /plan
→ Wait for approval
→ Implement exactly as planned
→ Run /test
→ Report completion
```

### 3. Re-read Instructions Regularly

```markdown
Every 5 messages:
☐ Re-read .claude/CLAUDE.md
☐ Verify still on track
☐ Check folder structure
```

### 4. Test Before "Done"

```bash
# MANDATORY before marking task complete
pnpm run check:all
```

### 5. Report Progress

```markdown
After every file changed:
"✅ Modified apps/web/page.tsx - Added search functionality"

After task complete:
"✅ Task Complete - [summary]"
```

### 6. Ask When Unclear

```markdown
❌ Bad: Assume user wants feature X
✅ Good: "Should I implement X or Y? Please clarify."
```

---

## Troubleshooting

### Issue: "I'm confused about what to do"

**Solution:**
```bash
/reset    # Re-read all configuration
/spec     # Read specifications
```

### Issue: "Tests are failing"

**Solution:**
1. Read error message carefully
2. Fix the root cause (don't skip tests)
3. Run tests again
4. Only mark complete when all pass

### Issue: "User request contradicts rules"

**Solution:**
1. STOP immediately
2. Explain the conflict
3. Ask user how to proceed
4. Do NOT violate rules without explicit approval

### Issue: "I made a mistake"

**Solution:**
1. STOP immediately
2. Tell user what happened
3. Ask how to fix it
4. Do NOT try to "clean up" on your own

---

## Validation Scripts

### Framework Validation

```bash
# Check framework structure
./scripts/sync-framework.sh

# Expected output:
# ✅ All required .claude files exist
# ✅ No forbidden folders found
# ✅ Framework structure valid
```

### Pre-Commit Hook

```bash
# Automatically runs before every commit
# Checks:
# - No forbidden folders (temp, tmp, old, backup)
# - No console.log in src/ (warning only)
# - Tests pass
# - Type-check passes
```

**Location:** `.claude/hooks/pre-commit.sh`

**Install:**
```bash
# Manually (if needed)
cp .claude/hooks/pre-commit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

---

## MCP Server Configuration

The framework includes Model Context Protocol (MCP) server configuration for enhanced capabilities:

**Servers Configured:**
- **filesystem**: File operations (read, write, edit, search)
- **github**: GitHub integration (PRs, issues, repos)
- **postgres**: PostgreSQL database operations

**Configuration:** `.claude/mcp-servers.json`

**Usage:** Automatically loaded by Claude Code when available

---

## Extending the Framework

### Adding a New Agent

1. Create `agents/[agent-name].md` with:
   - Role & Responsibilities
   - When To Activate
   - Input/Output Format
   - Rules & Constraints

2. Register in `.claude/.directives`:
   ```
   AGENTS:
     - your-new-agent
   ```

### Adding a New Command

1. Create `commands/[command-name].md` with:
   - Command syntax
   - What it does
   - When to use
   - Output format

2. Document in `.claude/CLAUDE.md` command reference

### Adding a New Skill

1. Create `skills/[skill-name]/SKILL.md` with:
   - Skill description
   - Triggers
   - Actions
   - Examples

2. Register in `.claude/.directives`:
   ```
   SKILLS:
     - your-new-skill
   ```

---

## Maintenance

### Regular Updates

- **Weekly:** Review `.claude/.execution` for stale tasks
- **Monthly:** Audit folder structure (`/audit`)
- **Per Phase:** Update `docs/IMPLEMENTATION-PROGRESS.md`

### Framework Updates

When updating framework files:
1. Get explicit user approval
2. Test thoroughly
3. Update this documentation
4. Commit with detailed message

---

## Support & Resources

### Key Files
- `.claude/STARTUP.md` - Read first every session
- `.claude/CLAUDE.md` - Full system instructions
- `CLAUDE.md` (root) - Quick reference guide
- `docs/IMPLEMENTATION-PROGRESS.md` - Current project status

### Getting Help
- Run `/reset` when confused
- Run `/spec` for context
- Ask user when unclear
- Re-read instructions every 5 messages

### Best Resource
**This file** - Bookmark it, reference it often

---

**Version:** 1.0.0
**Last Updated:** 2026-01-22
**Framework Location:** `.claude/`
**Status:** Active
