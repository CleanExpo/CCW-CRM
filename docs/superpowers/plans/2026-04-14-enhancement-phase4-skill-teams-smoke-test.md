# Enhancement Program — Phase 4: Skill Teams + End-to-End Smoke Test

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the 5 skill team agents that execute approved Linear issues, then run an end-to-end smoke test of the full enhancement cycle (research → triage → board → Linear).

**Architecture:** Each skill team agent is a Markdown file in `.claude/agents/skill-teams/` that instructs the team lead exactly how to pull a Linear issue, create a worktree, implement, review, and PR. The smoke test validates the whole pipeline by injecting a synthetic low-stakes finding and tracing it through every phase.

**Tech Stack:** Claude Code skills (Markdown), Agent tool for subagent dispatch, Linear MCP (`mcp__2f101dc2-*`), git worktrees, existing board agents in `.claude/agents/`

---

## File Map

| Action | Path                                                                | Purpose                           |
| ------ | ------------------------------------------------------------------- | --------------------------------- |
| Create | `.claude/agents/skill-teams/frontend-team.md`                       | Frontend skill team agent         |
| Create | `.claude/agents/skill-teams/backend-team.md`                        | Backend skill team agent          |
| Create | `.claude/agents/skill-teams/ai-team.md`                             | AI skill team agent               |
| Create | `.claude/agents/skill-teams/integration-team.md`                    | Integration skill team agent      |
| Create | `.claude/agents/skill-teams/security-qa-team.md`                    | Security & QA cross-cutting agent |
| Create | `.claude/memory/enhancement-program/research/smoke-test-finding.md` | Synthetic finding for smoke test  |

---

### Task 1: Frontend Skill Team Agent

**Files:**

- Create: `.claude/agents/skill-teams/frontend-team.md`

- [ ] **Step 1: Create skill-teams directory**

```bash
mkdir -p ".claude/agents/skill-teams"
```

Expected: No output, directory created.

- [ ] **Step 2: Write frontend-team.md**

Create `.claude/agents/skill-teams/frontend-team.md`:

````markdown
# Frontend Skill Team

**Trigger**: Assigned a Linear issue tagged `frontend` or `ux`
**Lead Model**: Claude Sonnet 4.6
**Executor Model**: Claude Haiku 4.5
**Owns**: `apps/web/**`

---

## BEFORE YOU START

Read in order:

1. `CLAUDE.md` (root) — project rules and locked files
2. `.claude/ARCHITECTURE.md` — system overview
3. `.claude/STANDARDS.md` — code patterns
4. `.claude/TESTING.md` — test commands
5. The Linear issue body (passed to you by orchestrator)

**Locked files — never touch:**

- `apps/web/middleware.ts`

**Invariants:**

- All work targets `ai-updates` branch — NEVER `main` or production
- AU locale: AUD, DD/MM/YYYY, AEST/AEDT in all user-facing output
- Use `apiClient` from `@/lib/api/client` for all HTTP calls
- Use `@/components/ui/` (shadcn) components and `bg-primary` design tokens
- Keep frontend state in React hooks — no Redux/Zustand
- Use Zod for all validation

---

## WORKFLOW

### Step 1: Parse the issue

From the Linear issue extract:

- **Title**: what to build
- **Acceptance criteria**: the testable checklist
- **Effort estimate**: used to scope your implementation
- **Teams assigned**: confirm `frontend` is listed

If the issue is missing acceptance criteria, STOP and ask the orchestrator to fix the issue before proceeding.

### Step 2: Create worktree

```bash
# Use git worktrees skill to create an isolated branch
# Branch name: feat/linear-<issue-id>-<slug>
git worktree add ".claude/worktrees/<branch-name>" -b feat/linear-<issue-id>-<slug>
```

All implementation work happens in the worktree. Never modify the main checkout.

### Step 3: Dispatch executor subagent (Haiku 4.5)

Provide the executor with:

