# Handoff — CCW-CRM Day 1 build agent (Claude Code on the web), 03/09/2026

Written per the context-ceiling rule (RA-7433). A successor session reads this first. Every figure
names its source and read time; anything without one is a description, not a measurement.

## Goal

Work Phill's Day 1 order (UNI-2342 first) under the 03/09 lane ruling (UNI-2639): FLOW ships on
tested + gate green + audit receipt + staging smoke; ENGINEER goes to Rana; FOUNDER goes to Phill
as BLOCKED-ON-FOUNDER with what a GO unlocks. Nothing sits more than 7 days.

## State

- Repo: CleanExpo/CCW-CRM, branch `claude/vibrant-lovelace-olw0dy`, merge-base with `origin/main`
  at `d0d72ec` (`git merge-base`, 03/09 12:55 AEST). Five commits on the branch, listed below.
- No `claude-hooks-mirror/` directory exists in the checkout (`find . -iname '*hooks-mirror*'`,
  03/09 12:55 AEST); `hooks/hooks.json` has empty PreToolUse/PostToolUse/Stop arrays;
  `.claude/settings.json` states hooks are deliberately absent and the gate is
  `.github/workflows/boardroom-ci.yml` plus the eleven commands in CLAUDE.md. The senior-harness
  skill repo (CleanExpo/Skill-Library) returned "not found or no access" via add_repo (03/09 12:56).
- The sandbox proxy refuses CONNECT to `*.vercel.app` (curl exit 56, 03/09 12:56 AEST); the Vercel
  MCP fetch tool works. No Postgres and no Docker daemon in the sandbox (`docker info` failed,
  03/09 13:27 AEST), so nothing database-backed was rehearsed here.
- The three locked files named in the brief (`apps/backend/src/db/demo_models.py`,
  `apps/web/middleware.ts`, `apps/backend/src/api/routes/demo_auth.py`) do not exist in this
  repository (`git ls-files | grep -c ^apps/` = 0, 03/09 12:58 AEST). Nothing on the branch touches
  any path under `apps/`.

## Done, with evidence

1. **Orientation** posted to Slack #mission-control-daily (C0BVBR21FC0) at 03/09 12:59 AEST,
   message ts 1788404381.823659, in the pinned MACHINE/MOVED/STALLED/NUMBERS/BLOCKED format.
2. **UNI-2342 diagnosed** (Linear comment 9028c3f6, 03/09 13:10 AEST):
   `https://ccw-crm-web.vercel.app/api/health` HTTP 503, `database.configured=true`,
   `reachable=false`, `error=ProbeTimeout` (Vercel MCP fetch, 03/09 12:57 AEST). Supabase
   `pwwwhoaxxtkmowifpuwf` has no `app_users`, no `_prisma_migrations`, `customers` 0 rows, 255
   public tables (Supabase MCP SQL, 03/09 12:57 AEST), so it is not the ERP database. The runbooks
   `.env.example`, `docs/MIGRATION-STRATEGY.md`, `docs/ccw-handoff-runbook.md` name
   `vwfgksqkajnpfjospbpe`, absent from the Unite-Group Supabase org (Supabase list_projects,
   03/09 12:58 AEST). `getent ahosts` in the sandbox at 03/09 12:59 AEST: both
   `db.<ref>.supabase.co` hosts returned no address, `aws-1-ap-southeast-2.pooler.supabase.com`
   returned two IPv4 addresses. Commit `420b0ae` adds `database.host_class` and a hedged pooler
   hint to `/api/health`. **BLOCKED-ON-FOUNDER**: set `DATABASE_URL` (ccw-crm-web, production) to
   the `vwfgksqkajnpfjospbpe` transaction-pooler URI, redeploy without cache, then verify.
3. **UNI-2483/2491**: commit `05daf3e` adds `npm run proof:runtime-receipt` (redacted, digested
   receipt). Report-backs posted (Linear comments b50e83f7 and b3c4cec5, 03/09 13:20 AEST).
   GitHub Actions on main `d0d72ec` (read 03/09 13:15 AEST): CCW Boardroom CI run 596 success, CI
   run 1143 success, Deploy to Staging run 822 failure; Deploy to Staging runs 819–822 all failure,
   run 819 dated 20/08.
