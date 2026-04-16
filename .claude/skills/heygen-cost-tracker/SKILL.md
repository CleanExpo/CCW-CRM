---
name: heygen-cost-tracker
version: 1.0.0
description: |
  Budget management and cost tracking for HeyGen video production. Maintains a cost ledger,
  provides forecasts, and enforces monthly budget caps.
  Use when: checking HeyGen spend, forecasting batch costs, or reviewing production history.
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
---

# HeyGen Cost Tracker

## Pricing

- **Rate:** $0.07 USD per minute of generated video (from `heygen_settings.py`)
- **Monthly cap:** $50 USD (env var `HEYGEN_MONTHLY_BUDGET_USD`, default 50)
- **Re-take buffer:** 10% added to forecasts

## Ledger Location

`data/heygen/cost-ledger.json`

### Entry Format

```json
{
  "video_id": "abc123def456",
  "module": "products",
  "video_type": "walkthrough",
  "avatar_id": "josh_lite3_20230714",
  "voice_id": "2d5b0e6cf36f460aa7fc47e3eee4ba54",
  "duration_seconds": 118,
  "cost_usd": 0.14,
  "quality_verdict": "PASS",
  "youtube_id": null,
  "timestamp": "2026-03-31T22:15:00Z"
}
```

## Actions

### forecast

Calculate estimated cost for a production run:

```
cost = modules × (avg_duration / 60) × $0.07 × 1.1
```

**Full suite estimates:**
| Tier | Videos | Duration | Cost |
|------|--------|----------|------|
| 1 — Core | 14 | ~23.5 min | ~$1.65 |
| 2 — Secondary | 6 | ~6.0 min | ~$0.42 |
| 3 — Overview | 4 | ~8.5 min | ~$0.60 |
| **All** | **24** | **~38 min** | **~$2.94** |

### log

Append an entry to the cost ledger after each video completion.

### report

Aggregate cost data:

- Total spend (month/all-time)
- Average cost per video
- Cost by module
- Cost by video type
- Remaining monthly budget

### check-budget

Compare cumulative month-to-date spend against cap:

- `UNDER_BUDGET` — proceed normally
- `APPROACHING` — >80% of cap used, warn before continuing
- `OVER_BUDGET` — halt all production, require manual override

## Reference Files

- `apps/backend/src/config/heygen_settings.py` — `cost_per_minute_usd = 0.07`
- `data/heygen/cost-ledger.json` — the ledger file
- `.claude/skills/heygen-production-orchestrator/SKILL.md` — reads budget status
