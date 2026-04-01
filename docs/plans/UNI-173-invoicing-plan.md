# Plan: UNI-173 — Invoicing & Financial

**Created:** 2026-03-03
**Status:** Ready for implementation

---

## What Already Exists

### Backend (substantially complete)

| Feature Area                                                             | Status   | Files                                             |
| ------------------------------------------------------------------------ | -------- | ------------------------------------------------- |
| Invoice model (Invoice, InvoiceItem, InvoicePayment, TaxRate)            | Complete | `apps/backend/src/db/models/invoicing.py`         |
| Pydantic schemas (create/update/response/pagination, revenue/tax)        | Complete | `apps/backend/src/api/schemas/invoicing.py`       |
| Invoice CRUD endpoints (list, get, create, update, delete, send, cancel) | Complete | `apps/backend/src/api/routes/invoices.py`         |
| Payment recording (record, list, delete, auto-partial-status)            | Complete | `apps/backend/src/api/routes/invoice_payments.py` |
| Route registration in main.py                                            | Complete | Lines 411-413                                     |
| GL integration (Chart of Accounts, Journal Entries, Account Mappings)    | Complete | `cin7_gl_models.py`, `cin7_gl.py`                 |
| Xero invoice sync (orders→Xero)                                          | Complete | `xero.py` lines 255-366                           |

### Frontend (substantially complete)

| Feature Area                                             | Status   |
| -------------------------------------------------------- | -------- |
| Invoices list page with stats cards                      | Complete |
| Invoice detail page (view/send/edit/delete/payment)      | Complete |
| InvoiceForm dialog (RHF+Zod, line items, product lookup) | Complete |
| RecordPaymentDialog (all payment methods)                | Complete |
| Typed API client (invoicesApi)                           | Complete |
| GL integration UI                                        | Complete |
| Sidebar nav entry                                        | Complete |

---

## What Needs Building (Gaps)

1. **Field name mismatch** — backend uses `issue_date`, frontend uses `invoice_date` → runtime errors
2. **Missing report endpoints** — `GET /api/invoices/reports/revenue` + `/reports/tax` called by frontend → 404s
3. **Missing query filters** — `date_from`, `date_to`, `overdue_only` silently ignored by backend
4. **"partial" status rejected** — `InvoiceUpdate` regex pattern missing `"partial"` → payment flow broken
5. **No order-to-invoice generation** — users must manually re-enter line items from orders
6. **PDF TODO stub** — `handleDownloadPDF()` on detail page is a no-op comment
7. **No tax rate CRUD** — `TaxRate` model exists, no management endpoints
8. **Dead type file** — `invoices/types.ts` conflicts with canonical `lib/types/invoices.ts`
9. **No financial reporting UI** — no P&L / AR dashboard page
10. **Payment method mismatch** — frontend sends `credit_card`/`check`/`other`, backend rejects them

---

## Sub-Tasks

### SUB-1: Fix field name mismatch + UTC import bug (S — CRITICAL BLOCKER)

**Files:**

- `apps/backend/src/db/models/invoicing.py` — rename `issue_date` → `invoice_date` (requires migration)
- `apps/backend/src/api/schemas/invoicing.py` — rename field in all schemas
- `apps/backend/src/api/routes/invoices.py` — update all references

**Steps:**

1. Rename `Invoice.issue_date` column to `invoice_date` in SQLAlchemy model
2. Run migration: `ALTER TABLE invoices RENAME COLUMN issue_date TO invoice_date;`
3. Update all schema field names (InvoiceBase, InvoiceSummary, InvoiceResponse, OutstandingInvoice)
4. Fix missing `UTC` import: add `UTC` to `from datetime import date, datetime, UTC`
5. Confirm `lib/types/invoices.ts` already uses `invoice_date` (it does — no frontend change needed)

**Risk:** Requires DB migration approval (safe — new table, not demo_models.py)

---

### SUB-2: Fix "partial" status + missing query filters (S)

**Files:**

- `apps/backend/src/api/schemas/invoicing.py` — fix status regex pattern
- `apps/backend/src/api/routes/invoices.py` — add date_from, date_to, overdue_only params
- `apps/backend/src/api/schemas/invoicing.py` — fix payment_method pattern

**Steps:**

1. Add `partial` to `InvoiceUpdate.status` pattern: `"^(draft|sent|partial|paid|overdue|cancelled)$"`
2. Add `date_from`, `date_to`, `overdue_only` query params to `list_invoices()` with corresponding `.where()` clauses
3. Fix payment method enum: add `credit_card`, `check`, `other` to backend accepted values (or change frontend to send backend-accepted values — prefer fixing backend to be more permissive)

---

### SUB-3: Add backend financial reporting endpoints (M)

