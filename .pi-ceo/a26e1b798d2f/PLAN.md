# Implementation Plan

**Session:** a26e1b798d2f  
**Confidence:** 38%

**Risk notes:** No specific bug was identified in the brief — plan assumes a typical backend API or frontend API-client regression common to this FastAPI + Next.js stack. Actual files to fix depend on the concrete failure; units 2-4 may narrow to a single layer once reproduction is complete. Locked files (demo_models.py, middleware.ts, demo_auth.py) must not be modified — if the bug traces to those, a NEW TICKET row in PROGRESS.md is required. Confidence is low until the specific bug is identified.

## Unit 1: Reproduce & Diagnose: Identify exact failure condition
**Files:** `apps/backend/src/api/main.py`, `apps/backend/src/api/routes/`, `.claude/PROGRESS.md`, `apps/web/app/api/`
**Test scenarios:**
  - happy path: reproduce the reported failure with minimal steps
  - edge case: verify failure is consistent across dev and prod configs

## Unit 2: Trace root cause in backend API layer
**Files:** `apps/backend/src/api/routes/`, `apps/backend/src/db/models.py`, `apps/backend/src/api/dependencies.py`
**Test scenarios:**
  - happy path: confirm correct route/model interaction before fix
  - edge case: check error handling for null/missing fields in Pydantic schemas

## Unit 3: Apply targeted backend fix
**Files:** `apps/backend/src/api/routes/`, `apps/backend/src/db/models.py`
**Test scenarios:**
  - happy path: fix resolves the failure without breaking existing endpoints
  - edge case: validate Pydantic schema still rejects invalid payloads

## Unit 4: Apply targeted frontend fix if applicable
**Files:** `apps/web/lib/api/client.ts`, `apps/web/hooks/`, `apps/web/components/`
**Test scenarios:**
  - happy path: apiClient correctly handles updated response shape
  - edge case: error states and loading states render correctly after fix

## Unit 5: Run type-check and test suite to verify no regressions
**Files:** `apps/backend/tests/`, `apps/web/src/__tests__/`
**Test scenarios:**
  - happy path: pnpm turbo run type-check returns zero errors
  - edge case: uv run pytest passes all backend test cases post-fix

## Unit 6: Commit fix with conventional commit message
**Files:** `.claude/PROGRESS.md`
