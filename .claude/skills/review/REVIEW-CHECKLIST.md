# SKILL: Pre-PR Review Checklist (UNI-1742)

**When to use**: Before requesting any PR review. Run through this checklist to catch obvious issues before dispatching to specialist reviewers.

## Mandatory Checklist

### TypeScript
```bash
npx tsc --noEmit 2>&1
# Must exit 0 with zero errors
```
- [ ] Zero TypeScript errors
- [ ] No `any` types introduced
- [ ] All new functions have return types

### Linting
```bash
pnpm turbo run lint 2>&1
# Must exit 0
```
- [ ] Zero ESLint errors
- [ ] Zero ESLint warnings (or documented exceptions)

### Tests
```bash
pnpm turbo run test 2>&1
# All tests must pass
```
- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] New tests pass

### Security
```bash
node scripts/ci/scan-secrets.js
```
- [ ] No hardcoded API keys, tokens, or passwords
- [ ] No connection strings with credentials
- [ ] No `.env` files staged

### Architecture
- [ ] No modifications to `middleware.ts` (locked)
- [ ] No modifications to `demo_auth.py` (locked)
- [ ] No modifications to `demo_models.py` (requires explicit approval)
- [ ] No cross-layer imports
- [ ] New tables have RLS enabled

### PR Size
```bash
git diff --stat develop...HEAD
```
- [ ] < 500 lines (clean, < 200 ideal)
- [ ] If > 500 lines: can this be split into smaller PRs?
- [ ] Hard limit: never > 1000 lines

### Linear Issue
- [ ] PR references the Linear issue (UNI-XXXX)
- [ ] Linear issue status updated to "In Review"
- [ ] Acceptance criteria met (check the issue)

### Documentation
- [ ] New routes added to `docs/catalogs/ROUTES.md`
- [ ] New models added to `docs/catalogs/MODELS.md`
- [ ] New integrations documented in `docs/catalogs/INTEGRATIONS.md`
- [ ] Vault synced: `python scripts/vault-generator.py --incremental`

## Only when ALL boxes are checked: dispatch to @review-orchestrator
