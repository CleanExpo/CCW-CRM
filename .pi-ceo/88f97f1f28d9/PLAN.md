# Implementation Plan

**Session:** 88f97f1f28d9  
**Confidence:** 35%

**Risk notes:** Brief specifies 'BUG — Bug Fix' with no description of the specific bug, affected endpoint, error message, or reproduction steps. Plan assumes a backend FastAPI route defect (most common failure mode in this stack) with a possible frontend apiClient symptom. All file paths are inferred from repo structure context. Actual root cause may be in a completely different layer (e.g. RLS policy, middleware, Supabase edge function, or Next.js server action). Confidence is low until the specific bug is identified in Unit 1 reproduction step. Locked files (demo_models.py, middleware.ts, demo_auth.py) are excluded from fix scope per CLAUDE.md.

## Unit 1: Reproduce & Triage — Identify Exact Failure Condition
**Files:** `apps/backend/src/api/main.py`, `apps/backend/src/api/routes`, `apps/web/src/lib/api/client.ts`
**Test scenarios:**
  - happy path: request to affected endpoint returns expected response shape
  - edge case: malformed or missing payload triggers correct 422 validation error
  - edge case: unauthenticated request returns 401, not 500

## Unit 2: Diagnose — Trace Root Cause via Logs and Recent Changes
**Files:** `apps/backend/src/api/routes`, `apps/backend/src/db/models.py`, `apps/backend/src/services`
**Test scenarios:**
  - happy path: structlog output shows correct flow with no unhandled exception
  - edge case: null/None field in Pydantic model does not bypass validation

## Unit 3: Fix — Apply Minimal Targeted Backend Fix
**Files:** `apps/backend/src/api/routes`, `apps/backend/src/services`, `apps/backend/src/db/models.py`
**Test scenarios:**
  - happy path: fixed endpoint returns correct response with all required fields
  - edge case: fix does not regress adjacent endpoints in same router
  - edge case: Pydantic schema change is backward-compatible (no removed fields)

## Unit 4: Fix — Apply Minimal Targeted Frontend Fix if Required
**Files:** `apps/web/src/lib/api/client.ts`, `apps/web/src/hooks`, `apps/web/src/components`
**Test scenarios:**
  - happy path: frontend apiClient receives corrected response and renders without error
  - edge case: loading and error states are handled correctly in affected hook

## Unit 5: Verify — Run Regression Suite and Type-Check
**Files:** `apps/backend/tests`, `apps/web/src/__tests__`
**Test scenarios:**
  - happy path: pnpm turbo run type-check exits 0
  - happy path: uv run pytest passes all existing backend tests
  - edge case: no new TypeScript errors introduced by frontend changes

## Unit 6: Commit — Conventional Commit with fix: prefix
**Files:** `apps/backend/src/api/routes`, `apps/web/src`
