---
type: 'route'
id: 'ROUTE-XXX'
file: 'apps/backend/src/api/routes/integrations/cin7_bom.py'
prefix: '/api/cin7/bom'
domain: 'CRM'
auth: 'JWT'
status: 'Active'
endpoint_count: 0
registered: true
links: []
last_verified: '2026-03-23'
---

# ROUTE-XXX: Cin7 Bom

## Overview

Cin7 BOM (Bill of Materials) and Production Run API endpoints.

Provides routes for syncing BOM masters from Cin7, listing/querying BOMs
with their component lists, and managing production runs against those BOMs.

Demo mode returns pre-seeded fixtures for the 3 demo BOM records.

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
