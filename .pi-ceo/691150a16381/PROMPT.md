# Task Brief

[HIGH] [Workshop] Build digital job card — Phase 1: schema and time-log API

Description:
## What's missing

No digital job card exists for workshop service jobs. Technicians have no system to log time against jobs, record work performed, or track job progress. Workshop operations are managed on paper or outside the ERP.

**CTO phased delivery:** Phase 1 = job card schema + time-log API only. Parts consumption billing is a separate issue.

## Business impact

Without digital job cards, workshop labour costs are untracked, job profita… (truncated, use `get_issue` for full description)

---

## Karpathy Build Block (verified against codebase 2026-04-17)

**Files** (hints — Glob/Grep to confirm before editing):

```
apps/backend/src/db/workshop_models.py
supabase/migrations/
apps/backend/src/api/routes/service_requests.py
apps/backend/src/api/routes/workshop/
```

**Goal:** workshop_models.JobCard and TimeLog exist; POST /api/workshop/jobs/\[id\]/time-logs persists start/stop entries per tech.

**Verify (runnable):**

```
1. Supabase MCP: list_tables confirms JobCard + TimeLog tables.
2. cd apps/backend && uv run pytest tests/api/ -k job_card
3. UI: /workshop/[id] → 'Start timer' → time log visible; 'Stop' → duration recorded.
```

**Karpathy anchors:** P1 plan-first, P2 simplicity, P3 surgical (only files above), P4 goal-driven verification (all 3 checks must pass).

**Sonnet 4.6 notes:** Read `.claude/SONNET-HANDOFF.md` first. Paths marked `[NEW]` may need creating; verify via Glob before assuming.

Linear ticket: UNI-1825 — https://linear.app/unite-group/issue/UNI-1825/workshop-build-digital-job-card-phase-1-schema-and-time-log-api
Triggered automatically by Pi-CEO autonomous poller.


## Session: 691150a16381