- The full Linear issue body
- The exact acceptance criteria (numbered list)
- File paths to modify (identify from issue + your reading of the codebase)
- Instruction to write failing tests first (TDD)
- Instruction to run `pnpm turbo run type-check` after every change (zero errors required)

The executor reports back: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED

### Step 4: Review

After executor reports DONE:

1. Run `pnpm turbo run type-check lint test` — must all pass
2. Check each acceptance criterion is met (read the code, don't trust executor's word)
3. Dispatch code quality reviewer (Sonnet 4.6) for final check

### Step 5: PR

```bash
gh pr create \
  --title "feat(web): <issue title>" \
  --body "Closes <Linear issue URL>

## Changes
<bullet list>

## Acceptance criteria
<paste checklist with checkmarks>

## Test plan
<how to verify>"
```

Base branch: `ai-updates`

### Step 6: Report to orchestrator

Post a comment on the Linear issue:

- PR URL
- All acceptance criteria met (yes/no per item)
- Any deferred items (with reason)

---

## QUALITY GATES

Before any PR:

- [ ] `pnpm turbo run type-check` — zero errors
- [ ] `pnpm turbo run lint` — zero warnings in changed files
- [ ] `pnpm turbo run test` — all tests pass
- [ ] AU locale correct (AUD, DD/MM/YYYY)
- [ ] No raw colours — only design tokens
- [ ] No Redux/Zustand introduced
- [ ] Locked files untouched
````

- [ ] **Step 3: Verify file created**

```bash
wc -l ".claude/agents/skill-teams/frontend-team.md"
```

Expected: line count > 60

- [ ] **Step 4: Commit**

```bash
git add ".claude/agents/skill-teams/frontend-team.md"
git commit -m "feat(enhancement): add frontend skill team agent — Phase 4"
```

---

### Task 2: Backend Skill Team Agent

**Files:**

- Create: `.claude/agents/skill-teams/backend-team.md`

- [ ] **Step 1: Write backend-team.md**

Create `.claude/agents/skill-teams/backend-team.md`:

````markdown
# Backend Skill Team

**Trigger**: Assigned a Linear issue tagged `backend`
**Lead Model**: Claude Sonnet 4.6
**Executor Model**: Claude Haiku 4.5
**Owns**: `apps/backend/src/api/` · `apps/backend/src/db/`

---

## BEFORE YOU START

Read in order:

1. `CLAUDE.md` (root) — project rules and locked files
2. `.claude/ARCHITECTURE.md` — system overview
3. `.claude/STANDARDS.md` — code patterns
4. `.claude/TESTING.md` — test commands
5. The Linear issue body (passed to you by orchestrator)

**Locked files — never touch:**

- `apps/backend/src/db/demo_models.py`
- `apps/backend/src/api/routes/demo_auth.py`

**Invariants:**

- All work targets `ai-updates` branch — NEVER `main` or production
- AU locale: AUD, GST, ATO, BAS, DD/MM/YYYY, AEST/AEDT
- Use Pydantic for all validation
- Use `structlog` for all logging
- Use `httpx` async client for integrations
- Preserve existing API response shapes — add optional fields, remove nothing
- Check `docs/catalogs/ROUTES.md` before adding new routes

---

## WORKFLOW

### Step 1: Parse the issue

From the Linear issue extract:

- **Title**: what to build
- **Acceptance criteria**: testable checklist
- **Effort estimate**: scope check
- **Teams assigned**: confirm `backend` is listed

### Step 2: Create worktree

```bash
git worktree add ".claude/worktrees/<branch-name>" -b feat/linear-<issue-id>-<slug>
```

### Step 3: Plan the migration (if schema change)

If the issue requires a DB schema change:

1. Check `supabase/migrations/` for existing pattern
2. Write the migration SQL first, get review before proceeding
3. Test migration on local Supabase (`supabase db push`)

