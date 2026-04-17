# Implementation Plan

**Session:** 2516c21feddc  
**Confidence:** 38%

**Risk notes:** Brief specifies 'BUG — Bug Fix' with no description of the actual bug, affected module, or reproduction steps. Plan assumes the bug is in a backend FastAPI route or frontend apiClient call (most common failure points in this stack). Units 1–2 are diagnostic and will redirect the remaining units once the root cause is known. If the bug is in a locked file (apps/backend/src/db/demo_models.py, apps/web/middleware.ts, apps/backend/src/api/routes/demo_auth.py) the fix must not modify those files per CLAUDE.md constraints. Confidence is low until a concrete bug report or reproduction case is provided.

## Unit 1: Reproduce & Diagnose — identify exact failure condition and root cause
**Files:** `apps/backend/src/api/main.py`, `apps/backend/src/api/routes/`, `apps/web/src/lib/api/client.ts`, `.claude/PROGRESS.md`
**Test scenarios:**
  - happy path: confirmed reproduction steps produce the reported error consistently
  - edge case: failure only occurs under specific auth state or data conditions

## Unit 2: Audit recent git changes for regression introduction
**Files:** `apps/backend/src/api/routes/`, `apps/backend/src/db/`, `apps/web/src/lib/api/client.ts`, `apps/web/src/app/`
**Test scenarios:**
  - happy path: git log and diff isolate the commit that introduced the bug
  - edge case: bug pre-dates recent commits and is a latent logic error

## Unit 3: Fix — apply minimal targeted patch to backend route or frontend client
**Files:** `apps/backend/src/api/routes/`, `apps/backend/src/api/main.py`, `apps/web/src/lib/api/client.ts`
**Test scenarios:**
  - happy path: fix resolves the failure condition without altering API response shape
  - edge case: fix handles null/empty payloads and auth edge cases correctly

## Unit 4: Regression — run backend pytest and frontend vitest for affected scope
**Files:** `apps/backend/tests/`, `apps/web/src/__tests__/`
**Test scenarios:**
  - happy path: all existing tests pass after the fix
  - edge case: no previously passing test is broken by the change

## Unit 5: Type-check & lint gate before commit
**Files:** `apps/web/tsconfig.json`, `apps/backend/pyproject.toml`

## Unit 6: Commit with conventional message and update PROGRESS.md
**Files:** `.claude/PROGRESS.md`
