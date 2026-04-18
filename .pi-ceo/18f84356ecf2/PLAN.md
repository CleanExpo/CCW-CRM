# Implementation Plan

**Session:** 18f84356ecf2  
**Confidence:** 35%

**Risk notes:** The brief specifies 'BUG — Bug Fix' but does not identify which bug, which file, or which user-visible symptom. Plan assumes the most likely failure areas based on repo structure (dashboard API routes, frontend apiClient, backend Pydantic serialization). Actual fix files will shift once the specific bug is reproduced in unit 1. File paths under apps/backend/src/api/routes/ and apps/web/src/hooks/ are best-guess until reproduction confirms the exact location. Confidence is low due to missing bug specification.

## Unit 1: Reproduce & Diagnose — Identify exact failure condition from logs and recent changes
**Files:** `apps/backend/src/api/main.py`, `apps/backend/src/api/routes`, `.claude/PROGRESS.md`
**Test scenarios:**
  - happy path: identify the exact endpoint or component that triggers the bug
  - edge case: check if bug is environment-specific (dev vs prod) or data-specific

## Unit 2: Trace root cause in backend API routes
**Files:** `apps/backend/src/api/routes/dashboard.py`, `apps/backend/src/api/routes/customers.py`, `apps/backend/src/api/routes/orders.py`, `apps/backend/src/db/models.py`
**Test scenarios:**
  - happy path: API route returns correct response shape
  - edge case: null/missing fields do not crash serialization
  - edge case: database query handles empty result set without 500 error

## Unit 3: Trace root cause in frontend API client or hooks
**Files:** `apps/web/src/lib/api/client.ts`, `apps/web/src/hooks`, `apps/web/src/app`
**Test scenarios:**
  - happy path: frontend correctly parses API response
  - edge case: error state is shown instead of crash when API returns non-200
  - edge case: stale data / race condition during concurrent requests

## Unit 4: Apply minimal targeted fix
**Files:** `apps/backend/src/api/routes/dashboard.py`, `apps/web/src/lib/api/client.ts`, `apps/web/src/hooks`
**Test scenarios:**
  - happy path: fix resolves the reported failure without altering existing API response shape
  - edge case: fix does not regress adjacent features

## Unit 5: Run type-check and backend tests to verify no regressions
**Files:** `apps/backend/src/tests`, `apps/web/src`
**Test scenarios:**
  - happy path: pnpm turbo run type-check exits 0
  - happy path: uv run pytest exits 0 with no new failures
  - edge case: no TypeScript errors introduced by the fix

## Unit 6: Commit fix with conventional commit message and update PROGRESS.md
**Files:** `.claude/PROGRESS.md`
