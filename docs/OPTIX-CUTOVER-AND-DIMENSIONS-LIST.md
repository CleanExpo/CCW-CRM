# Optix list — cutover prerequisites and post go-live dimensions

Written 20 September 2026 from Toby’s confirmation (same day).  
**Not Phase 2.** Phase 2 SoW, stock corroboration, and SendGrid stay ahead. No spare field. No external reporting layer. Optix is where this is answered, later.

These four entries stay on the list while the schema is open so Phase 2 work does not quietly rule them out.

---

## Ahead of this list (do not reorder)

1. Phase 2 SoW (signable v1.1)
2. Stock corroboration (frozen as-of; five control totals close Phase 1; SKU × branch × decimal is Area 1)
3. SendGrid transactional email (Twilio relationship)

---

## 1. Stock-movement ledger — cutover prerequisite — **new**

**Target:** One in / out / adjustment history in Optix (audit, COGS by movement, “why is this SKU short” without Cin7).

**Today:** `cin7_stock_levels` is a snapshot by branch × SKU. `stock_transfers` has from/to. There is no movement ledger. Cin7 still holds that history.

**Phase 2:** Not in the Phase 2 design. Phase 2 stock work is corroboration against a freeze, not a ledger.

**Schema must not:** Treat the snapshot table as the only stock history Optix will ever have.

---

## 2. Branch on a sale — cutover prerequisite — **gap**

**Target:** A posted sale can be attributed to a branch the way Xero Territory maps to branches.

**Today:** No branch on the invoice or order **header** or **line**. Some screens collect a fulfilment location; it is not stored on the posted order/invoice. POS has `location_code`. Cin7 fulfilment has `pick_location` on `sales_fulfilments`. Neither is “this invoice belongs to QLD1.”

**One line:** Optix does not attribute a standard sale to a branch.

**Schema must not:** Ship a sales model that cannot take a branch (or a later posted dimension set) on the header/line.

---

## 3. Defined read path — cutover prerequisite — **not built**

**Target:** Transaction-line (and later movement) data extractable for accountants / Excel / a side system — reporting view, scheduled export, or dedicated read API. Not the screen APIs. Not the production database URL.

**Today:** Authenticated JSON APIs for the UI only. No warehouse view, no scheduled transaction export.

**Now:** List only. Form chosen when this is scoped. Schema should stay queryable at line grain.

---

## 4. Navision-style dimensions — post go-live — **the target (a mechanism)**

Not “a few extra fields.” Own scope and price after go-live.

- User-defined dimension **codes**, each with its own list of **values** — Branch, Channel, Product Group, Supplier Group, Customer Segment, Salesperson, and whatever comes next. No fixed cap.
- Default values on **master** records (customer, supplier, product, location). Transactions inherit them; override on header or line.
- The **resolved** set stored on every **posted** transaction line and stock movement at posting time. History does not change when master data is re-categorised.
- Analysis by any combination (e.g. GP by product group × branch × channel) **without** joining back to today’s master data.

**Schema must not:** Freeze line tables in a shape that cannot later hold a posted dimension set.

---

## Status

| #   | Item                      | When           | Now                                                  |
| --- | ------------------------- | -------------- | ---------------------------------------------------- |
| 1   | Stock-movement ledger     | Cutover prereq | MVP — `stock_movements` on adjust and transfer       |
| 2   | Branch on a sale          | Cutover prereq | MVP — `branch_name` on order and invoice             |
| 3   | Defined read path         | Cutover prereq | MVP — `GET /api/reporting/extract` (+ `?format=csv`) |
| 4   | Navision-style dimensions | After go-live  | Not built                                            |
