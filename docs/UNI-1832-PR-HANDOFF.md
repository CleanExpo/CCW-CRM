# UNI-1832 PR Handoff — Landed Cost Calculation per SKU

**Ticket**: UNI-1832  
**Branch**: `main` (commit `bffbd9b`)  
**Status**: Committed locally — needs push + PR  

---

## What was built

GRN now captures freight, customs duty and handling costs and apportions them
across received SKUs using **value-proportional allocation** (GAAP standard):

```
landed_cost_per_unit = total_landed × po_unit_cost / Σ(po_unit_cost × qty_received)
cost_per_unit        = po_unit_cost + landed_cost_per_unit
```

`cost_per_unit` is written to every `GoodsReceivedNoteLine` and
`average_cost` is upserted onto `ProductStockByLocation` — correcting the
understated COGS that was causing margin reports to overstate profit.

---

## Files changed (5)

| File | Change |
|------|--------|
| `supabase/migrations/20260419000001_add_landed_cost.sql` | **NEW** — ALTER TABLE adds 6 columns |
| `apps/backend/src/db/inventory_models.py` | `freight_cost`, `customs_duty`, `handling_cost` on `GoodsReceivedNote`; `landed_cost_per_unit`, `cost_per_unit` on `GoodsReceivedNoteLine`; `average_cost` on `ProductStockByLocation` |
| `apps/backend/src/api/routes/purchase_orders.py` | `GRNCreate` accepts landed costs; `GRNLineResponse` + `GRNResponse` expose them; `create_grn` computes apportionment + upserts `average_cost` |
| `apps/backend/tests/api/test_purchase_orders.py` | `TestLandedCost` class — 3 tests (`-k landed`) |
| `apps/backend/tests/api/test_warehouse.py` | `TestGRNLandedCost` class — 2 tests (`-k landed_cost`) |

---

## Push + PR commands (run on your local machine)

```powershell
cd C:\path\to\CCW-CRM
git pull origin main      # sync commit bffbd9b
gh pr create `
  --title "feat(warehouse): add landed cost calculation per SKU (UNI-1832)" `
  --body "## Summary
- GRN captures freight, customs duty, and handling costs
- Value-proportional apportionment across SKUs (GAAP standard)
- cost_per_unit written to GoodsReceivedNoteLine; average_cost to ProductStockByLocation
- Fixes understated COGS in gross margin reports

## Test plan
- [ ] cd apps/backend && uv run pytest tests/api/test_purchase_orders.py -k landed
- [ ] cd apps/backend && uv run pytest tests/api/test_warehouse.py -k landed_cost
- [ ] UI: /purchase-orders/[id] → receipt wizard → enter freight \$200 → SKU average cost updates

🤖 Generated with Claude Code"
```

---

## Verify commands

```bash
# Test 1 (brief verify step 1)
cd apps/backend && uv run pytest tests/api/test_warehouse.py -k landed_cost -v

# Test 2 (brief verify step 2)
cd apps/backend && uv run pytest tests/api/test_purchase_orders.py -k landed -v

# Full GRN test suite (regression check)
cd apps/backend && uv run pytest tests/api/test_purchase_orders.py tests/api/test_warehouse.py -v
```

---

## Migration

Apply to Supabase after merge:
```bash
supabase db push
# or directly in Supabase SQL editor:
# copy contents of supabase/migrations/20260419000001_add_landed_cost.sql
```

---

## API changes (backward compatible)

### `POST /api/purchase-orders/{po_id}/grn`

New optional request fields (all default to `0` — existing callers unaffected):
```json
{
  "delivery_location": "brisbane",
  "freight_cost": 200.00,
  "customs_duty": 50.00,
  "handling_cost": 25.00,
  "lines": [...]
}
```

New response fields:
```json
{
  "freight_cost": 200.00,
  "customs_duty": 50.00,
  "handling_cost": 25.00,
  "total_landed_cost": 275.00,
  "lines": [
    {
      "landed_cost_per_unit": 18.18,
      "cost_per_unit": 28.18,
      ...
    }
  ]
}
```
