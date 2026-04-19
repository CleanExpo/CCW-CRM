# Implementation Plan

**Session:** a276d3d7699e  
**Confidence:** 20%

**Risk notes:** Brief states 'BUG — Bug Fix' but does not identify the specific bug, affected file, or reproduction steps. Plan assumes the bug lives in the FastAPI backend routes or Next.js frontend hooks/components — the most common failure surfaces in this stack. If the bug is in a locked file (demo_models.py, middleware.ts, demo_auth.py), the fix must be filed as a NEW TICKET in PROGRESS.md and skipped. Unit 1 (diagnosis) must resolve the ambiguity before Units 2–3 can target the correct files. Confidence will rise significantly once the specific bug is identified in Unit 1.

## Unit 1: Reproduce & Diagnose — Identify failure condition from logs and recent commits
**Files:** `apps/backend/src/api/main.py`, `apps/backend/src/api/routes/`, `.claude/PROGRESS.md`
**Test scenarios:**
  - happy path: identify exact endpoint or component that is broken
  - edge case: confirm regression is not introduced by a locked file (demo_models.py, middleware.ts, demo_auth.py)

## Unit 2: Backend Fix — Patch FastAPI route, Pydantic model, or service layer
**Files:** `apps/backend/src/api/routes/`, `apps/backend/src/db/models.py`, `apps/backend/src/services/`
**Test scenarios:**
  - happy path: fixed endpoint returns correct status code and response shape
  - edge case: invalid input still returns 422 Unprocessable Entity
  - edge case: no existing response fields removed (backward compatibility preserved)

## Unit 3: Frontend Fix — Patch React hook, API client call, or UI component
**Files:** `apps/web/src/lib/api/client.ts`, `apps/web/src/hooks/`, `apps/web/src/components/`
**Test scenarios:**
  - happy path: UI displays correct data after fix
  - edge case: loading and error states render without crash
  - edge case: Zod schema still validates API response after shape change

## Unit 4: Run Type-Check & Tests — Verify zero regressions
**Files:** `apps/backend/tests/`, `apps/web/src/__tests__/`
**Test scenarios:**
  - happy path: pnpm turbo run type-check exits 0
  - happy path: uv run pytest passes all existing backend tests
  - edge case: no new TypeScript errors introduced

## Unit 5: Commit — Stage fix with conventional commit message
