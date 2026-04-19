# PR Handoff — fix(backend): inventory column name AttributeErrors

**Branch**: `fix/inventory-column-names-purchase-orders-cron`  
**Commit**: `392d9a2`  
**Date**: 2026-04-19  
**Severity**: 🔴 Production blocker — both endpoints crash with AttributeError on every call

---

## Root Cause

Two Pi-CEO-generated PRs (#110 / #112) introduced references to non-existent
SQLAlchemy columns. The bugs were not caught at commit time because Python
`AttributeError` on ORM columns only fires at runtime.

### Bug 1 — `purchase_orders.py` receive-goods endpoint (lines 382–394)

`ProductStockByLocation` model has:
- `stock` (integer column)
- `reserved` (integer column)
- `available` = computed `@property` = `max(0, stock - reserved)` — **not a DB column**

The buggy code used: `quantity_on_hand`, `quantity_reserved`, `quantity_available` — none exist.

**Impact**: `POST /api/purchase-orders/{id}/items/{item_id}/receive` crashes with
`AttributeError: 'ProductStockByLocation' object has no attribute 'quantity_on_hand'`
on every goods-receipt action.

### Bug 2 — `cron_jobs.py` auto-reorder-inventory cron (lines 808–919)

`Product` (locked `demo_models.py`) has **no `reorder_point` column**.
`reorder_point` lives on `ProductStockByLocation`.

The buggy code queried `Product.reorder_point.isnot(None)` and
`Product.stock < Product.reorder_point`, which SQLAlchemy raises as
`AttributeError` when the mapper is inspected.

**Impact**: `POST /api/cron/auto-reorder-inventory` crashes with
`AttributeError: type object 'Product' has no attribute 'reorder_point'`
on every scheduled or manual invocation.

---

## Fix Summary

**`purchase_orders.py`**:
- `stock.quantity_on_hand += …` → `stock.stock += …`
- Removed `stock.quantity_available = …` setter (it's a `@property`)
- `quantity_on_hand=…, quantity_reserved=0, quantity_available=…` → `stock=…, reserved=0`

**`cron_jobs.py`**:
- Added `ProductStockByLocation` to the local import
- Rewrote query: `select(ProductStockByLocation, Product).join(Product)` filtered on
  `ProductStockByLocation.reorder_point IS NOT NULL AND stock < reorder_point`
- Loop now unpacks `(stock_entry, product)` tuples
- `ReorderRule` lookup adds `ReorderRule.location == stock_entry.location`
- All 5 `product.reorder_point` / `product.stock` refs replaced with `stock_entry.*`

---

## PowerShell Commands (run in `C:\CCW-Online ERP`)

```powershell
# 1. Fetch the branch Claude committed in the pi-ceo workspace
git fetch origin fix/inventory-column-names-purchase-orders-cron

# 2. Create a local tracking branch
git checkout fix/inventory-column-names-purchase-orders-cron

# 3. Open a PR (or push and use GitHub UI)
git push --set-upstream origin fix/inventory-column-names-purchase-orders-cron
```

Then open: https://github.com/CleanExpo/CCW-CRM/compare/fix/inventory-column-names-purchase-orders-cron

**PR title**: `fix(backend): correct column names in purchase_orders and cron auto-reorder`

---

## Verification Checklist

| # | Where | How to check | Expect to see | Must NOT see |
|---|-------|--------------|---------------|--------------|
| 1 | Railway backend | `POST /api/purchase-orders/<id>/items/<item_id>/receive` with valid payload | `200 OK` + updated item | `500 AttributeError quantity_on_hand` |
| 2 | Railway backend | `POST /api/cron/auto-reorder-inventory` with `Authorization: Bearer <CRON_SECRET>` | `200 {"status":"success","pos_created":N}` | `500 AttributeError reorder_point` |
| 3 | Python compile | `python3 -m py_compile apps/backend/src/api/routes/purchase_orders.py apps/backend/src/api/routes/cron_jobs.py` | `(no output)` | Any error |

---

## Files Changed

```
apps/backend/src/api/routes/purchase_orders.py   +4 / -5
apps/backend/src/api/routes/cron_jobs.py         +22 / -12
```

No migrations. No locked files touched. No frontend changes required.
