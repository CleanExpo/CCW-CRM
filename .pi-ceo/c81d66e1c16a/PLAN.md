# Implementation Plan

**Session:** c81d66e1c16a  
**Confidence:** 42%

**Risk notes:** The brief says 'BUG — Bug Fix' with no specific description. The only concrete signal is the lessons-learned warning about missing PO/invoice event mappings in event_dispatcher.py, cin7_models.py, and webhooks.py. Plan assumes the bug is the absent Cin7 event dispatch mappings identified in prior lessons. Exact file paths for cin7 integration are inferred from FastAPI conventions — actual paths may differ (e.g. could be apps/backend/src/services/cin7/ or apps/backend/src/agents/cin7/). If the bug is unrelated to Cin7 events, confidence drops to ~0.1 and the plan should be regenerated after reading git log and recent error traces.

## Unit 1: Reproduce & trace Cin7 webhook event dispatch failure
**Files:** `apps/backend/src/integrations/cin7/event_dispatcher.py`, `apps/backend/src/api/routes/webhooks.py`, `apps/backend/src/integrations/cin7/cin7_models.py`
**Test scenarios:**
  - happy path: POST /webhooks/cin7 with a valid PO event payload routes to correct handler without error
  - edge case: unknown event type returns 422 or safe no-op rather than 500
  - edge case: invoice event with missing fields raises a Pydantic validation error before dispatch

## Unit 2: Add missing PO event mappings to event_dispatcher
**Files:** `apps/backend/src/integrations/cin7/event_dispatcher.py`
**Test scenarios:**
  - happy path: PURCHASE_ORDER_CREATED event dispatched to correct handler function
  - happy path: PURCHASE_ORDER_UPDATED event dispatched and state updated
  - edge case: dispatcher raises KeyError if event type not registered — confirm it now returns a structured error

## Unit 3: Add missing invoice event mappings to event_dispatcher
**Files:** `apps/backend/src/integrations/cin7/event_dispatcher.py`
**Test scenarios:**
  - happy path: INVOICE_CREATED event dispatched correctly
  - happy path: INVOICE_PAID event updates invoice status in DB
  - edge case: duplicate invoice event is idempotent (no duplicate DB records)

## Unit 4: Validate Cin7 Pydantic models cover PO and invoice payloads
**Files:** `apps/backend/src/integrations/cin7/cin7_models.py`
**Test scenarios:**
  - happy path: PurchaseOrderEvent model parses full Cin7 PO webhook payload
  - happy path: InvoiceEvent model parses full Cin7 invoice webhook payload
  - edge case: optional fields absent — model still validates without raising

## Unit 5: Write pytest unit tests for event dispatcher and models
**Files:** `apps/backend/tests/integrations/cin7/test_event_dispatcher.py`, `apps/backend/tests/integrations/cin7/test_cin7_models.py`
**Test scenarios:**
  - happy path: all registered event types resolve to non-null handlers
  - happy path: model round-trip for PO and invoice fixtures passes validation
  - edge case: unregistered event type does not crash dispatcher

## Unit 6: Run type-check, pytest, and verify zero regressions
**Files:** `apps/backend/src/integrations/cin7/event_dispatcher.py`, `apps/backend/src/integrations/cin7/cin7_models.py`, `apps/backend/src/api/routes/webhooks.py`

## Unit 7: Commit fix with conventional commit message
**Files:** `apps/backend/src/integrations/cin7/event_dispatcher.py`, `apps/backend/src/integrations/cin7/cin7_models.py`, `apps/backend/tests/integrations/cin7/test_event_dispatcher.py`, `apps/backend/tests/integrations/cin7/test_cin7_models.py`
