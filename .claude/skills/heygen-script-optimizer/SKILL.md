---
name: heygen-script-optimizer
version: 1.0.0
description: |
  Transforms raw narration scripts into HeyGen-optimised format. Handles character limits,
  avatar speech pacing (140 wpm), segment splitting, and duration tier enforcement.
  Use when: preparing a script for HeyGen avatar delivery, or generating module demo scripts.
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
---

# HeyGen Script Optimizer

## HeyGen Constraints

- **Pacing:** ~140 words per minute (avatar lip-sync, not raw TTS)
- **Character limit:** 5000 per API request; enforce **2500 max** for quality
- **No SSML:** Strip all `<break>`, `<emphasis>`, `<prosody>` tags
- **No stage directions:** Remove `[pause]`, `(gestures)`, sound cues
- **Screen references:** Convert "click the button on screen" → "head to your Products page"

## Duration Tiers

| Duration | Words | Characters (~5 chars/word) |
|----------|-------|---------------------------|
| 30s | 70 | 350 |
| 60s | 140 | 700 |
| 90s | 210 | 1050 |
| 120s | 280 | 1400 |
| 180s | 420 | 2100 |

## Output Format

```json
{
  "module": "products",
  "videoType": "walkthrough",
  "segments": [
    {
      "text": "You're managing hundreds of SKUs across multiple suppliers...",
      "char_count": 1200,
      "word_count": 240,
      "estimated_seconds": 103,
      "avatar_id": "josh_lite3_20230714",
      "voice_id": "2d5b0e6cf36f460aa7fc47e3eee4ba54"
    }
  ],
  "total_duration_seconds": 103,
  "total_chars": 1200,
  "estimated_cost_usd": 0.12
}
```

## Demo Video Catalog — 24 Scripts

### Tier 1 — Core Modules (14 videos)

| # | Module | Duration | Type | Avatar | Voice |
|---|--------|----------|------|--------|-------|
| 1 | Dashboard | 120s | Overview | Daisy | Sarah |
| 2 | Products | 120s | Walkthrough | Josh | James |
| 3 | Customers | 120s | Walkthrough | Daisy | Sarah |
| 4 | Orders | 120s | Process demo | Josh | James |
| 5 | Quotes | 90s | Workflow | Daisy | Sarah |
| 6 | POS | 120s | Feature demo | Anna | Sarah |
| 7 | Invoices | 90s | Billing demo | Josh | James |
| 8 | Warehouse | 120s | Operations | Josh | James |
| 9 | Suppliers | 90s | Management | Daisy | Sarah |
| 10 | Purchase Orders | 90s | Procurement | Anna | Sarah |
| 11 | Contacts | 90s | CRM | Daisy | Sarah |
| 12 | Reports | 90s | Analytics | Josh | James |
| 13 | Settings | 90s | Configuration | Anna | Sarah |
| 14 | Integrations | 90s | Cin7/Xero | Josh | James |

### Tier 2 — Secondary Modules (6 videos)

| # | Module | Duration | Type | Avatar | Voice |
|---|--------|----------|------|--------|-------|
| 15 | Workflows | 60s | Automation | Daisy | Sarah |
| 16 | Workshop | 60s | Management | Josh | James |
| 17 | AI Assistant | 90s | Feature demo | Daisy | Sarah |
| 18 | Marketing | 60s | Campaign | Anna | Sarah |
| 19 | Shipments | 60s | Tracking | Josh | James |
| 20 | Backorders | 60s | Auto-reorder | Daisy | Sarah |

### Tier 3 — Cross-Cutting Overviews (4 videos)

| # | Module | Duration | Type | Avatar | Voice |
|---|--------|----------|------|--------|-------|
| 21 | CCW Platform Overview | 180s | Executive | Daisy | Sarah |
| 22 | Why CCW for Tradies | 120s | Sales pitch | Josh | James |
| 23 | CCW vs Spreadsheets | 90s | Comparison | Anna | Sarah |
| 24 | Integration Story | 120s | Technical | Josh | James |

## Reference Files

- `apps/backend/src/integrations/heygen/live_client.py` — `input_text` field in voice object
- `apps/backend/src/config/heygen_settings.py` — cost rate ($0.07/min)
