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
