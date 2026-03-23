---
type: 'route'
id: 'ROUTE-XXX'
file: 'apps/backend/src/api/routes/integrations/cin7_gl.py'
prefix: '/api/cin7'
domain: 'CRM'
auth: 'JWT'
status: 'Active'
endpoint_count: 0
registered: true
links: []
last_verified: '2026-03-23'
---

# ROUTE-XXX: Cin7 Gl

## Overview

Cin7 Financial/GL Integration API endpoints.

Provides routes for:

- Chart of Accounts: list and sync from Cin7
- Journal Entries: list, create manual entries, post drafts
- Account Mappings: list and upsert ERP-to-GL mappings

In demo mode all operations use realistic mock data; no real Cin7 calls.

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
