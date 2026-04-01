# Plan: UNI-172 — Inventory & Stock Management

**Created:** 2026-03-03
**Status:** Ready for implementation

---

## What Already Exists

| Feature Area                                     | Status   |
| ------------------------------------------------ | -------- |
| Multi-location stock tracking (3 locations)      | Complete |
| Stock alerts / health dashboard                  | Complete |
| Stock transfers (UI + API + SSE + Shopify sync)  | Complete |
| Stock adjustments (UI + API + audit log)         | Complete |
| Stock reservations (UI + API)                    | Complete |
| Transfer history page                            | Complete |
| Forecast/reorder point calc (AI agent)           | Complete |
| Purchase Orders (UI + API + receive-goods)       | Complete |
| BOM / production runs (Cin7-backed)              | Complete |
| Warehouse ops dashboard (receiving/pick/returns) | Complete |
| Cin7 inventory writeback                         | Complete |

**Key files:** `inventory_models.py` (ProductStockByLocation, StockTransfer, StockReservation, StockAdjustment), `inventory.py` routes (12 endpoints), `lib/api/inventory.ts` (full typed client), `lib/types/inventory.ts` (comprehensive types).

---

## What Needs Building

### Gaps by feature area:

1. **Reorder point editor UI** — `reorder_point` + `reorder_quantity` columns exist in DB but no form to set them
2. **Dashboard KPI strip** — inventory/page.tsx only shows unhealthy products; no total value, total SKUs, etc.
3. **Barcode scanning** — no `barcode` field, no lookup endpoint, no scanner hook (ProductSearch has placeholder only)
4. **Stock take / cycle count workflow** — `last_counted_at`/`last_counted_by` exist but no UI or workflow
5. **Reorder automation** — no `ReorderRule` model, no auto-PO endpoint, no cron trigger
6. **Product attributes & variants** — no `ProductAttribute` or `ProductVariant` models
7. **Reorder alert panel** — no dedicated action panel to generate POs from alerts

---

## Sub-Tasks

### SUB-1: Reorder Point Editor UI (S)

**Files:**

- `apps/backend/src/api/routes/inventory.py` — add `PATCH /api/inventory/reorder-settings/{product_id}/{location}`
- `apps/web/lib/api/inventory.ts` — add `updateReorderSettings()` method
- `apps/web/app/(dashboard)/inventory/stock/page.tsx` — add "Set Reorder" button per row
- `apps/web/app/(dashboard)/inventory/components/ReorderPointDialog.tsx` — new RHF+Zod dialog

**Steps:**

1. Add `PATCH` endpoint updating `ProductStockByLocation.reorder_point` + `reorder_quantity` — columns already exist
2. Add `updateReorderSettings(productId, location, reorderPoint, reorderQty)` to `inventoryApi`
3. Create `ReorderPointDialog.tsx` with 2 numeric fields (pattern from `StockTransferDialog.tsx`)
4. Add "Set Reorder" button to each row in `inventory/stock/page.tsx`

---

### SUB-2: Inventory Dashboard Enhancement (S)

**Files:**

- `apps/backend/src/api/routes/inventory.py` — add `GET /api/inventory/summary`
- `apps/web/lib/api/inventory.ts` — add `getSummary()` (type `InventorySummary` already defined in types)
- `apps/web/app/(dashboard)/inventory/page.tsx` — add 4 KPI summary cards

**Steps:**

1. Add `GET /api/inventory/summary`: aggregate total stock, total reserved, total value (join product.price), count below reorder_point
2. Wire into `inventory/page.tsx` — 4 new cards: Total SKUs, Total Stock Value, Below Reorder Point, Active Reservations

---

### SUB-3: Barcode Field + Lookup Endpoint (M)

**Files:**

- `apps/backend/src/db/inventory_models.py` — add `ProductBarcode` model (side-table, avoids demo_models.py)
- `apps/backend/src/api/routes/inventory.py` — add `GET /api/inventory/barcode/{code}`, `POST/DELETE /api/inventory/barcode`
- `apps/web/lib/api/inventory.ts` — add `lookupByBarcode()`, `addBarcode()`, `removeBarcode()`
- `apps/web/hooks/use-barcode-scanner.ts` — new hook for keyboard-wedge scanner detection
- `apps/web/app/(dashboard)/inventory/stock/page.tsx` — add scan input
- `apps/web/app/(dashboard)/warehouse/page.tsx` — add scan-to-receive in Receiving tab

**Steps:**

1. `ProductBarcode`: `id`, `product_id` (FK→products cascade), `barcode` (unique), `barcode_type`, `created_at`
2. Lookup endpoint joins ProductBarcode→Product→ProductStockByLocation
3. `useBarcodeScanner` hook: detects rapid keypress sequences (>5 chars within 100ms), fires callback
4. Wire scan input at top of stock page — highlights/scrolls to matching row

---

### SUB-4: Stock Take / Cycle Count Workflow (M)

**Files:**

