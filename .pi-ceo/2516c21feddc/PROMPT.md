# Task Brief

[HIGH] [Customers] Add per-customer payment terms — sync to Xero contacts

Description:
## What's missing

Every invoice defaults to the same payment terms regardless of customer agreement. Key account customers (30-day, 60-day, EOM terms) and COD customers all receive identical terms. Xero contacts carry payment terms which drive AR ageing — these are not set from CCW.

## Business impact

Incorrect AR ageing in Xero means the CFO cannot identify overdue debtors accurately. Trade customers with negotiated terms are misclassified a… (truncated, use `get_issue` for full description)

---

## Karpathy Build Block (verified against codebase 2026-04-17)

**Files** (hints — Glob/Grep to confirm before editing):

```
apps/backend/src/api/routes/customers.py
apps/backend/src/integrations/xero/customers.py
apps/backend/src/db/demo_models.py
```

**Goal:** Customer has payment_terms_days; edit in UI → Xero contact's PaymentTerms updated via API.

**Verify (runnable):**

```
1. cd apps/backend && uv run pytest tests/api/test_customers.py -k payment_terms
2. cd apps/backend && uv run pytest tests/integrations/test_xero.py -k payment_terms
3. UI: /customers/[id] → set 14 days → Xero sync shows 14 in PaymentTerms within a minute.
```

**Karpathy anchors:** P1 plan-first, P2 simplicity, P3 surgical (only files above), P4 goal-driven verification (all 3 checks must pass).

**Sonnet 4.6 notes:** Read `.claude/SONNET-HANDOFF.md` first. Paths marked `[NEW]` may need creating; verify via Glob before assuming.

Linear ticket: UNI-1821 — https://linear.app/unite-group/issue/UNI-1821/customers-add-per-customer-payment-terms-sync-to-xero-contacts
Triggered automatically by Pi-CEO autonomous poller.


## Session: 2516c21feddc
