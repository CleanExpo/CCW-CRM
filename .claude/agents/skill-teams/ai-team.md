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
- [ ] AgentCard has >= 1 DelegationRule
- [ ] AgentCard has CONFIDENCE_LOW escalation trigger
- [ ] `docs/catalogs/AGENTS.md` updated
- [ ] Locked files untouched
