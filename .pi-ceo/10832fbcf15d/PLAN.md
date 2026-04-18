# Implementation Plan

**Session:** 10832fbcf15d  
**Confidence:** 52%

**Risk notes:** Exact file paths for Xero integration are inferred from FastAPI monorepo conventions — actual paths may differ (e.g. xero_client.py, xero_service.py). The bug brief is not explicitly described; all diagnosis is derived from lessons-learned entries citing force_update NameError and unreachable update path. If the Xero integration lives under a different module (e.g. apps/backend/src/agents/ or a third-party wrapper), unit IDs 1-4 file lists must be adjusted. Test file paths assume a tests/integrations/ directory exists; if not, tests/test_xero*.py is the fallback. Confidence is reduced due to ambiguity in the original brief and uncertain file locations.

## Unit 1: Diagnose and fix force_update NameError in Xero sync
**Files:** `apps/backend/src/integrations/xero.py`, `apps/backend/src/services/xero_sync.py`, `apps/backend/src/api/routes/xero.py`
**Test scenarios:**
  - happy path: sync contact where force_update=True triggers update branch without NameError
  - edge case: sync contact where force_update=False skips update branch correctly
  - edge case: sync with missing contact ID still raises appropriate error, not NameError

## Unit 2: Fix unreachable update-existing-Xero-contact code path
**Files:** `apps/backend/src/integrations/xero.py`, `apps/backend/src/services/xero_sync.py`
**Test scenarios:**
  - happy path: existing Xero contact ID found in DB triggers PUT/update branch
  - happy path: new contact with no existing Xero ID triggers POST/create branch
  - edge case: contact lookup returns None — falls back to create rather than crashing

## Unit 3: Add unit tests for Xero sync service covering both code paths
**Files:** `apps/backend/tests/integrations/test_xero_sync.py`, `apps/backend/tests/integrations/test_xero.py`
**Test scenarios:**
  - happy path: mock Xero API returns 200 on create — contact saved with xero_id
  - happy path: mock Xero API returns 200 on update — contact record updated in DB
  - edge case: Xero API 409 conflict handled gracefully — retry or skip logged
  - edge case: force_update flag correctly threads through to API call

## Unit 4: Verify and fix Xero API route registration and response shape
**Files:** `apps/backend/src/api/routes/xero.py`, `apps/backend/src/api/main.py`
**Test scenarios:**
  - happy path: POST /xero/sync returns 200 with expected JSON shape
  - edge case: POST /xero/sync with invalid payload returns 422 Pydantic validation error

## Unit 5: Run type-check and confirm zero errors after fix
**Files:** `apps/backend/src/integrations/xero.py`, `apps/backend/src/services/xero_sync.py`, `apps/backend/src/api/routes/xero.py`