- `apps/backend/src/db/inventory_models.py` — add `StockTake` + `StockTakeItem` models
- `apps/backend/src/api/routes/inventory.py` — add `POST /api/inventory/stock-take`, `GET /api/inventory/stock-takes`, `POST /api/inventory/stock-take/{id}/submit`
- `apps/web/lib/api/inventory.ts` — add `startStockTake()`, `getStockTakes()`, `submitStockTake()`
- `apps/web/app/(dashboard)/warehouse/page.tsx` — add "Stock Take" tab
- `apps/web/app/(dashboard)/warehouse/components/StockTakeForm.tsx` — new component

**Steps:**

1. `StockTake` (location, status, created_by, created_at, submitted_at) + `StockTakeItem` (stock_take_id FK, product_id FK, counted_qty, system_qty, variance)
2. Submit endpoint applies variances via `StockAdjustment` records + updates `last_counted_at`/`last_counted_by` — in single transaction
3. `StockTakeForm.tsx`: list all products at location, input per row, real-time variance display

---

### SUB-5: Reorder Automation (L)

**Files:**

- `apps/backend/src/db/inventory_models.py` — add `ReorderRule` model
- `apps/backend/src/api/routes/inventory.py` — add `GET/POST /api/inventory/reorder-rules`, `POST /api/inventory/auto-reorder`
- `apps/web/lib/api/inventory.ts` — add `triggerAutoReorder()`, `getReorderRules()`, `saveReorderRule()`
- `apps/web/app/(dashboard)/inventory/forecast/page.tsx` — add "Create PO" button per row
- `apps/web/app/(dashboard)/inventory/components/ReorderRuleDialog.tsx` — configure rules

**Steps:**

1. `ReorderRule`: product_id (FK), location, supplier_id (FK→Supplier), auto_approve_under_qty, lead_time_days, is_enabled
2. `auto-reorder` endpoint: looks up ReorderRule for supplier, creates PO with status `draft` (not auto-approved unless threshold met)
3. `ReorderRuleDialog.tsx`: supplier select, auto-approve threshold, lead time
4. "Create PO" button on forecast/page.tsx per row

---

### SUB-6: Reorder Alert Panel (S)

**Files:**

- `apps/backend/src/api/routes/inventory.py` — add `GET /api/inventory/reorder-alerts`
- `apps/web/lib/api/inventory.ts` — add `getReorderAlerts()`
- `apps/web/lib/types/inventory.ts` — add `ReorderAlert` interface
- `apps/web/app/(dashboard)/inventory/page.tsx` — add "Reorder Required" section

**Depends on:** SUB-5 (ReorderRule model) for supplier info

**Steps:**

1. Query `ProductStockByLocation` where `reorder_point IS NOT NULL AND stock <= reorder_point`, join Product + optionally ReorderRule for supplier name
2. Add compact alert table to `inventory/page.tsx` with count badge + "Generate PO" button per row

---

### SUB-7: Product Attributes & Variants (L)

**Files:**

- `apps/backend/src/db/inventory_models.py` — add `ProductAttribute` + `ProductVariant` models
- `apps/backend/src/api/routes/products.py` — add `GET/POST /api/products/{id}/attributes` and `GET/POST /api/products/{id}/variants`
- `apps/web/app/(dashboard)/products/components/ProductForm.tsx` — add Attributes accordion
- `apps/web/app/(dashboard)/products/[id]/page.tsx` — add Variants tab

**Steps:**

1. `ProductAttribute`: product_id (FK cascade), key, value, unit (optional)
2. `ProductVariant`: product_id (FK cascade), variant_sku (unique), name, attributes (JSON), price_override (nullable), is_active
3. Add collapsible Attributes section to ProductForm
4. Add Variants tab to product detail page

---

### SUB-8: Tests (M)

**Files:**

- `apps/web/__tests__/lib/api/inventory.test.ts` — extend with new methods (already 51 tests from UNI-1252)
- `apps/backend/tests/api/test_inventory.py` — new backend tests using TestClient(app)

---

## Implementation Order

1. SUB-1 — Reorder Point Editor (no new models)
2. SUB-2 — Dashboard Enhancement (one new endpoint, visible improvement)
3. SUB-3 — Barcode (new ProductBarcode model, new hook)
4. SUB-4 — Stock Take (new StockTake + StockTakeItem models)
5. SUB-5 — Reorder Automation (new ReorderRule model — prerequisite for SUB-6)
6. SUB-6 — Reorder Alert Panel (depends on ReorderRule from SUB-5)
7. SUB-7 — Attributes & Variants (most complex, independent)
8. SUB-8 — Tests (run continuously, finalize last)

## Risks

1. **demo_models.py locked** — `Product` has no `barcode` column; workaround is `ProductBarcode` side-table in `inventory_models.py`
2. **`StoreLocation` enum hardcoded** to 3 values — do not make dynamic without schema approval
3. **Stock take atomicity** — submit must wrap all adjustments + stock updates in a single `async with db.begin()` transaction
4. **Auto-PO approval safety** — auto-generated POs created as `draft` unless `auto_approve_under_qty` threshold is met
5. **Barcode scanner timing** — `useBarcodeScanner` hook must use configurable inter-character timeout (default 100ms) + minimum length (default 6 chars)

## Breaking Changes

None. All new endpoints additive. No existing endpoints modified. No existing tables altered. `demo_models.py` and `middleware.ts` untouched. All new models go into `inventory_models.py`.