**Files:**

- `apps/backend/src/api/routes/invoices.py` — add 2 report endpoints + tax rates list
- `apps/backend/src/api/schemas/invoicing.py` — reconcile RevenueSummary/TaxSummary shapes with frontend

**Steps:**

1. Add `GET /api/invoices/reports/revenue` — aggregate total_revenue, total_outstanding, total_overdue, invoice_count, paid_count, with optional date_from/date_to
2. Add `GET /api/invoices/reports/tax` — group by tax_rate, return taxable_amount + tax_collected per rate
3. Add `GET /api/tax-rates` — list configured TaxRate records (needed by InvoiceForm dropdown)
4. Reconcile schema field names with frontend types (backend has `paid_invoice_count`, frontend expects `overdue_invoice_count` — add both)

---

### SUB-4: Order-to-Invoice generation (M)

**Files:**

- `apps/backend/src/api/routes/invoices.py` — add `POST /api/invoices/from-order/{order_id}`
- `apps/web/lib/api/invoices.ts` — add `generateFromOrder(orderId)` method
- `apps/web/app/(dashboard)/orders/page.tsx` — add "Generate Invoice" button on confirmed orders

**Steps:**

1. Backend endpoint: load order + order_items, check status is confirmed/delivered, check no invoice already exists for order_id, create Invoice + InvoiceItems with 10% GST, return InvoiceResponse
2. Add `invoicesApi.generateFromOrder(orderId)` to frontend client
3. Add "Generate Invoice" action button on confirmed orders in orders list — routes to `/invoices/{newId}` on success

---

### SUB-5: PDF generation — wire up InvoicePrintView (M)

**Files:**

- `apps/web/app/(dashboard)/invoices/components/InvoicePrintView.tsx` — new component
- `apps/web/app/(dashboard)/invoices/[id]/page.tsx` — replace TODO with print logic

**Steps:**

1. Create `InvoicePrintView.tsx` following `OrderPrintView.tsx` pattern: invoice number, customer, line items table, subtotal/tax/total, payment terms, status
2. Replace `handleDownloadPDF` TODO with `window.print()` using print dialog + `InvoicePrintView`

---

### SUB-6: Financial reporting dashboard (M)

**Files:**

- `apps/web/app/(dashboard)/invoices/page.tsx` — add Reports tab
- `apps/web/app/(dashboard)/invoices/components/FinancialReportTab.tsx` — new component

**Steps:**

1. Add Reports tab to invoices page (Tabs pattern from `warehouse/page.tsx`)
2. Revenue Summary card: total_revenue, total_outstanding, total_overdue, collection rate progress bar
3. Tax Summary card: tax collected per rate (BAS-ready format)
4. Date range filter passed to revenue summary API call

**Depends on:** SUB-3

---

### SUB-7: Cleanup + Xero native invoice sync (L)

**Files:**

- `apps/web/app/(dashboard)/invoices/types.ts` — delete (dead code)
- `apps/backend/src/api/routes/invoices.py` — add `POST /api/invoices/{id}/sync-xero`
- `apps/web/lib/api/invoices.ts` — add `syncToXero(id)` method
- `apps/web/app/(dashboard)/invoices/[id]/page.tsx` — add "Sync to Xero" button (conditional on Xero connected)

**Note:** Gated on Xero auth (UNI-1236 blocked) — implement with demo-mode fallback

---

## Implementation Order

1. SUB-1 — Field name fix + UTC import (critical blocker — do first, requires migration approval)
2. SUB-2 — Status/filter fixes (required for payment flow)
3. SUB-3 — Report endpoints (required for SUB-6)
4. SUB-4 — Order-to-invoice generation (highest user value)
5. SUB-5 — PDF generation (low risk, reuses existing pattern)
6. SUB-6 — Financial reporting UI (depends on SUB-3)
7. SUB-7 — Xero sync + dead file cleanup (lowest priority, Xero auth gated)

## Risks

1. **Column rename requires migration** — `issue_date` → `invoice_date` is a real schema change on the invoices table (NOT demo_models.py — safe with approval). Migration SQL: `ALTER TABLE invoices RENAME COLUMN issue_date TO invoice_date;`
2. **UTC import NameError** — `datetime.now(UTC)` will crash at runtime until the import is fixed
3. **TaxRate table is empty** — no seed data; hardcoded 10% GST works for Australia but needs CRUD endpoint
4. **Xero auth blocker** — SUB-7 Xero sync gated on UNI-1236 resolution

## Breaking Changes

- Column rename (SUB-1) requires a database migration — needs explicit approval before implementation
- All other sub-tasks are additive only; no existing endpoints modified
- `demo_models.py`, `middleware.ts`, `demo_auth.py` not touched
