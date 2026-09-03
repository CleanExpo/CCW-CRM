# Handoff — CCW-CRM Day 1 build agent (Claude Code on the web), 03/09/2026

Written per the context-ceiling rule (RA-7433). A successor session reads this first.

## Goal

Work Phill's Day 1 order (UNI-2342 first) under the 03/09 lane ruling (UNI-2639): FLOW ships
on tested + gate green + audit receipt + staging smoke; ENGINEER goes to Rana; FOUNDER goes to
Phill as BLOCKED-ON-FOUNDER with what a GO unlocks. Nothing sits more than 7 days.

## State

- Repo: CleanExpo/CCW-CRM, branch `claude/vibrant-lovelace-olw0dy` on main `d0d72ec`.
- No `claude-hooks-mirror/` exists in the repo; `hooks/hooks.json` is empty; `.claude/settings.json`
  says hooks are deliberately absent and the gate is CI (`boardroom-ci.yml`) plus the eleven-command
  definition of done in CLAUDE.md. senior-harness skill (Skill-Library) was not reachable.
- The sandbox proxy blocks direct curl to `*.vercel.app`; use the Vercel MCP fetch tool.
- `apps/backend/` (the three locked files) does not exist in this repo. Nothing touched them.

## Done, with evidence

1. Orientation posted to Slack #mission-control-daily at 03/09 12:59 AEST
   (p1788404381823659) in the pinned format.
2. UNI-2342 diagnosed. `/api/health` 503 `ProbeTimeout`, `configured=true` (Vercel fetch 03/09
   12:57 AEST). Supabase `pwwwhoaxxtkmowifpuwf` is NOT the ERP database (no `app_users`, no
   `_prisma_migrations`, `customers` 0 rows; SQL 03/09 12:57 AEST). Runbooks name
   `vwfgksqkajnpfjospbpe`, outside the Unite-Group Supabase org. Direct Supabase hosts resolve to
   no IPv4; pooler hosts do. Commit `420b0ae`: `/api/health` now reports `database.host_class` and
   a pooler hint for the direct-host case. Linear comment 9028c3f6 on UNI-2342. BLOCKED-ON-FOUNDER.
3. UNI-2483/2491: commit `05daf3e` adds `npm run proof:runtime-receipt` (redacted, SHA-256
   receipt; 7 unit tests). Linear report-backs posted on both. CI on main green (Boardroom CI 596,
   CI 1143); Deploy to Staging failing every push since at least 20/08 (runs 819–822).
4. UNI-2117: written down why stuck (no PR, no branch, wrong path in description; no session
   versioning; Math.random temp password returned to inviter) with a four-point slice for Rana.
5. UNI-2104: spec-back posted (outcome sentence, six-step browser test, two blocking facts:
   `ALLOW_PUBLIC_REGISTRATION` default-deny and no sign-up link on `/`). Awaiting GO.

Local checks run on this branch: `npm run type-check` exit 0; eslint on touched files exit 0;
vitest on touched files 45 tests passing. Full eleven-command definition of done NOT yet run.

## Next

- Run the full definition of done on the branch, then push and open a DRAFT PR (human merge only).
- UNI-2108: smoke pack needs a database in CI (Postgres service + `prisma migrate deploy` + seed)
  before it can be a required check; the existing Browser Suite job only covers public routes.
- UNI-2255: write `scripts/cin7-dedupe-customers.mjs` — dry-run default, group by normalised
  `companyName|phone|city` among no-email customers, survivor = oldest, FK repoint across the
  eleven Customer relations (persona and priceTier are 1:1), backup step (`pg_dump` of
  `customers` + dependents to a file, and a JSON plan file), `--execute --confirm-remote` to run.
- Then UNI-2257 (Branch model), UNI-2258 (Internal Customer Types). Phase 2 / Margot wait.

## Blockers

- UNI-2342: founder sets `DATABASE_URL` (ccw-crm-web, production) to the `vwfgksqkajnpfjospbpe`
  transaction-pooler URI, redeploys without cache. Then verify `/api/health` and post timestamp.
- UNI-2104: GO on public sign-up vs invite-only and the outcome sentence.
- UNI-2117: Rana's date, or kill under aging.

## Issue ids

UNI-2342, UNI-2483, UNI-2491, UNI-2104, UNI-2108, UNI-2117, UNI-2109, UNI-2254, UNI-2255,
UNI-2257, UNI-2258, UNI-2454 (UNI-2455–2462), UNI-2311–2327, UNI-2337, UNI-2639.
