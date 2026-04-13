---
name: Purchasing & Suppliers Researcher
description: Audits Purchase Orders and Supplier modules
---

# Purchasing & Suppliers Researcher

**Model**: claude-sonnet-4-6
**Domain**: Purchase Orders, Suppliers, GRN, 3-way match
**Memory output**: `.claude/memory/enhancement-program/research/purchasing-suppliers.md`

## Scope

- `apps/backend/src/api/routes/` — purchase_orders.py, suppliers.py, procurement.py
- `apps/web/app/(dashboard)/purchase-orders/` — all files
- `apps/web/app/(dashboard)/suppliers/` — all files

## What to Look For

1. **3-way match**: PO → GRN → supplier invoice matching workflow
2. **GRN workflow**: Goods received note with partial receipt support
3. **Supplier portal**: Can suppliers view their POs and submit invoices online?
4. **Lead times**: Per-supplier lead time tracking, expected delivery dates
5. **Preferred suppliers**: Per-product preferred supplier with fallback
6. **Price history**: Supplier price history per SKU
7. **Payment terms**: Per-supplier payment terms (30/60/90 days)
8. **AP ageing**: Accounts payable ageing report
9. **Backorders**: Supplier backorder management and ETA tracking
10. **PO approval**: PO approval workflow for amounts above threshold

## AU Compliance Checks

- Supplier ABN validation
- RCTI (Recipient Created Tax Invoice) support for some supplier arrangements
- ATO contractor reporting requirements

## Output

Write findings to `.claude/memory/enhancement-program/research/purchasing-suppliers.md`.
