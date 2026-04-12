# PRD: Sprint 1 Test PRD — 2026-03-24

## Executive Summary

CCW ERP/CRM has 6 identified gaps between backend routes and frontend pages.
This PRD covers the gap resolution priorities ordered by impact x effort score.

## Gap Resolution Priorities

| Rank | Gap                                    | Score | Action                                 |
| ---- | -------------------------------------- | ----- | -------------------------------------- |
| 1    | cron_jobs.py not registered in main.py | 15    | /pi-fix register-router cron_jobs      |
| 2    | Contractors frontend page missing      | 12    | /pi-fix frontend-page contractors      |
| 3    | Service Requests frontend page missing | 12    | /pi-fix frontend-page service-requests |
| 4    | Bank Feeds frontend page missing       | 12    | /pi-fix frontend-page bank-feeds       |
| 5    | AI agents not 1:10 compliant           | 6     | Agent compliance review                |
| 6    | Search Agent blocked (pgvector)        | 4     | Requires schema approval first         |

## Implementation Sequence

1. **cron_jobs.py not registered in main.py** (Score: 15) — /pi-fix register-router cron_jobs
2. **Contractors frontend page missing** (Score: 12) — /pi-fix frontend-page contractors
3. **Service Requests frontend page missing** (Score: 12) — /pi-fix frontend-page service-requests
4. **Bank Feeds frontend page missing** (Score: 12) — /pi-fix frontend-page bank-feeds
5. **AI agents not 1:10 compliant** (Score: 6) — Agent compliance review
6. **Search Agent blocked (pgvector)** (Score: 4) — Requires schema approval first
