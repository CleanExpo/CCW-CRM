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
