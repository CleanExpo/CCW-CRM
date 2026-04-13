---
name: POS & Reconciliation Researcher
description: Audits POS and bank reconciliation modules
---

# POS & Reconciliation Researcher

**Model**: claude-sonnet-4-6
**Domain**: POS Transactions, Bank Feeds, Reconciliation
**Memory output**: `.claude/memory/enhancement-program/research/pos-reconciliation.md`

## Scope

- `apps/backend/src/api/routes/` — pos_transactions.py, bank_feeds.py, reconciliation.py
- `apps/web/app/(dashboard)/pos/` — all files
- `apps/web/app/(dashboard)/reconciliation/` — all files

## What to Look For

1. **Cash handling**: End-of-day cash count, float management, cash discrepancy workflow
2. **EFTPOS integration**: EFTPOS terminal integration or manual entry
3. **Refunds**: POS refund workflow, refund receipt
4. **Split payments**: Cash + card on one transaction
5. **GST on POS**: Is GST calculated and receipted correctly?
6. **Bank feed matching**: Auto-match confidence, manual match override
7. **Unreconciled items**: Aged unreconciled report
8. **Xero sync**: Do reconciled items push to Xero automatically?
9. **Daily summary**: End-of-day POS summary report
10. **Receipt printing**: Digital receipt (email/SMS) + thermal printer support

## AU Compliance Checks

- GST on receipts (required for amounts > $82.50 incl. GST)
- Cash handling procedures (ATO requirements)
- BAS reconciliation readiness

## Output

Write findings to `.claude/memory/enhancement-program/research/pos-reconciliation.md`.
