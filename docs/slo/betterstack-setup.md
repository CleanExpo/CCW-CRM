# BetterStack Setup Runbook — CCW-CRM SLOs

> **Scope:** External configuration only. This runbook is for a human to complete in the BetterStack and Slack UIs.  
> **Prerequisite:** BetterStack account with access to the CCW organisation. Slack `#oncall` channel exists.

---

## 1. Uptime Monitors

Create the following monitors in **BetterStack → Uptime → Monitors**.

| Monitor name        | URL                                                                | Type  | Check interval | Expected status |
| ------------------- | ------------------------------------------------------------------ | ----- | -------------- | --------------- |
| CCW API Health      | `https://ccw-crm-web.vercel.app/api/health`                        | HTTPS | 30 s           | 200             |
| CCW Frontend        | `https://ccw-crm-web.vercel.app/`                                  | HTTPS | 60 s           | 200             |
| Cin7 Sync Freshness | `https://ccw-crm-web.vercel.app/api/integrations/cin7/sync/status` | HTTPS | 60 s           | 200             |

**For each monitor:**

- Set **Recovery period** to 2 consecutive successes before auto-recover.
- Enable **SSL certificate monitoring** (alert 14 days before expiry).
- Set **Regions**: Sydney + Singapore (nearest to Vercel AU edge).

---

## 2. Dashboards

### Dashboard A — Availability & Latency

Create in **BetterStack → Dashboards → New Dashboard**, name: `CCW-CRM SLOs`.

Add the following widgets:

1. **Availability (28-day)** — metric: uptime %, monitor: `CCW API Health`, window: 28 days. Target line at 99.5%.
2. **Incident timeline** — all monitors, last 28 days.
3. **p95 latency (24 h)** — requires APM or Vercel Analytics webhook data piped into BetterStack Logs. See step 4.
4. **Error rate (24 h)** — % of 4xx/5xx vs total requests from backend structured logs.

### Dashboard B — Cin7 Sync Freshness

Create a second dashboard named `Cin7 Sync Health`.

1. **Sync age** — derived from the `CCW Cin7 Sync Freshness` uptime monitor response body. The endpoint at `GET /api/integrations/cin7/sync/status` should return `{"last_success_age_seconds": N}`. Add a metric widget parsing this field. _(Note: if this endpoint does not yet return that field, add it to `apps/backend/src/api/routes/integrations/cin7_sync.py` first.)_
2. **Sync incident log** — all incidents on the `CCW Cin7 Sync Freshness` monitor.

---

## 3. Alert Policies

Create in **BetterStack → On-Call → Alert Policies**.

### Policy: CCW-SLO-SEV1

| Setting                    | Value                                                     |
| -------------------------- | --------------------------------------------------------- |
| Name                       | CCW SLO SEV-1                                             |
| Triggers                   | Monitor down for ≥ 1 min                                  |
| Escalation delay           | Immediate                                                 |
| Notification               | Slack `#oncall` (webhook — see step 5)                    |
| Repeat if not acknowledged | Every 5 min for 30 min, then escalate to engineering lead |

### Policy: CCW-SLO-SEV2

| Setting                    | Value                    |
| -------------------------- | ------------------------ |
| Name                       | CCW SLO SEV-2            |
| Triggers                   | Monitor down for ≥ 5 min |
| Escalation delay           | 15 min                   |
| Notification               | Slack `#oncall`          |
| Repeat if not acknowledged | Every 15 min for 1 h     |

Assign monitors to policies:

| Monitor                 | Policy                                                      |
| ----------------------- | ----------------------------------------------------------- |
| CCW API Health          | CCW-SLO-SEV1                                                |
| CCW Frontend            | CCW-SLO-SEV1                                                |
| CCW Cin7 Sync Freshness | CCW-SLO-SEV2 (> 5 min stale), CCW-SLO-SEV1 (> 15 min stale) |

For the freshness dual-threshold: configure two separate alert rules on the Cin7 monitor — one at 5 min timeout (SEV-2) and one at 15 min timeout (SEV-1). BetterStack supports this via **custom alert conditions** on the monitor settings.

---

## 4. Log Ingestion (for Latency Metric)

To get p95 latency data into BetterStack:

1. In **BetterStack → Logs → Sources**, create a new source: `CCW Backend`.
2. Copy the ingest token.
3. In the backend environment (Vercel / Supabase Edge Functions), set `BETTERSTACK_LOG_TOKEN=<token>`.
4. In `apps/backend/src/api/main.py`, add a structlog processor that ships log lines to BetterStack HTTP ingest (`https://in.logs.betterstack.com`) using `httpx` async client. Log `request_duration_ms` and `path` fields on every request.
5. In BetterStack Logs, create a **Saved Query**: `path: /api/* | stats p95(request_duration_ms)` with a 28-day window.
6. Pin that query to Dashboard A as a metric widget.

---

## 5. Slack Integration

1. In Slack, go to **#oncall → Integrations → Add an app → Incoming Webhooks**.
2. Create webhook URL. Copy it.
3. In **BetterStack → Integrations → Slack**, paste the webhook URL.
4. Name the integration `CCW #oncall`.
5. Assign it to both alert policies (CCW-SLO-SEV1 and CCW-SLO-SEV2).

Test by triggering a manual incident on the CCW API Health monitor and confirming the message appears in `#oncall`.

---

## 6. Error Budget Tracking

BetterStack does not natively compute error budgets. Recommended approach:

- Export monthly uptime reports (BetterStack → Reports → PDF) and record in the monthly SLO review.
- Alternatively, create a simple script or Supabase Edge Function that queries BetterStack's REST API for uptime % and posts the remaining budget to `#oncall` on the first Monday of each month.
  - BetterStack API docs: `https://betterstack.com/docs/uptime/api/`
  - Relevant endpoint: `GET /api/v2/monitors/:id/incidents` and `GET /api/v2/monitors/:id/status-pages`

---

## Verification Checklist

After completing all steps above:

- [ ] `CCW API Health` monitor shows green in BetterStack dashboard.
- [ ] `CCW Frontend` monitor shows green.
- [ ] `CCW Cin7 Sync Freshness` monitor shows green.
- [ ] Trigger a test alert — confirm message appears in Slack `#oncall` within 2 min.
- [ ] Dashboard A shows 28-day uptime > 99.5%.
- [ ] Dashboard B shows Cin7 sync age < 5 min.
- [ ] SSL expiry alert is enabled on both uptime monitors.
- [ ] Both alert policies have correct escalation paths.
