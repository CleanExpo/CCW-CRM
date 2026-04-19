# Load Test Scripts

k6 scripts for CCW-ERP performance baselines and abuse-guardrail verification.

## Prerequisites

Install k6 (v0.46+):

```bash
# macOS
brew install k6

# Windows (Chocolatey)
choco install k6

# Docker
docker pull grafana/k6
```

---

## Scripts

### `baseline.js` — Latency baseline (UNI-1919)

Measures p50/p95/p99 for `/api/dashboard`, `/api/orders`, and `/api/quotes`
across three VU stages: **10 → 50 → 100**, five minutes each.

**Expected duration:** ~15 minutes.

```bash
# Local dev stack
k6 run scripts/load/baseline.js

# Staging
BASE_URL=https://api.staging.ccw-erp.com \
  AUTH_EMAIL=admin@demo.com AUTH_PASSWORD=demo123 \
  k6 run scripts/load/baseline.js

# Save JSON summary (pipe into baseline doc)
k6 run \
  --summary-export docs/perf/baseline-summary.json \
  scripts/load/baseline.js
```

**Thresholds that gate a pass:**
| Metric | Threshold |
|--------|-----------|
| `http_req_duration` p95 | < 500 ms |
| `dashboard_duration` p95 | < 500 ms |
| `orders_duration` p95 | < 500 ms |
| `quotes_duration` p95 | < 500 ms |
| Error rate | < 1 % |

---

### `rate-limit-smoke.js` — Rate-limit verification (UNI-1917)

Confirms the global 100 req/min ceiling and the 5 req/min login limit.
Returns non-zero exit code if rate limiting is absent.

```bash
# Full smoke test (two scenarios run sequentially)
k6 run scripts/load/rate-limit-smoke.js

# Login brute-force scenario only
K6_SCENARIO_NAME=login_brute_force \
  k6 run --scenario login_brute_force scripts/load/rate-limit-smoke.js
```

---

## Reading Results

k6 prints a summary table after each run. Key columns:

- **avg / p(50) / p(95) / p(99)** — latency percentiles in ms
- **reqs/s** — throughput
- **✓ / ✗** — check pass/fail counts

Export the JSON summary and paste the `http_req_duration` block into
`docs/perf/baseline-2026-04.md` when recording a new baseline.
