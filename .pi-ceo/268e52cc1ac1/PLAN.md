# Implementation Plan

**Session:** 268e52cc1ac1  
**Confidence:** 42%

**Risk notes:** No specific bug description was provided in the brief — only 'BUG — Bug Fix'. Plan assumes the bug lives in the FastAPI backend routes or Next.js frontend data-fetching layer, which are the highest-churn areas in this monorepo. Unit 1 (reproduce) is critical gating: if the bug is in a locked file (demo_models.py, middleware.ts, demo_auth.py), the fix must be filed as a NEW TICKET per standing authority. Dashboard JSON files (agg-success.json, aggregated-*.json) suggest a possible data aggregation bug; if confirmed, Unit 2 should focus on apps/backend/src/api/routes/ aggregation endpoints. Confidence is low solely due to ambiguous bug specification — the workflow structure is sound for any FastAPI + Next.js defect.

## Unit 1: Reproduce & Identify Failure Condition
**Files:** `apps/backend/src/api/main.py`, `apps/backend/src/api/routes/`, `apps/web/src/lib/api/client.ts`, `.claude/PROGRESS.md`
**Test scenarios:**
  - happy path: identify the exact request/response cycle that fails
  - edge case: reproduce under both authenticated and unauthenticated states
  - edge case: reproduce with minimal payload to isolate the failure

## Unit 2: Diagnose Root Cause — Backend API / Data Layer
**Files:** `apps/backend/src/api/routes/`, `apps/backend/src/db/models.py`, `apps/backend/src/api/dependencies.py`, `apps/backend/src/agents/`
**Test scenarios:**
  - happy path: backend route returns expected shape with valid input
  - edge case: route handles missing/null fields without 500
  - edge case: Pydantic validation rejects malformed payloads with 422 not 500

## Unit 3: Diagnose Root Cause — Frontend Data Fetching / Type Mismatch
**Files:** `apps/web/src/lib/api/client.ts`, `apps/web/src/hooks/`, `apps/web/src/app/api/`, `apps/web/src/types/`
**Test scenarios:**
  - happy path: apiClient receives expected shape and renders without error
  - edge case: Zod schema rejects unexpected backend response shape
  - edge case: loading and error states handled correctly in hooks

## Unit 4: Apply Minimal Targeted Fix
**Files:** `apps/backend/src/api/routes/`, `apps/web/src/lib/api/client.ts`, `apps/web/src/hooks/`
**Test scenarios:**
  - happy path: fix resolves the reproduced failure condition end-to-end
  - edge case: fix does not regress adjacent routes or components
  - edge case: existing Pydantic/Zod schemas remain compatible after fix

## Unit 5: Run Type-Check, Lint, and Relevant Tests
**Files:** `apps/backend/tests/`, `apps/web/src/__tests__/`, `apps/web/vitest.config.ts`, `apps/backend/pyproject.toml`
**Test scenarios:**
  - happy path: pnpm turbo run type-check exits zero errors
  - happy path: relevant pytest scope passes for changed backend modules
  - edge case: no new TypeScript errors introduced by fix

## Unit 6: Commit Fix with Conventional Commit Message
**Files:** `.claude/PROGRESS.md`
