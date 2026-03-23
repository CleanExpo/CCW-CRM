---
type: 'route'
id: 'ROUTE-XXX'
file: 'apps/backend/src/api/routes/cron_jobs.py'
prefix: '/api/cron'
domain: 'CRM'
auth: 'JWT'
status: 'Active'
endpoint_count: 0
registered: true
links: []
last_verified: '2026-03-23'
---

# ROUTE-XXX: Cron Jobs

## Overview

Cron job endpoints for scheduled tasks.

These endpoints are called by Vercel Cron or other schedulers.

Recommended cron schedule (vercel.json):
```json
{
  "crons": [
    {
      "path": "/api/cron/check-expiring-quotes",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/refresh-xero-tokens",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/retry-failed-webhooks",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

ISS-036: Added webhook retry job for failed webhook processing.

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
