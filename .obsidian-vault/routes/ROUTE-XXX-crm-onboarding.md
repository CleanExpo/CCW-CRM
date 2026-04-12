---
type: 'route'
id: 'ROUTE-XXX'
file: 'apps/backend/src/api/routes/crm_onboarding.py'
prefix: '/api/crm/onboarding'
domain: 'CRM'
auth: 'JWT'
status: 'Active'
endpoint_count: 0
registered: true
links: []
last_verified: '2026-03-23'
---

# ROUTE-XXX: Crm Onboarding

## Overview

CRM Onboarding Sequences — UNI-1113

When a new client signs up, automatically schedule:
Day 1: Welcome email + quick-start checklist
Day 7: Check-in (did they use the platform?)
Day 30: Value receipt (what they've done/saved)

Triggered on new customer creation.
Cancelled automatically if customer becomes inactive.
Uses existing SendGrid integration — no new API spend.

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
