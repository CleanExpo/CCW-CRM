# Task Brief

[HIGH] [Workshop] Integrate parts usage with inventory — eliminate ghost stock loss

Description:
## What's missing

Parts consumed during workshop jobs are not deducted from inventory. Technicians use parts, but stock levels in CCW remain unchanged. Over time inventory counts diverge significantly from physical stock — "ghost" stock accumulates.

## Business impact

Inaccurate inventory means over-ordering, stock-outs during fulfilment, and incorrect COGS. At $5–10M revenue with regular workshop activity, ghost stock can represent significa… (truncated, use `get_issue` for full description)

---

## Karpathy Build Block (verified against codebase 2026-04-17)

**Files** (hints — Glob/Grep to confirm before editing):

```
apps/backend/src/api/routes/service_requests.py
apps/backend/src/api/routes/inventory.py
apps/backend/src/services/auto_reorder.py
apps/backend/src/db/inventory_models.py
```

**Goal:** Adding a part to a job decrements inventory_models stock by qty; completing the job finalises the deduction; reopen restores it.

**Verify (runnable):**

```
1. cd apps/backend && uv run pytest tests/api/test_service_requests.py -k parts_inventory
2. cd apps/backend && uv run pytest tests/services/test_auto_reorder.py
3. UI: /workshop/[id] → add part qty 2 → /inventory/[sku] shows -2 live.
```

**Karpathy anchors:** P1 plan-first, P2 simplicity, P3 surgical (only files above), P4 goal-driven verification (all 3 checks must pass).

**Sonnet 4.6 notes:** Read `.claude/SONNET-HANDOFF.md` first. Paths marked `[NEW]` may need creating; verify via Glob before assuming.

Linear ticket: UNI-1827 — https://linear.app/unite-group/issue/UNI-1827/workshop-integrate-parts-usage-with-inventory-eliminate-ghost-stock
Triggered automatically by Pi-CEO autonomous poller.


## Session: 0a63492ea7b0
