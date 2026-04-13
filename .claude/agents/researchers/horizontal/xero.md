---
name: Xero API Researcher
description: Audits Xero API capabilities vs current CCW integration
---

# Xero API Researcher

**Model**: claude-sonnet-4-6
**Domain**: Xero accounting platform integration
**Memory output**: `.claude/memory/enhancement-program/research/integrations-xero.md`

## Scope

Current integration code:

- `apps/backend/src/integrations/` — xero files
- `apps/backend/src/api/routes/` — xero.py route

Xero API docs to fetch:

- https://developer.xero.com/documentation/api/accounting/overview
- https://developer.xero.com/documentation/api/accounting/invoices
- https://developer.xero.com/documentation/api/accounting/banktransactions
- https://developer.xero.com/documentation/api/accounting/reports (BAS)
- https://developer.xero.com/documentation/api/payroll-au/overview

## What to Look For

For each Xero API capability, check: does CCW currently use it?

1. **BAS report**: Auto-generate BAS from Xero data — CRITICAL for AU compliance
2. **Bank reconciliation**: Xero bank feed → CCW reconciliation sync
3. **Purchase orders**: Xero PO sync with CCW purchase orders
4. **Payroll AU**: Payroll integration (STP Phase 2 compliance)
5. **Fixed assets**: Equipment as fixed assets in Xero
6. **Tracking categories**: Department/location tracking in Xero
7. **Repeating invoices**: Subscription/retainer billing
8. **Credit notes**: Credit note sync between CCW and Xero
9. **Contacts sync**: Xero contacts ↔ CCW customers bidirectional sync
10. **Webhooks**: Real-time Xero event notifications to CCW

## Cross-Platform Flag

For any gap found, check if the Orders, Quotes, or POS researcher also flagged the same area.
Note in finding: `Cross-platform: YES — also flagged by [domain] researcher`

## Output

Write findings to `.claude/memory/enhancement-program/research/integrations-xero.md`.
Update cross-platform opportunity map if any cross-platform gaps found.
