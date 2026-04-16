---
name: heygen-production-orchestrator
version: 1.0.0
description: |
  End-to-end orchestration for HeyGen demo video production. Single module or batch.
  Coordinates script generation, brand config, API submission, polling, quality gate, and cost tracking.
  Use when: producing demo videos for CCW modules, running batch production, or testing the pipeline.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
---

# HeyGen Production Orchestrator

## Entry Point

This is the main skill for producing HeyGen demo videos. It coordinates all other HeyGen skills.

## Input Parameters

```
--module <name>       Single module (e.g., "products", "dashboard")
--tier <1|2|3|all>    Catalog tier for batch production
--dry-run             Calculate cost and show plan without submitting
--skip-quality        Skip quality gate (for re-takes only)
--budget <usd>        Override monthly budget cap (default: $50)
```

## Production Workflow

### Step 1: Pre-flight Check

```
1. Call GET /api/integrations/heygen/quota
2. Read data/heygen/cost-ledger.json for month-to-date spend
3. Calculate estimated cost for requested modules
4. If cumulative + estimated > budget cap → ABORT with cost report
5. If --dry-run → print cost estimate and exit
```

### Step 2: Per-Module Loop

For each module in the production run (sequential, max 3 minutes between submissions):

```
2a. Generate script using heygen-script-optimizer catalog
    - Select the pre-defined script template for this module
    - Apply duration tier word count enforcement
    - Output: script segments JSON

2b. Apply brand config from heygen-brand-governor
    - Select avatar_id + voice_id based on catalog assignment
    - Select dimensions (1920x1080 for YouTube)
    - Select background colour based on video type

2c. Format API payload
    - Build HeyGen v2 video_inputs array from script segments
    - Set character.avatar_id, voice.input_text, background
    - Set dimension from brand governor

2d. Submit to HeyGen
    - POST /api/integrations/heygen/generate
    - Capture video_id from 202 response
    - Log submission to cost-ledger

2e. Poll for completion
    - GET /api/integrations/heygen/status/{video_id} every 30 seconds
    - Max 20 attempts (10 minutes timeout)
    - If still processing after 10 min → log TIMEOUT, continue to next module

2f. Quality gate (heygen-quality-gate)
    - Verify PASS/WARN/FAIL
    - On FAIL → log, skip publishing, continue batch

2g. Log final cost
    - Append to data/heygen/cost-ledger.json
    - Include actual duration, cost, video_url
```

### Step 3: YouTube Upload Instructions

For each completed video:

```
Upload to: https://studio.youtube.com/channel/UCxJtkvKEpNUhulVZ0suU6yw
Title:     CCW ERP — [Module Name] Demo
Playlist:  CCW Product Demos
Tags:      CCW, ERP, CRM, equipment supplier, [module], demo, tutorial
Description: [Auto-generated from script first 160 chars]
Visibility: Unlisted (until review) → Public
```

### Step 4: Link Back to CCW

After YouTube upload, update the CCW demo video registry:

```
File: data/heygen/video-registry.json
Entry: { module, videoId, youtubeId, youtubeUrl, duration, uploadedAt }
```

The `DemoVideoLink` component in the CCW dashboard reads this registry to display video links.

### Step 5: Completion Report

```
============================================
  HeyGen Production Complete
============================================
  Modules:    14 of 14 (Tier 1)
  Videos:     14 completed, 0 failed
  Duration:   23.5 minutes total
  Cost:       $1.65 USD
  Budget:     $48.35 remaining this month

  YouTube:    Upload 14 videos to Unite-Group channel
  Dashboard:  Update data/heygen/video-registry.json
============================================
```

## Batch Mode

Tier-based batch production:

- `--tier 1` → 14 core module videos (~$1.65)
- `--tier 2` → 6 secondary module videos (~$0.42)
- `--tier 3` → 4 cross-cutting overviews (~$0.60)
- `--tier all` → All 24 videos (~$2.94 with 10% buffer)

## Reference Files

- `apps/backend/src/api/routes/integrations/heygen.py` — 5 API endpoints
- `apps/web/lib/api/heygen.ts` — frontend client
- `.claude/skills/heygen-brand-governor/SKILL.md` — avatar/voice/style rules
- `.claude/skills/heygen-script-optimizer/SKILL.md` — script formatting + catalog
- `.claude/skills/heygen-quality-gate/SKILL.md` — post-production checks
- `.claude/skills/heygen-cost-tracker/SKILL.md` — budget management
