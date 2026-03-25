---
type: 'route'
id: 'ROUTE-XXX'
file: 'apps/backend/src/api/routes/integrations/cin7_shadow_sync.py'
prefix: '/api/cin7/shadow'
domain: 'CRM'
auth: 'JWT'
status: 'Active'
endpoint_count: 0
registered: true
links: []
last_verified: '2026-03-23'
---

# ROUTE-XXX: Cin7 Shadow Sync

## Overview

Cin7 Shadow Sync API endpoints.

Phase A of the Shadow Transition System (UNI-1260).

Provides routes for:
  - Triggering a shadow poll (detect gaps between Cin7 and ERP)
  - Querying shadow sync status summary
  - Listing / filtering sync gaps
  - Resolving or ignoring individual gaps

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
