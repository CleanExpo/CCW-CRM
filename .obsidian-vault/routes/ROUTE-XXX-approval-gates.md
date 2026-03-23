---
type: 'route'
id: 'ROUTE-XXX'
file: 'apps/backend/src/api/routes/ai/approval_gates.py'
prefix: '/api/ai/autonomous/gates'
domain: 'CRM'
auth: 'JWT'
status: 'Active'
endpoint_count: 0
registered: true
links: []
last_verified: '2026-03-23'
---

# ROUTE-XXX: Approval Gates

## Overview

Approval Gates API

Manages approval gates for autonomous execution workflow.
Allows users to approve/reject phase transitions in manual approval mode.

Approval Gates:
  Gate 1 (after Phase 1 Discovery): Review codebase analysis
  Gate 2 (after Phase 2 Architecture): Review design before build
  Gate 3 (after Phase 4 Build Final): Review implementation before finalize

Endpoints:
  POST /api/ai/autonomous/gates/{task_id}/approve - Approve a gate
  POST /api/ai/autonomous/gates/{task_id}/reject  - Reject a gate with feedback
  GET  /api/ai/autonomous/gates/{task_id}         - List all gates for task

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