### Step 4: Dispatch executor subagent (Haiku 4.5)

Provide the executor with:

- Full Linear issue body
- Exact acceptance criteria
- Migration SQL (if applicable)
- File paths to modify
- Instruction to write failing tests first (TDD)
- Instruction to run `cd apps/backend && uv run pytest` after each change

### Step 5: Review

After executor reports DONE:

1. Run `cd apps/backend && uv run pytest` — all tests pass
2. Run `pnpm turbo run type-check` — zero errors
3. Check each acceptance criterion is met
4. Verify AU compliance (GST, BAS, ATO where applicable)
5. Dispatch code quality reviewer

### Step 6: PR

```bash
gh pr create \
  --title "feat(backend): <issue title>" \
  --body "Closes <Linear issue URL>

## Changes
<bullet list>

## Migration
<SQL or 'none'>

## Test plan
<how to verify>"
```

---

## QUALITY GATES

Before any PR:

- [ ] `cd apps/backend && uv run pytest` — all pass
- [ ] `pnpm turbo run type-check` — zero errors
- [ ] Locked files untouched
- [ ] Existing API response shapes preserved
- [ ] AU locale correct (AUD, GST, ATO where applicable)
- [ ] `structlog` used for logging (not print/logging.info)
- [ ] Pydantic validation on all inputs
- [ ] `docs/catalogs/ROUTES.md` updated if new routes added
````

- [ ] **Step 2: Commit**

```bash
git add ".claude/agents/skill-teams/backend-team.md"
git commit -m "feat(enhancement): add backend skill team agent — Phase 4"
```

---

### Task 3: AI Skill Team Agent

**Files:**

- Create: `.claude/agents/skill-teams/ai-team.md`

- [ ] **Step 1: Write ai-team.md**

Create `.claude/agents/skill-teams/ai-team.md`:

````markdown
# AI Skill Team

**Trigger**: Assigned a Linear issue tagged `ai`
**Lead Model**: Claude Sonnet 4.6
**Executor Model**: Claude Haiku 4.5
**Owns**: `apps/backend/src/ai/**`

---

## BEFORE YOU START

Read in order:

1. `CLAUDE.md` (root) — project rules and locked files
2. `.claude/ARCHITECTURE.md` — system overview
3. `docs/catalogs/AGENTS.md` — existing agent definitions
4. `.claude/STANDARDS.md` — code patterns
5. `.claude/TESTING.md` — test commands
6. The Linear issue body

**Invariants:**

- All work targets `ai-updates` branch — NEVER `main` or production
- Every new agent MUST have an AgentCard in `apps/backend/src/ai/protocol/cards/__init__.py`
- Every new agent MUST extend BaseAgent from `apps/backend/src/ai/base_agent.py`
- Use `structlog` for all logging
- Confidence scores 0.0–1.0 — escalate below threshold per AgentCard definition
- AU locale: AUD, GST, ATO where calculations are involved

---

## WORKFLOW

### Step 1: Parse the issue

Extract:

- **Title**: what agent/feature to build
- **Acceptance criteria**: testable checklist
- **Agent name** (if new agent): derive `agent_id` as snake_case

### Step 2: Check existing agents

```bash
grep -r "class.*BaseAgent" apps/backend/src/ai/ --include="*.py" -l
```

Understand existing patterns before writing new code.

### Step 3: Create worktree

```bash
git worktree add ".claude/worktrees/<branch-name>" -b feat/linear-<issue-id>-<slug>
```

### Step 4: Dispatch executor subagent (Haiku 4.5)

Provide:

- Full Linear issue body
- Exact acceptance criteria
- Relevant existing agent files (read and pass as context)
- BaseAgent source (`apps/backend/src/ai/base_agent.py`)
- AgentCard pattern (`apps/backend/src/ai/protocol/cards/__init__.py`)
- Instruction: write failing tests first, implement minimal code, then verify

### Step 5: Review

