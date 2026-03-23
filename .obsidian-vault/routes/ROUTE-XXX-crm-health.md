---
type: 'route'
id: 'ROUTE-XXX'
file: 'apps/backend/src/api/routes/crm_health.py'
prefix: '/api/crm'
domain: 'Infrastructure'
auth: 'JWT'
status: 'Active'
endpoint_count: 0
registered: true
links: []
last_verified: '2026-03-23'
---

# ROUTE-XXX: Crm Health

## Overview

CRM Client Health Dashboard — UNI-1114

Computes a 0–100 health score per customer based on existing data:
- Recency      (30pts): days since last order
- Volume       (30pts): total order count
- Engagement   (20pts): quote activity
- Account      (20pts): account is_active flag

Status thresholds:
- Green  (70–100): healthy, active client
- Amber  (40–69):  at-risk, needs attention
- Red    (0–39):   churned or dormant

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
