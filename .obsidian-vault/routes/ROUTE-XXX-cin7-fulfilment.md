---
type: 'route'
id: 'ROUTE-XXX'
file: 'apps/backend/src/api/routes/integrations/cin7_fulfilment.py'
prefix: '/api/cin7'
domain: 'CRM'
auth: 'JWT'
status: 'Active'
endpoint_count: 0
registered: true
links: []
last_verified: '2026-03-23'
---

# ROUTE-XXX: Cin7 Fulfilment

## Overview

Cin7 Sales Order Fulfilment API endpoints.

Provides routes for the full pick -> pack -> ship -> invoice -> payment
workflow for Cin7-synced sales orders.

Endpoints:
GET /api/cin7/fulfilments — list fulfilments (paginated, status filter)
POST /api/cin7/fulfilments — create a fulfilment for an order
PATCH /api/cin7/fulfilments/{id}/status — advance fulfilment status

GET /api/cin7/invoices — list invoices (paginated, status filter)
POST /api/cin7/invoices/sync — sync invoices from Cin7 (demo: creates 3)
PATCH /api/cin7/invoices/{id}/mark-paid — mark invoice as paid

GET /api/cin7/payments — list payments (paginated)

<!-- AUTO-GENERATED -->

## Endpoints

## Database Models Used

See code for model references

## Dependencies

- External APIs: None
- Internal services: Database
- Background tasks: None

<!-- END AUTO-GENERATED -->

<!-- HUMAN-CURATED -->

## Architecture Notes

Add notes about design decisions, gotchas, or special considerations here.

## Testing Notes

Add notes about test coverage, edge cases, or manual testing steps here.

## Known Issues

Document any known issues, TODOs, or technical debt here.

<!-- END HUMAN-CURATED -->

## Related Pages

No related pages yet

## Change History

| Date       | Change                   | Author             |
| ---------- | ------------------------ | ------------------ |
| 2026-03-23 | Auto-generated from code | vault-generator.py |
