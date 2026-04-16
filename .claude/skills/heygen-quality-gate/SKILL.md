---
name: heygen-quality-gate
version: 1.0.0
description: |
  Post-production validation for HeyGen demo videos. Checks completion status, duration
  tolerance, cost compliance, and URL availability before publishing.
  Use when: a HeyGen video has finished rendering and needs verification before upload.
allowed-tools:
  - Bash
  - Read
  - Grep
---

# HeyGen Quality Gate

## Checks

### 1. Completion Status

- `status` must be `"completed"`
- If `"failed"` → **FAIL** with error message
- If `"processing"` or `"pending"` → **FAIL** (timeout — should not reach gate)

### 2. Duration Tolerance

- Actual duration must be within **±15%** of expected duration
- Expected duration comes from heygen-script-optimizer output
- Example: 120s expected → acceptable range 102s–138s
- Outside range → **WARN** (may indicate script truncation or padding)

### 3. Cost Compliance

- Actual `estimated_cost_usd` must be **≤125%** of pre-production estimate
- Example: $0.14 estimate → $0.175 max acceptable
- Over 125% → **WARN** (unexpected cost — investigate before batch continues)

### 4. URL Availability

- `video_url` must be present and non-null → **FAIL** if missing
- `thumbnail_url` should be present → **WARN** if missing (non-blocking)

### 5. Error Field

- `error` field must be `null` → **FAIL** if populated

## Verdicts

| Verdict  | Meaning                      | Action                                       |
| -------- | ---------------------------- | -------------------------------------------- |
| **PASS** | All checks green             | Proceed to YouTube upload                    |
| **WARN** | Non-critical issues detected | Proceed with logged warning                  |
| **FAIL** | Critical issue               | Halt this video; log failure; continue batch |

## Output Format

```json
{
  "video_id": "abc123",
  "module": "products",
  "verdict": "PASS",
  "checks": {
    "completion": { "status": "PASS", "value": "completed" },
    "duration": { "status": "PASS", "expected": 120, "actual": 118, "tolerance": "±15%" },
    "cost": { "status": "PASS", "estimated": 0.14, "actual": 0.14 },
    "video_url": { "status": "PASS", "present": true },
    "thumbnail_url": { "status": "PASS", "present": true },
    "error": { "status": "PASS", "value": null }
  }
}
```

## Reference Files

- `apps/backend/src/api/routes/integrations/heygen.py` — `VideoStatusResponse` model
- `apps/backend/src/integrations/heygen/client.py` — `estimate_cost_usd()` method