1. Run `cd apps/backend && uv run pytest apps/backend/tests/` — all pass
2. Verify AgentCard is registered in `ALL_CARDS` dict
3. Verify agent extends BaseAgent correctly
4. Check `docs/catalogs/AGENTS.md` is updated
5. Dispatch code quality reviewer

### Step 6: PR

```bash
gh pr create \
  --title "feat(ai): <issue title>" \
  --body "Closes <Linear issue URL>

## Agent
<agent_id> · Permission: <level>

## Changes
<bullet list>

## Test plan
<how to verify>"
```

---

## QUALITY GATES

Before any PR:

- [ ] `cd apps/backend && uv run pytest` — all pass
- [ ] New agent has AgentCard registered in ALL_CARDS
- [ ] AgentCard has ≥ 1 DelegationRule
- [ ] AgentCard has CONFIDENCE_LOW escalation trigger
- [ ] `docs/catalogs/AGENTS.md` updated
- [ ] Locked files untouched
````

- [ ] **Step 2: Commit**

```bash
git add ".claude/agents/skill-teams/ai-team.md"
git commit -m "feat(enhancement): add AI skill team agent — Phase 4"
```

---

### Task 4: Integration Skill Team Agent

**Files:**

- Create: `.claude/agents/skill-teams/integration-team.md`

- [ ] **Step 1: Write integration-team.md**

Create `.claude/agents/skill-teams/integration-team.md`:

````markdown
# Integration Skill Team

**Trigger**: Assigned a Linear issue tagged `integration` or platform labels (`xero`, `cin7`, `shopify`, `stripe`)
**Lead Model**: Claude Sonnet 4.6
**Executor Model**: Claude Haiku 4.5
**Owns**: `apps/backend/src/integrations/**`

---

## BEFORE YOU START

Read in order:

1. `CLAUDE.md` (root) — project rules and locked files
2. `.claude/ARCHITECTURE.md` — system overview
3. `.claude/STANDARDS.md` — code patterns
4. The Linear issue body

**Invariants:**

- All work targets `ai-updates` branch — NEVER `main` or production
- Use `httpx` async client for all external API calls
- Use `structlog` for all logging
- Use Pydantic for all external API response models
- NEVER hardcode credentials — use environment variables
- Sandbox only — use test/sandbox API keys, never production credentials
- AU locale: AUD, GST, ATO, BAS throughout

---

## WORKFLOW

### Step 1: Parse the issue

Extract:

- **Platform**: Xero | Cin7 | Shopify | Stripe | Shipping-TBD
- **Gap being closed**: what the integration currently lacks
- **Acceptance criteria**: testable checklist
- **AU compliance check**: GST/BAS/ATO flags in criteria?

### Step 2: Read existing integration

```bash
ls apps/backend/src/integrations/
```

Read the relevant integration file before writing any code.

### Step 3: Create worktree

```bash
git worktree add ".claude/worktrees/<branch-name>" -b feat/linear-<issue-id>-<slug>
```

### Step 4: Dispatch executor subagent (Haiku 4.5)

Provide:

- Full Linear issue body
- Exact acceptance criteria
- Existing integration file content (read and pass)
- Platform API reference (if linked in issue)
- Instruction: write failing tests first using httpx MockTransport or respx, never hit live API in tests
- Instruction: run `cd apps/backend && uv run pytest` after each change

### Step 5: Review

1. Run `cd apps/backend && uv run pytest` — all pass
2. Verify no live API calls in tests (use mocks)
3. Verify AU compliance items in criteria are addressed
4. Verify no hardcoded credentials
5. Dispatch code quality reviewer

### Step 6: PR

```bash
gh pr create \
  --title "feat(integration): <platform> — <issue title>" \
  --body "Closes <Linear issue URL>

## Platform
<Xero | Cin7 | Shopify | Stripe>

## Gap closed
<one sentence>

## AU compliance
<GST/BAS/ATO items addressed or 'n/a'>

## Test plan
<how to verify in sandbox>"
```

