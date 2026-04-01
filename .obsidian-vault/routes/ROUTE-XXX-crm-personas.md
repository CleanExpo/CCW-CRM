---
type: 'route'
id: 'ROUTE-XXX'
file: 'apps/backend/src/api/routes/crm_personas.py'
prefix: '/api/crm/personas'
domain: 'CRM'
auth: 'JWT'
status: 'Active'
endpoint_count: 0
registered: true
links: []
last_verified: '2026-03-23'
---

# ROUTE-XXX: Crm Personas

## Overview

CRM Persona Tagging — UNI-1112

Auto-classify customers by business type and behaviour using existing order data.
No new paid APIs — purely derived from Orders + Quotes.

Personas:
  high_value       — lifetime spend >= $10,000
  equipment_buyer  — orders contain high-unit-price items (>= $1,000/item)
  consumables      — frequent orders (>=5) with low avg order value
  contractor       — 2-4 orders, moderate value
  new_account      — customer created in last 30 days
  dormant          — no order in 90+ days AND has prior orders
  unclassified     — fallback

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
