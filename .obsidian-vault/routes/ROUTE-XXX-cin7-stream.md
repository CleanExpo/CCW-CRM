---
type: 'route'
id: 'ROUTE-XXX'
file: 'apps/backend/src/api/routes/integrations/cin7_stream.py'
prefix: '/api/integrations/cin7'
domain: 'CRM'
auth: 'JWT'
status: 'Active'
endpoint_count: 0
registered: true
links: []
last_verified: '2026-03-23'
---

# ROUTE-XXX: Cin7 Stream

## Overview

Cin7 real-time SSE stream and polling endpoints.

Provides Server-Sent Events stream for real-time Cin7 sync events,
plus manual polling trigger and status endpoints. Follows the pattern
established by ``dashboard_stream.py``.

Frontend usage::

    const es = new EventSource('/api/integrations/cin7/stream');
    es.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('Cin7 event:', data);
    };

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