---

## QUALITY GATES

Before any PR:

- [ ] `cd apps/backend && uv run pytest` — all pass
- [ ] No live API calls in tests
- [ ] No hardcoded credentials
- [ ] `httpx` async client used (not requests)
- [ ] Pydantic models for all external API responses
- [ ] AU locale correct (AUD, GST, ATO)
- [ ] Locked files untouched
````

- [ ] **Step 2: Commit**

```bash
git add ".claude/agents/skill-teams/integration-team.md"
git commit -m "feat(enhancement): add integration skill team agent — Phase 4"
```

---

### Task 5: Security & QA Skill Team Agent

**Files:**

- Create: `.claude/agents/skill-teams/security-qa-team.md`

- [ ] **Step 1: Write security-qa-team.md**

Create `.claude/agents/skill-teams/security-qa-team.md`:

````markdown
# Security & QA Skill Team

**Trigger**: Reviews ALL PRs before merge — cross-cutting, not domain-specific
**Lead Model**: Claude Opus 4.6
**Executor Model**: Claude Sonnet 4.6
**Owns**: Cross-cutting security, RLS, auth, data integrity across all domains

---

## BEFORE YOU START

Read in order:

1. `CLAUDE.md` (root) — project rules and locked files
2. `.claude/ARCHITECTURE.md` — system overview (focus: auth, RLS, data boundaries)
3. `.claude/STANDARDS.md` — code patterns
4. `.claude/memory/CONSTITUTION.md` — immutable prohibitions

**Invariants:**

- NEVER approve a PR that touches locked files
- NEVER approve a PR that introduces hardcoded credentials
- NEVER approve a PR that weakens RLS or bypasses auth
- NEVER approve a PR that removes existing test coverage
- AU privacy law applies: no PII logging, no unencrypted AU personal data at rest

---

## REVIEW CHECKLIST

Run this checklist on every PR diff before approving:

### Security

- [ ] No hardcoded secrets, tokens, passwords, or API keys
- [ ] No new SQL that bypasses RLS (`security definer` must be justified)
- [ ] Auth checks present on all new API routes (not anonymous)
- [ ] Input validation present (Pydantic backend, Zod frontend)
- [ ] No XSS vectors in new frontend code (no dangerouslySetInnerHTML)
- [ ] No SQL injection — parameterised queries only
- [ ] Environment variables used for all external credentials

### Locked files

- [ ] `apps/backend/src/db/demo_models.py` — untouched
- [ ] `apps/web/middleware.ts` — untouched
- [ ] `apps/backend/src/api/routes/demo_auth.py` — untouched

### AU Compliance

- [ ] GST calculations correct (10% on applicable lines)
- [ ] ATO/BAS fields present where required
- [ ] Date formats DD/MM/YYYY in all user-facing output
- [ ] No US locale slipping in (MM/DD/YYYY, USD, etc.)
- [ ] AU privacy: no PII in logs, no unencrypted personal data

### Test coverage

- [ ] New functionality has tests (unit or integration)
- [ ] No existing tests deleted without justification
- [ ] Happy path + at least one failure path covered

### Code quality

- [ ] No dead code introduced
- [ ] No commented-out code blocks
- [ ] Error handling present (no bare `except:` or `.catch(() => {})`)
- [ ] Logging uses `structlog` (backend) — no `print()` statements

---

## WORKFLOW

### Step 1: Read the PR diff

```bash
gh pr diff <PR-number>
```

### Step 2: Run the full checklist

Document each item as PASS / FAIL / N/A with a one-line note.

### Step 3: Decision

**APPROVE**: All security items PASS. Minor quality issues can be noted as suggestions.

**REQUEST CHANGES**: Any security item FAILS, or any locked file touched, or AU compliance violated. Be specific — quote the exact line and explain the fix required.

### Step 4: Post review

