---
type: 'route'
id: 'ROUTE-XXX'
file: 'apps/backend/src/api/routes/billing.py'
prefix: '/api/billing'
domain: 'CRM'
auth: 'JWT'
status: 'Active'
endpoint_count: 0
registered: true
links: []
last_verified: '2026-03-23'
---

# ROUTE-XXX: Billing

## Overview

Billing and payment endpoints (Phase 2 Batch 2A).

GAP-010: POST /api/billing/payment-methods
GAP-011: GET /api/billing/payment-methods/enum
GAP-012: POST /api/billing/dunning/send-letter (uses dunning service)
GAP-013: GET /api/billing/subscription-health
GAP-014: POST /api/billing/retry-failed-payment

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

| Date | Change | Author |
|------|--------|--------|
| 2026-03-23 | Auto-generated from code | vault-generator.py |
