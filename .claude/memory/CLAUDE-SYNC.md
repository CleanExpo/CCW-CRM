# Claude Chat → Cowork → Code — Sync Architecture (UNI-1716)

**Version**: 2.1 | **Updated**: 2026-03-31 | **Aligns with**: Claude v2.1.86

---

## Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1 — Claude Chat (claude.ai)                              │
│  Model: claude-opus-4-6 | Extended thinking: max               │
│  Role: Strategy, boardroom deliberation, CEO debrief            │
│  When: On-demand sessions + scheduled Cowork handoffs           │
└────────────────────────┬────────────────────────────────────────┘
                         │ cycle_complete.json → next session context
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2 — Claude Cowork (Scheduled Claude Code sessions)       │
│  Model: claude-sonnet-4-6 | effort: high                        │
│  Schedule: 06:00 / 12:00 / 18:00 / 00:00 AEST daily            │
│  Role: Monitoring, research synthesis, Linear logging, CRON     │
└────────────────────────┬────────────────────────────────────────┘
                         │ build tasks, render jobs, uploads
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3 — Claude Code (local / CI / GitHub Actions)            │
│  Model: claude-haiku-4-5-20251001 | speed-optimised             │
│  Role: Build — Remotion render, ElevenLabs, YouTube upload      │
│  When: Triggered by Cowork handoff or manual invocation         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Model Assignments (Source: docs.anthropic.com/models/overview)

| Role                               | Model                       | Thinking config            |
| ---------------------------------- | --------------------------- | -------------------------- |
| Orchestrator + Moon Shooter (Chat) | `claude-opus-4-6`           | `adaptive`, effort: `max`  |
| All 10 Board Members (Cowork)      | `claude-sonnet-4-6`         | `adaptive`, effort: `high` |
| Scout Swarm + Witness (Code)       | `claude-haiku-4-5-20251001` | No thinking (speed)        |
| Retro generation                   | `claude-haiku-4-5-20251001` | No thinking (speed)        |

---

## Sync Protocol

### Chat → Cowork Handoff

1. Chat session produces `data/sessions/{sessionId}/debrief.json`
2. Cowork reads `data/sessions/last_session.json` at session start (bootstrap step)
3. `nextSessionContext` field in `cycle_complete.json` is injected as context prefix

### Cowork → Code Handoff

1. Cowork writes `data/sessions/{sessionId}/video-brief.json`
2. Code picks up via `VIDEO_OUTPUT_DIR` env var pointing to `data/sessions/`
3. Remotion reads `render-props.json`, ElevenLabs reads `video-brief.json`

### Code → Chat Feedback

1. YouTube video ID stored in `debrief.json.youtubeVideoId`
2. Next Chat session reads this from `last_session.json`
3. Board members reference video in next session debrief

---

## Project → Workspace Mapping

| Claude Chat Project | Cowork Task                   | Code Workspace   | Linear Team   |
| ------------------- | ----------------------------- | ---------------- | ------------- |
| CCW Boardroom       | `ccw-board-room-6hr-meetings` | `CCW-CRM/`       | Unite-Group   |
| CARSI LMS           | `carsi-autonomous-sessions`   | `CARSI/`         | G-Pilot       |
| RestoreAssist       | `restoreassist-sessions`      | `RestoreAssist/` | RestoreAssist |
| G-Pilot Hub         | `gpilot-hub-sessions`         | `G-Pilot/`       | G-Pilot       |
| Bron Clone          | `bron-sessions`               | `Bron-Clone/`    | Unite-Group   |

---

## Cowork Schedule (AEST)

| Time  | Day     | Session type                                       |
| ----- | ------- | -------------------------------------------------- |
| 06:00 | Monday  | Weekly comprehensive (security audit + full retro) |
| 06:00 | Tue–Sun | Daily standard (scout + board + QA)                |
| 12:00 | Daily   | Mid-day monitoring (preflight + Linear sync)       |
| 18:00 | Daily   | Evening monitoring (endpoint health check)         |
| 00:00 | Daily   | Overnight watch (minimal — preflight only)         |

---

## v2.1.86 Features to Leverage

| Feature                       | How to use in CCW                                               |
| ----------------------------- | --------------------------------------------------------------- |
| Extended thinking (adaptive)  | Already in use for Opus + Sonnet board members                  |
| Improved tool use reliability | Better JSON extraction from board member outputs                |
| Enhanced context retention    | `nextSessionContext` field feeds into every Chat session        |
| Streaming tokens              | Used in ElevenLabs + Remotion steps for real-time progress      |
| Agent Teams (EXPERIMENTAL)    | Parallel board deliberation (see `AGENT-TEAMS-ARCHITECTURE.md`) |

---

## Sync Failure Modes

| Failure              | Detection                            | Recovery                                       |
| -------------------- | ------------------------------------ | ---------------------------------------------- |
| Cowork session fails | `last_session.json` older than 7h    | Alert to Linear UNI-1665 + manual trigger      |
| Code render fails    | `video-brief.json` exists but no MP4 | Retro captures failure, next session re-queues |
| YouTube upload fails | `youtubeVideoId` null in debrief     | Post to Slack instead, retry next session      |
| Chat context lost    | `context-snapshot.md` exists         | Bootstrap reads snapshot, continues from there |