```bash
gh pr review <PR-number> --approve   # or
gh pr review <PR-number> --request-changes --body "..."
```

### Step 5: After approval

Merge the PR to `ai-updates` only after:

1. All CI checks pass
2. Both the originating skill team lead AND Security & QA have approved

---

## ESCALATION

If a finding is unclear (e.g. "Is this RLS bypass intentional?"):

1. Post a PR comment asking the skill team lead for context
2. Do NOT block indefinitely — allow 24 hours then escalate to Phill
3. Log the escalation to `.claude/memory/enhancement-program/decisions/audit-trail.md`
````

- [ ] **Step 2: Commit**

```bash
git add ".claude/agents/skill-teams/security-qa-team.md"
git commit -m "feat(enhancement): add Security & QA skill team agent — Phase 4"
```

---

### Task 6: End-to-End Smoke Test

**Goal**: Inject a synthetic low-stakes finding, trace it through every phase of the enhancement pipeline (research → triage → board → Linear issue), and confirm each handoff works.

**Files:**

- Create: `.claude/memory/enhancement-program/research/smoke-test-finding.md`

- [ ] **Step 1: Verify all prerequisite files exist**

Run each check — all must return a result:

```bash
# Phase 1 files
test -f ".claude/memory/enhancement-program/status.md" && echo "✅ status.md" || echo "❌ status.md MISSING"
test -f ".claude/memory/enhancement-program/decisions/audit-trail.md" && echo "✅ audit-trail.md" || echo "❌ MISSING"
test -f ".claude/memory/enhancement-program/triage/scored-findings.md" && echo "✅ scored-findings.md" || echo "❌ MISSING"
test -f ".claude/memory/enhancement-program/board/deliberations.md" && echo "✅ deliberations.md" || echo "❌ MISSING"
test -f ".claude/skills/enhancement-program/SKILL.md" && echo "✅ orchestrator SKILL.md" || echo "❌ MISSING"

# Phase 2 files — spot-check 3 researchers
test -f ".claude/agents/researchers/vertical/orders-quotes.md" && echo "✅ orders-quotes researcher" || echo "❌ MISSING"
test -f ".claude/agents/researchers/horizontal/xero.md" && echo "✅ xero researcher" || echo "❌ MISSING"
test -f ".claude/agents/researchers/horizontal/cin7.md" && echo "✅ cin7 researcher" || echo "❌ MISSING"

# Phase 3 files
test -f ".claude/agents/triage-agent.md" && echo "✅ triage-agent.md" || echo "❌ MISSING"
test -f ".claude/skills/linear-issue-creator/SKILL.md" && echo "✅ linear-issue-creator SKILL.md" || echo "❌ MISSING"

# Phase 4 files
test -f ".claude/agents/skill-teams/frontend-team.md" && echo "✅ frontend-team" || echo "❌ MISSING"
test -f ".claude/agents/skill-teams/backend-team.md" && echo "✅ backend-team" || echo "❌ MISSING"
test -f ".claude/agents/skill-teams/ai-team.md" && echo "✅ ai-team" || echo "❌ MISSING"
test -f ".claude/agents/skill-teams/integration-team.md" && echo "✅ integration-team" || echo "❌ MISSING"
test -f ".claude/agents/skill-teams/security-qa-team.md" && echo "✅ security-qa-team" || echo "❌ MISSING"
```

Expected: All lines print ✅. Fix any ❌ before continuing.

- [ ] **Step 2: Create synthetic smoke-test finding**

Create `.claude/memory/enhancement-program/research/smoke-test-finding.md`:

