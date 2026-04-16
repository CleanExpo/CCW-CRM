# CCW Production Merge Pathway (UNI-1743)

**Last updated**: 2026-03-31
**Owner**: Phill McGurk (CEO)
**Applies to**: All code changes targeting the `main` branch (Vercel production)

---

## Overview

Every change follows: `feature/fix branch → develop → main`

No direct commits to `main`. No exceptions.

---

## Branch Strategy

```
main          ← production (Vercel auto-deploys from this)
develop       ← integration branch (staging)
feature/<n>   ← new features (from develop)
fix/<n>       ← bug fixes (from develop)
hotfix/<n>    ← critical production fixes (from main)
```

---

## Stage 1: Feature/Fix → Develop

### Pre-conditions

- Branch is current with develop
- All acceptance criteria in Linear issue are met
- No TypeScript errors (npx tsc --noEmit)
- No lint errors (pnpm turbo run lint)
- All tests pass (pnpm turbo run test)
- Secrets scan clean (node scripts/ci/scan-secrets.js)
- PR size < 1000 lines

### Steps

1. Request code review: @review-orchestrator review [branch]
2. Address all CRITICAL/HIGH findings
3. Obtain SHIP verdict from Review Orchestrator
4. Create PR to develop using .github/PULL_REQUEST_TEMPLATE.md
5. CI must pass (boardroom-ci.yml: test + validate + security)
6. Merge (squash merge preferred for clean history)
7. Update Linear issue to Done

---

## Stage 2: Develop → Main (Release)

Release frequency: **weekly** (Monday morning, AEDT)

### Release Preparation

1. Ensure develop is stable (all tests green, no open CRITICAL issues)
2. Generate release notes:
   node scripts/lib/release-manager.js getChangesSinceLastRelease
3. Generate version: vYYYY.MM.DD.1

### Required Approvals (develop → main)

1. CEO (@phillmcgurk) — mandatory sign-off
2. Review Orchestrator — automated SHIP verdict
3. CI gates — all passing

### Post-Merge

- Tag release: node -e "require('./scripts/lib/release-manager').tagRelease('vX.X.X')"
- Vercel auto-deploys main to production
- Run production smoke test (docs/production-smoke-test.md)

---

## Stage 3: Hotfix (Emergency)

For CRITICAL bugs in production only.
Requires CSO + CEO approval. Back-port to develop immediately after.

---

## Related Docs

- .github/PULL_REQUEST_TEMPLATE.md — PR template
- docs/production-smoke-test.md — post-deploy verification
- docs/PRODUCTION_RUNBOOK.md — incident response
- scripts/lib/release-manager.js — release automation
