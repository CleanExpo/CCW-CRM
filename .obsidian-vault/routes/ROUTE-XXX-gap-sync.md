---
type: 'route'
id: 'ROUTE-XXX'
file: 'apps/backend/src/api/routes/ai/gap_sync.py'
prefix: '/api/ai/gap-sync'
domain: 'CRM'
auth: 'JWT'
status: 'Active'
endpoint_count: 0
registered: true
links: []
last_verified: '2026-03-23'
---

# ROUTE-XXX: Gap Sync

## Overview

Gap-to-Linear Sync API

Provides status checking and management for /sync-linear orchestration.

The actual orchestration is performed by the /sync-linear command skill.
This API provides programmatic access to sync state and progress.

Endpoints:
  GET /api/ai/gap-sync/status/{sync_id} - Get sync status
  GET /api/ai/gap-sync/list - List all syncs
  POST /api/ai/gap-sync/{sync_id}/cancel - Cancel a running sync

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
