# Task Brief

[HIGH] [Purchasing] Build AP ageing report — supplier liability visibility for CFO

Description:
## What's missing

No AP ageing report exists. The CFO cannot see which supplier invoices are overdue, how much is owed by age bucket, or which suppliers need payment urgency. Supplier liability is invisible until manually checked in Xero.

## Business impact

Without AP ageing, cash flow planning misses supplier payment obligations. Late supplier payments attract penalties and damage supplier relationships. At $5–10M revenue with regular purcha… (truncated, use `get_issue` for full description)

---

## Karpathy Build Block (verified against codebase 2026-04-17)

**Files** (hints — Glob/Grep to confirm before editing):

```
apps/backend/src/api/routes/purchase_orders.py
apps/backend/src/api/routes/suppliers.py
apps/backend/src/api/routes/analytics.py
```

**Goal:** GET /api/analytics/ap-ageing returns supplier balances bucketed 0-30 / 31-60 / 61-90 / 90+; /reports shows the same in a table and chart.

**Verify (runnable):**

```
1. cd apps/backend && uv run pytest tests/api/test_analytics.py -k ap_ageing
2. pnpm turbo run type-check
3. UI: /reports → 'AP Ageing' → table + chart render; totals match Xero AP Ageing for the same date.
```

**Karpathy anchors:** P1 plan-first, P2 simplicity, P3 surgical (only files above), P4 goal-driven verification (all 3 checks must pass).

**Sonnet 4.6 notes:** Read `.claude/SONNET-HANDOFF.md` first. Paths marked `[NEW]` may need creating; verify via Glob before assuming.

Linear ticket: UNI-1834 — https://linear.app/unite-group/issue/UNI-1834/purchasing-build-ap-ageing-report-supplier-liability-visibility-for
Triggered automatically by Pi-CEO autonomous poller.


## Session: 1df91d936bd5
