## Summary

<!-- What changed and why? 2-3 bullet points max -->
-
-

## Linear Issue

<!-- Required: UNI-XXXX -->
Closes UNI-

## Type of Change

- [ ] feat — new feature
- [ ] fix — bug fix
- [ ] security — security improvement
- [ ] refactor — code restructure (no behaviour change)
- [ ] perf — performance improvement
- [ ] docs — documentation only
- [ ] chore — build/config/dependency update

## Test Plan

<!-- How was this tested? -->
- [ ] Unit tests added/updated
- [ ] Manual testing performed (describe steps below)

Steps to verify:
1.
2.

## Screenshots (UI changes only)

<!-- Add before/after screenshots for any UI changes -->

## Pre-merge Checklist

- [ ] `npx tsc --noEmit` — zero TypeScript errors
- [ ] `pnpm run lint` — zero lint errors
- [ ] `pnpm run test` — all tests passing
- [ ] `node scripts/ci/scan-secrets.js` — no hardcoded secrets
- [ ] PR size < 500 lines (or justified in summary)
- [ ] Linear issue references included
- [ ] No modifications to locked files (middleware.ts, demo_auth.py, demo_models.py)
- [ ] New tables have RLS enabled
- [ ] Review Orchestrator verdict: SHIP

## For Release PRs (develop → main) only

- [ ] CEO (@phillmcgurk) approval obtained
- [ ] Release notes generated
- [ ] Version tagged after merge
