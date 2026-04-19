# CCW-CRM Service Level Objectives

**Service tier:** CCW-CRM Production  
**Owner:** Product + SRE  
**Effective:** 19/04/2026  
**Review cadence:** Monthly (first Monday of each month)

---

## Service Level Indicators (SLIs)

| SLI                     | Measurement                                        | Window         |
| ----------------------- | -------------------------------------------------- | -------------- |
| **Availability**        | % of `/api/*` requests returning HTTP 2xx or 3xx   | 28-day rolling |
| **Latency**             | p95 response time across all `/api/*` requests     | 28-day rolling |
| **Cin7 sync freshness** | Maximum age of the last _successful_ Cin7 sync run | Continuous     |

### Measurement sources

- **Availability & latency** — BetterStack Uptime monitors + Vercel Analytics (request breakdown per route). Backend structured logs (`structlog`) are the source of truth for error classification; see `apps/backend/src/api/main.py` for the logging middleware.
- **Cin7 sync freshness** — `cin7_sync_logs` table (see `apps/backend/src/db/cin7_models.py`). The sync routes in `apps/backend/src/api/routes/integrations/cin7_sync.py` write a log row on each run. Query `SELECT MAX(completed_at) FROM cin7_sync_logs WHERE status = 'success'` to derive current age.

---

## Service Level Objectives (SLOs)

| SLO                     | Target             | Error budget (28 days) |
| ----------------------- | ------------------ | ---------------------- |
| **Availability**        | ≥ 99.5%            | 21.9 min downtime      |
| **p95 latency**         | < 500 ms           | N/A (threshold-based)  |
| **Cin7 sync freshness** | < 5 min end-to-end | N/A (threshold-based)  |

---

## Error Budget Policy

### Availability budget

| Burn rate     | Threshold                     | Action                                                                        |
| ------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| 50% consumed  | 10.95 min downtime in 28 days | Engineering lead notified. Review incident history in next sprint planning.   |
| 80% consumed  | 17.52 min downtime in 28 days | Freeze non-critical deploys. Incident retrospective required before resuming. |
| 100% consumed | 21.9 min downtime in 28 days  | Full deploy freeze. Mandatory RCA. SLO renegotiation at next monthly review.  |

### Latency budget

- **Sustained p95 > 500 ms for > 5 min** — on-call paged immediately.
- **Sustained p95 > 1,000 ms for > 2 min** — treat as SEV-1, engage engineering lead.

### Cin7 sync freshness

- **Staleness > 5 min** — alert fires, on-call investigates sync logs and Cin7 API health.
- **Staleness > 15 min** — SEV-1. Manual re-trigger via `POST /api/integrations/cin7/sync/products` and `POST /api/integrations/cin7/sync/inventory`. See `apps/backend/src/api/routes/integrations/cin7_sync.py`.

---

## Alert Routing

All SLO breach alerts route to the **#oncall** Slack channel.

| Alert                            | Severity | Channel | Paging threshold |
| -------------------------------- | -------- | ------- | ---------------- |
| Availability drop below 99.5%    | SEV-1    | #oncall | Immediate        |
| Availability budget > 80% burned | SEV-2    | #oncall | Within 15 min    |
| p95 latency > 500 ms sustained   | SEV-1    | #oncall | Immediate        |
| Cin7 sync stale > 5 min          | SEV-2    | #oncall | Within 15 min    |
| Cin7 sync stale > 15 min         | SEV-1    | #oncall | Immediate        |

Alert wiring (BetterStack → Slack) is documented in [`docs/slo/betterstack-setup.md`](betterstack-setup.md).

---

## Ownership

| Role             | Responsibility                                              |
| ---------------- | ----------------------------------------------------------- |
| Product          | SLO target approval, monthly review, customer communication |
| Engineering lead | Incident response, error budget policy enforcement          |
| On-call engineer | First responder for SEV-1/SEV-2 alerts (rotated weekly)     |

---

## Monthly Review

Each review must assess:

1. Actual availability vs. 99.5% target (pull from BetterStack 28-day report).
2. p95 latency trend — identify routes breaching 500 ms.
3. Cin7 sync freshness — review any staleness incidents in the period.
4. Error budget remaining — decide whether to tighten, relax, or hold targets.
5. Any open incidents affecting SLOs — link to postmortem docs.

Review output is logged in [`docs/PROGRESS.md`](../../.claude/PROGRESS.md) under the relevant sprint.
