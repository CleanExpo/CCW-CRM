# Task Brief

[HIGH] [Cin7] Add PO and invoice events to Cin7 webhook event map

Description:
## What's missing

The Cin7 webhook event map is missing purchase order received and invoice events. When Cin7 processes a GRN (goods received note) or raises a supplier invoice, CCW receives no event — stock levels and AP are not updated in real time.

Note: Cin7 Core uses polling, not webhooks. This issue covers adding these event types to the polling handler.

## Business impact

GRNs in Cin7 not reflected in CCW means inventory discrepancies… (truncated, use `get_issue` for full description)

---

## Karpathy Build Block (verified against codebase 2026-04-17)

**Files** (hints — Glob/Grep to confirm before editing):

```
apps/backend/src/integrations/cin7/event_dispatcher.py
apps/backend/src/db/cin7_models.py
apps/backend/src/api/routes/webhooks.py
```

**Goal:** event_dispatcher maps Cin7 PO and invoice events to local handlers; unknown events logged + ignored, known events trigger the correct downstream action.

**Verify (runnable):**

```
1. Grep: `rg -n 'purchase_order|invoice' apps/backend/src/integrations/cin7/event_dispatcher.py` shows registered mappings.
2. cd apps/backend && uv run pytest tests/integrations/test_cin7.py -k dispatcher
3. UI: Cin7 test webhook 'invoice.created' → local row appears in reconciliation feed.
```

**Karpathy anchors:** P1 plan-first, P2 simplicity, P3 surgical (only files above), P4 goal-driven verification (all 3 checks must pass).

**Sonnet 4.6 notes:** Read `.claude/SONNET-HANDOFF.md` first. Paths marked `[NEW]` may need creating; verify via Glob before assuming.

Linear ticket: UNI-1830 — https://linear.app/unite-group/issue/UNI-1830/cin7-add-po-and-invoice-events-to-cin7-webhook-event-map
Triggered automatically by Pi-CEO autonomous poller.


## Session: 18f84356ecf2
