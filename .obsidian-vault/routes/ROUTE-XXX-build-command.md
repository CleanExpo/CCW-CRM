---
type: 'route'
id: 'ROUTE-XXX'
file: 'apps/backend/src/api/routes/ai/build_command.py'
prefix: '/api/ai/build'
domain: 'CRM'
auth: 'JWT'
status: 'Active'
endpoint_count: 0
registered: true
links: []
last_verified: '2026-03-23'
---

# ROUTE-XXX: Build Command

## Overview

Build Command Handler

Implements the /build command workflow: EXTRACT → APPROVE → EXECUTE

3-stage workflow:
Stage 1: Parse natural language → extract structured spec → save to disk
Stage 2: Return spec to user → wait for approval
Stage 3: Trigger /autonomous workflow with spec context

Endpoints:
POST /api/ai/build/start - Initiate build (Stage 1)
POST /api/ai/build/approve - Approve spec (Stage 2 → 3)
GET /api/ai/build/status/{task_id} - Check status

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