4. **UNI-2117**: why-stuck and a four-point slice for Rana on Linear (comment 1d5712e1). No PR or
   branch references the issue (GitHub search, 03/09 13:05 AEST).
5. **UNI-2104**: spec-back on Linear (comment 3804aab6). Awaiting GO on public sign-up vs
   invite-only; `ALLOW_PUBLIC_REGISTRATION` is default-deny and `/` has no sign-up link.
6. **UNI-2108**: parked on Linear with target 10/09 (comment ae7ab6b1) and a CI design; not wired
   in because it cannot be rehearsed without a database.
7. **UNI-2255**: commit `f0a6514` adds `npm run cin7:dedupe-customers` (dry-run default, plan +
   backup + one transaction + rollback). Linear comment 3594aa1e. Prior work found and kept:
   `src/lib/integrations/cin7-duplicate-cleanup.ts` (delete-only) and the
   `CIN7_ALLOW_DUPLICATE_CLEANUP` gate in `src/app/api/integrations/cin7/cleanup-duplicates/route.ts`.
   Survivor rule: Cin7-linked row, then most linked records, then oldest. **Not run.**
8. **Independent review, pass one** (ccw-adversary agent, bound to `f0a6514`, returned before the
   fix commit `5e42b8f` at 13:38 AEST) refuted: receipt redaction (JWT, bearer, session and
   credential keys, mysql and redis DSNs), `base_url` userinfo recorded verbatim, the unkeyed digest
   presented as tamper detection, exit 1 on an unreachable target; dedupe 1:1 double-repoint,
   rollback table-name interpolation, node-side timestamp serialisation, the unconstrained
   `ccw_ai_call_sessions.customer_id` pointer, backup outside the lock; the unconditional health
   hint and no real-URL route test; and a stale handoff. Fixed in `5e42b8f`.
9. **Independent review, pass two** (bound to `5e42b8f`, returned before the next fix commit)
   refuted: fetch still used the URL with userinfo (Node refuses it), `cause.code` not captured,
   key list still missing `key`/`pass`/`pwd`/`service_role` and inline `x=value` pairs; the dedupe
   plan built before the lock without a recount; handoff figures for the wrong SHA. Fixed in the
   commit after `5e42b8f` (see `git log`), with a lock-time recount that aborts on any change.

Gate evidence so far, each bound to its SHA (scratchpad logs, eleven commands each, all exit 0):
`f0a6514` at 03/09 13:35 AEST (vitest 80 files passed, 1 skipped; 621 tests passed, 2 skipped);
`5e42b8f` at 03/09 13:48 AEST (81 files passed, 1 skipped; 630 tests passed, 2 skipped). The
skipped file is the `TEST_DATABASE_URL`-gated one CLAUDE.md names. The final commit's own run is
pasted into the pull request body; a figure here for a SHA that is not HEAD is history, not state.

## Next

- Push as a DRAFT pull request only after the eleven commands and a fresh adversary pass are bound
  to the final SHA. Human merge only.
- UNI-2342 on GO: read `/api/health` (expect `host_class=supabase-pooler`, `reachable=true`), post
  the timestamp on the issue and in Slack, run `npm run proof:runtime-receipt` for UNI-2483.
- UNI-2255 on GO: dry run with `--out plan.json --expected-cin7-count 22640` (the 22,640 figure is
  Toby's Cin7 count as quoted in the UNI-2255 description, read 03/09 12:56 AEST), post the plan,
  then execute per the issue comment.
- UNI-2108 by 10/09; then UNI-2257 (Branch model) and UNI-2258; Phase 2 and Margot wait on 1–5.

## Blockers

- UNI-2342: founder or Rana sets `DATABASE_URL` as above.
- UNI-2104: GO on sign-up model and outcome sentence.
- UNI-2117: Rana's date, or kill under aging.
- UNI-2255: founder GO for execution, and a reachable database for even the dry run.

## Issue ids

UNI-2342, UNI-2483, UNI-2491, UNI-2104, UNI-2108, UNI-2117, UNI-2109, UNI-2254, UNI-2255,
UNI-2257, UNI-2258, UNI-2337, UNI-2454 (UNI-2455–2462), UNI-2311–2327, UNI-2639.
