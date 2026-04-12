---
type: 'route'
id: 'ROUTE-XXX'
file: 'apps/backend/src/api/routes/integrations/cin7_inventory_writeback.py'
prefix: '/api/cin7'
domain: 'CRM'
auth: 'JWT'
status: 'Active'
endpoint_count: 0
registered: true
links: []
last_verified: '2026-03-23'
---

# ROUTE-XXX: Cin7 Inventory Writeback

## Overview

Cin7 Inventory Write-Back API (UNI-1265).

Endpoints for stock adjustments, stock transfers, and stock-takes
that are written back to Cin7. In demo mode the records are
marked as synced immediately with a generated Cin7 ID.

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
