---
type: route
id: ROUTE-001
file: apps/backend/src/api/routes/demo_health.py
prefix: /api
domain: Infrastructure
auth: Public
status: Active
endpoint_count: 4
registered: true
links:
  - '[[PAGE-001-dashboard]]'
last_verified: 2026-03-23
---

# ROUTE-001: Health Check

## Overview

Health check endpoints for system monitoring and uptime verification. Provides basic health status and database connectivity checks.

<!-- AUTO-GENERATED -->

## Endpoints

### GET /api/health

**Purpose**: Basic health check endpoint returning system status

**Request Parameters**: None

**Response**:

```json
{
  "status": "healthy",
  "timestamp": "2026-03-23T10:00:00Z"
}
```

**Authentication**: Public (no auth required)

### GET /api/health/database

**Purpose**: Database connectivity health check

**Request Parameters**: None

**Response**:

```json
{
  "status": "connected",
  "database": "ccw_erp",
  "latency_ms": 12
}
```

**Authentication**: Public (no auth required)

## Database Models Used

None (read-only health checks)

## Dependencies

- External APIs: None
- Internal services: PostgreSQL database
- Background tasks: None

<!-- END AUTO-GENERATED -->

<!-- HUMAN-CURATED -->

## Architecture Notes

This is a critical monitoring endpoint used by:

- Load balancers for health checks
- Uptime monitoring services (UptimeRobot, Pingdom)
- CI/CD pipelines for deployment verification

Response time should be < 100ms. Database check is heavier (requires connection pool checkout) so use sparingly.

## Testing Notes

Test cases:

- Health endpoint returns 200 with valid JSON
- Database health check returns connection status
- Health checks work without authentication

## Known Issues

None currently. This is a stable, production-ready endpoint.

<!-- END HUMAN-CURATED -->

## Related Pages

- [[PAGE-001-dashboard]]: Dashboard page uses health status widget

## Change History

| Date       | Change                           | Author         |
| ---------- | -------------------------------- | -------------- |
| 2026-03-23 | Created sample doc from template | Auto-generated |
