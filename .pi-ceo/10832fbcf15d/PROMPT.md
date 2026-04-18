# Task Brief

[HIGH] [Shipping] Build multi-carrier API abstraction layer — AusPost, TNT, FedEx and local carriers

Description:
## What's missing

All carrier adapters in the codebase are `# TODO` stubs. No label generation, rate quoting, or tracking calls are functional. CCW cannot produce shipping labels or track consignments from within the ERP.

**Phill (14/04/2026):** CCW uses multiple carriers — Australia Post, TNT, FedEx, and local/state carriers. Implementation must be a carrier abstraction layer, not a single-platform integration.

## Business impact

Fulfilment… (truncated, use `get_issue` for full description)

---

## Karpathy Build Block (verified against codebase 2026-04-17)

**Files** (hints — Glob/Grep to confirm before editing):

```
apps/backend/src/services/carrier_service.py
apps/backend/src/api/routes/shipments.py
apps/backend/src/integrations/  # new carrier adapters directory
```

**Goal:** carrier_service has a CarrierAdapter interface with concrete auspost / tnt / fedex adapters; rate, label, track each call through the abstraction.

**Verify (runnable):**

```
1. Grep: `rg -n 'class CarrierAdapter' apps/backend/src/services/carrier_service.py` returns 1 definition.
2. cd apps/backend && uv run pytest tests/services/test_carrier_service.py -k adapter
3. UI: /shipments → pick carrier → rate quotes return from all 3 in sandbox.
```

**Karpathy anchors:** P1 plan-first, P2 simplicity, P3 surgical (only files above), P4 goal-driven verification (all 3 checks must pass).

**Sonnet 4.6 notes:** Read `.claude/SONNET-HANDOFF.md` first. Paths marked `[NEW]` may need creating; verify via Glob before assuming.

Linear ticket: UNI-1822 — https://linear.app/unite-group/issue/UNI-1822/shipping-build-multi-carrier-api-abstraction-layer-auspost-tnt-fedex
Triggered automatically by Pi-CEO autonomous poller.


## Session: 10832fbcf15d
