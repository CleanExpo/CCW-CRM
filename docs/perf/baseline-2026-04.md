# CCW-ERP Performance Baseline — April 2026

**Ticket:** UNI-1920  
**Script:** `scripts/load/baseline.js`  
**Run date:** _populate after first k6 run_  
**Stack:** Railway (backend) + Supabase Cloud (DB) + Vercel (frontend)  
**DB pool:** `pool_size=20`, `max_overflow=40`

---

## How to Reproduce

```bash
# Against staging (recommended for baseline)
BASE_URL=https://api.staging.ccw-erp.com \
  AUTH_EMAIL=admin@demo.com AUTH_PASSWORD=demo123 \
  k6 run --summary-export docs/perf/baseline-summary.json scripts/load/baseline.js
```

Copy the `http_req_duration` and per-endpoint trend blocks from `baseline-summary.json`
into the tables below.

---

## Results

### Stage 1 — 10 VUs (steady-state, low traffic)

| Endpoint                 | p50 (ms) | p95 (ms) | p99 (ms) | Reqs/s | Error % |
| ------------------------ | -------- | -------- | -------- | ------ | ------- |
| `/api/dashboard/metrics` | _TBD_    | _TBD_    | _TBD_    | _TBD_  | _TBD_   |
| `/api/orders`            | _TBD_    | _TBD_    | _TBD_    | _TBD_  | _TBD_   |
| `/api/quotes`            | _TBD_    | _TBD_    | _TBD_    | _TBD_  | _TBD_   |

### Stage 2 — 50 VUs (expected launch peak)

| Endpoint                 | p50 (ms) | p95 (ms) | p99 (ms) | Reqs/s | Error % |
| ------------------------ | -------- | -------- | -------- | ------ | ------- |
| `/api/dashboard/metrics` | _TBD_    | _TBD_    | _TBD_    | _TBD_  | _TBD_   |
| `/api/orders`            | _TBD_    | _TBD_    | _TBD_    | _TBD_  | _TBD_   |
| `/api/quotes`            | _TBD_    | _TBD_    | _TBD_    | _TBD_  | _TBD_   |

### Stage 3 — 100 VUs (2× launch peak, stress ceiling)

| Endpoint                 | p50 (ms) | p95 (ms) | p99 (ms) | Reqs/s | Error % |
| ------------------------ | -------- | -------- | -------- | ------ | ------- |
| `/api/dashboard/metrics` | _TBD_    | _TBD_    | _TBD_    | _TBD_  | _TBD_   |
| `/api/orders`            | _TBD_    | _TBD_    | _TBD_    | _TBD_  | _TBD_   |
| `/api/quotes`            | _TBD_    | _TBD_    | _TBD_    | _TBD_  | _TBD_   |

---

## Breaking Point

> _Populate after run: the first stage where p95 > 500 ms OR error rate > 1 %._

| VU count where first failure observed        | _TBD_ |
| -------------------------------------------- | ----- |
| First endpoint to degrade                    | _TBD_ |
| Root cause (connection pool? DB query? N+1?) | _TBD_ |

---

## Capacity Recommendation

### Current Railway plan

_Document plan name, RAM, CPU, replicas here._

### Launch load estimate

- Expected peak concurrent users at launch: **~20–30** (internal team + first customers)
- Equivalent VU count in k6: **~30** (1 VU ≈ 1 active browser session)

### Sizing recommendation

| Scenario              | Recommended plan                  | Reasoning                                             |
| --------------------- | --------------------------------- | ----------------------------------------------------- |
| Launch (≤30 users)    | Current plan                      | If p95 < 500 ms at 50 VUs, current plan is sufficient |
| 2× growth (≤60 users) | Upgrade if p95 > 400 ms at 50 VUs | Headroom before hitting pool limits                   |
| Scale (>100 users)    | Horizontal scaling (2+ replicas)  | Pool exhaustion risk at `pool_size=20` per instance   |

### DB connection pool analysis

At 100 VUs with 3 endpoints per iteration and `sleep(1s)` between each:

- Theoretical max concurrent DB connections: `100 VUs × 3 concurrent queries = 300`
- Pool capacity: `pool_size(20) + max_overflow(40) = 60` per process
- **Action required** if p95 degrades at 100 VUs: either increase pool or add replica

---

## Threshold Gates (from `baseline.js`)

| Metric                   | Threshold | Status          |
| ------------------------ | --------- | --------------- |
| `http_req_duration` p95  | < 500 ms  | _TBD after run_ |
| `dashboard_duration` p95 | < 500 ms  | _TBD after run_ |
| `orders_duration` p95    | < 500 ms  | _TBD after run_ |
| `quotes_duration` p95    | < 500 ms  | _TBD after run_ |
| Error rate               | < 1 %     | _TBD after run_ |

---

_Document last updated: 2026-04-19 (template created, run pending)_