```markdown
# Smoke Test Finding — SYNTHETIC (do not route to board)

**Domain**: Settings & Security
**Finding ID**: SMOKE-001
**Researcher**: synthetic (smoke test)
**Date**: 2026-04-14

## Gap Description

The Settings page (`/settings/general`) does not display the business's AU timezone
(AEST/AEDT) in the UI, defaulting to UTC. Staff scheduling daily cron jobs (e.g.
nightly Xero sync) manually compensate, which has caused off-by-one-day errors in
BAS reporting twice in the past quarter.

## Evidence

- `apps/web/app/(dashboard)/settings/general/page.tsx` — no timezone field rendered
- `apps/backend/src/api/routes/settings.py` — `GET /settings` response lacks `timezone` field

## Suggested Fix

Add `timezone: "Australia/Sydney"` to the settings model, expose it on the API,
and render a read-only display (editable by admin) on the Settings page.

## Smoke Test Metadata

This finding is **synthetic** — it exists only to validate the triage pipeline.
Triage agent: score this as you normally would (expected ~55–65/100).
Board: deliberate normally (expected APPROVE).
Linear: create the issue — label it `smoke-test` so it can be identified and closed.
```

- [ ] **Step 3: Run triage agent on smoke-test finding**

Dispatch the triage agent (`.claude/agents/triage-agent.md`) with:

- The smoke-test finding above (pass full content)
- The scoring matrix from the design spec
- Instruction to append its scored output to `.claude/memory/enhancement-program/triage/scored-findings.md`

Verify the output contains:

```bash
grep "SMOKE-001" ".claude/memory/enhancement-program/triage/scored-findings.md"
```

Expected: Line containing SMOKE-001 and a score between 40–75.

- [ ] **Step 4: Run board deliberation on smoke-test finding**

Dispatch all 6 board members (`.claude/agents/ceo-board-member.md` etc.) in parallel with:

- The scored smoke-test finding
- Instruction to deliberate in "Enhancement Deliberation Mode"
- Instruction to write verdict to `.claude/memory/enhancement-program/board/deliberations.md`

Verify:

```bash
grep "SMOKE-001" ".claude/memory/enhancement-program/board/deliberations.md"
```

Expected: Line containing SMOKE-001 and UNANIMOUS or APPROVED.

- [ ] **Step 5: Create Linear issue for smoke-test finding**

Use the linear-issue-creator skill (`.claude/skills/linear-issue-creator/SKILL.md`) to create a Linear issue for SMOKE-001 with:

- Title: `[Smoke Test] Settings — Add AEST/AEDT timezone display`
- Label: `smoke-test`
- Priority: Medium (score 50–74)
- Team: CCW ERP

Verify:

```bash
# The skill writes the Linear issue URL to the triage/scored-findings.md
grep "linear" ".claude/memory/enhancement-program/triage/scored-findings.md" -i
```

Expected: A Linear issue URL appears in the output.

- [ ] **Step 6: Verify status.md was updated throughout**

```bash
cat ".claude/memory/enhancement-program/status.md"
```

Expected: status.md shows Phase → COMPLETE (or BOARD/LINEAR if partially run), timestamps present, SMOKE-001 visible in at least one section.

- [ ] **Step 7: Update audit trail**

Append to `.claude/memory/enhancement-program/decisions/audit-trail.md`:

```markdown
## [2026-04-14] smoke-test — SMOKE-001 — Settings timezone display

Phase 4 end-to-end smoke test. Synthetic finding injected, traced through triage → board → Linear.
Score: [actual score from Step 3]
Board: UNANIMOUS (Round 1)
Linear: [issue URL from Step 5]
Result: PASS — all pipeline handoffs verified.
```

- [ ] **Step 8: Final commit**

```bash
git add .claude/memory/enhancement-program/research/smoke-test-finding.md
git add .claude/memory/enhancement-program/
git commit -m "test(enhancement): Phase 4 end-to-end smoke test — pipeline verified SMOKE-001"
```

---

**Phase 4 complete when:** All 5 skill team agent files exist, smoke test SMOKE-001 has been scored by triage, approved by board, and a Linear issue created with `smoke-test` label.

**Enhancement Program setup complete.** Run `/enhance` to start the first full research cycle.
