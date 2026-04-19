# Task Brief

[HIGH] [Warehouse] Add landed cost calculation per SKU — fix understated COGS

Description:
## What's missing

No landed cost calculation exists. Freight, customs duty, and handling costs are not allocated to individual SKUs at receipt. Inventory is valued at purchase price only — gross margin reports understate true cost of goods and overstate margin.

## Business impact

Without landed cost, margin reports are unreliable for pricing decisions. At $5–10M revenue with imported goods, freight and customs can represent 10–20% of COGS. In… (truncated, use `get_issue` for full description)

---

## Karpathy Build Block (verified against codebase 2026-04-17)

**Files** (hints — Glob/Grep to confirm before editing):

```
apps/backend/src/db/inventory_models.py
apps/backend/src/api/routes/warehouse.py
apps/backend/src/api/routes/purchase_orders.py
```

**Goal:** GRN captures landed-cost components (freight, duty, handling); cost_per_unit = (po_price + apportioned_landed) / qty, written to inventory_models.

**Verify (runnable):**

```
1. cd apps/backend && uv run pytest tests/api/test_warehouse.py -k landed_cost
2. cd apps/backend && uv run pytest tests/api/test_purchase_orders.py -k landed
3. UI: /purchase-orders/[id] → receipt wizard → enter freight $200 → SKU average cost updates.
```

**Karpathy anchors:** P1 plan-first, P2 simplicity, P3 surgical (only files above), P4 goal-driven verification (all 3 checks must pass).

**Sonnet 4.6 notes:** Read `.claude/SONNET-HANDOFF.md` first. Paths marked `[NEW]` may need creating; verify via Glob before assuming.

Linear ticket: UNI-1832 — https://linear.app/unite-group/issue/UNI-1832/warehouse-add-landed-cost-calculation-per-sku-fix-understated-cogs
Triggered automatically by Pi-CEO autonomous poller.


## Session: 268e52cc1ac1
