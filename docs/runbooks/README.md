# Operational Runbooks

Runbooks for CCW-ERP/CRM operational incidents. Each runbook follows a standard format: Symptoms → Severity → First Response → Diagnostic Steps → Resolution Steps → Post-Mortem Template.

## Index

| Runbook                                     | Trigger                                | Severity      |
| ------------------------------------------- | -------------------------------------- | ------------- |
| [CRON Failure](cron-failure.md)             | CRON session does not complete         | HIGH          |
| [Security Incident](incident-response.md)   | Credential exposure, RLS bypass        | CRITICAL/HIGH |
| [Rollback Procedure](rollback-procedure.md) | Production regression after deployment | CRITICAL/HIGH |
| [RLS Emergency](rls-emergency.md)           | Cross-tenant data access detected      | CRITICAL      |
| [API Outage](api-outage.md)                 | External service circuit breaker OPEN  | HIGH/CRITICAL |
| [Session Recovery](session-recovery.md)     | CRON session stuck or stale            | HIGH          |

## Related Docs

- `docs/PRODUCTION-MERGE-PATHWAY.md` — Deployment and release process
- `docs/adr/` — Architecture Decision Records
- `scripts/lib/circuit-breaker.js` — Circuit breaker for external APIs
- `scripts/lib/session-manager.js` — CRON session lifecycle
- `scripts/lib/approval-gate.js` — Approval gates for sensitive operations
- `scripts/lib/audit-logger.js` — JSONL audit logging

## Escalation

| Severity | Response Time | Who to Alert          |
| -------- | ------------- | --------------------- |
| CRITICAL | < 2 minutes   | CTO + CEO immediately |
| HIGH     | < 5 minutes   | CTO                   |
| MEDIUM   | < 30 minutes  | CTO (async)           |

Post to `#ccw-security` for security incidents. Post to `#ccw-ops` for operational incidents.
