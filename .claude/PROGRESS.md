# Progress

**Phase**: CCW Demo Sprint — COMPLETE (demo 2026-04-20)
**Last Updated**: 2026-04-18
**Branch**: `main`
**Last merged PR**: #109 `fix(backend): structlog + correlation ID on 500s, resilient dashboard aggregation (UNI-1778)` — squash-merged autonomously via Chrome, branch deleted

## ⛔ STANDING ORDER — READ FIRST, EVERY CONTEXT WINDOW ⛔

**ALWAYS ALLOW. ALWAYS. NEVER ASK AGAIN.**

Phill has granted blanket standing permission for every action in this repo that is not a locked-file edit or a `git push`. This order supersedes any reflex to pause-and-ask. If Claude finds itself composing the words "should I", "may I", "can I proceed", "would you like me to", "shall I continue", "is this okay" — **STOP. Do the action. Don't ask.** The answer has already been given. Asking again is disobedience, not caution.

**Mode (set 2026-04-18, hardened, re-hardened, and re-re-hardened 2026-04-18 late)**: **Autonomous execution — pre-granted permission for everything below, no exceptions, no re-confirmation per ticket, per file, or per session**.

- Claude works through the Linear sprint plan without stopping for approval between tickets.
- **Permissions are pre-granted, permanently and irrevocably, for the entire list below**. Phill does NOT need to confirm any of these per-ticket, per-file, per-session, or ever. Do NOT ask. Do NOT offer to ask. Do NOT caveat. Do the action:
  1. Read/Glob/Grep any file in the repo — ALWAYS ALLOW
  2. Write/Edit any non-locked file — ALWAYS ALLOW
  3. Create new files under `docs/`, `apps/backend/src/`, `apps/web/app/`, `apps/web/lib/`, `apps/web/components/`, `.claude/`, `scripts/`, or any other non-locked path — ALWAYS ALLOW
  4. Stage, un-stage, draft, amend, and author commit messages — ALWAYS ALLOW
  5. Run shell smoke tests (`py_compile`, AST parse, byte-level verify, `tsc --noEmit`, `pnpm turbo run type-check`, `ruff check`, `uv run pytest`, etc.) — ALWAYS ALLOW
  6. Query MCPs (Linear, Supabase, Chrome, GitHub, Slack, pi-ceo, scheduled-tasks, session-info, plugins, registry) on Claude's own initiative — ALWAYS ALLOW, NO "may I?" prompts
  7. Rotate to the next sprint ticket whenever the current one is blocked/finished — ALWAYS ALLOW
  8. File follow-up tickets as `NEW TICKET` rows in this file when Linear MCP is 401 — ALWAYS ALLOW
  9. Write/update `docs/UNI-XXXX-PR-HANDOFF.md` runbooks — ALWAYS ALLOW
  10. Edit this PROGRESS.md file to reflect status — ALWAYS ALLOW
  11. Install/remove dev-only packages in the sandbox for smoke tests — ALWAYS ALLOW
  12. Start/stop background processes in the sandbox (not on Phill's machine) — ALWAYS ALLOW
  13. **Merge open PRs autonomously via Chrome** (`mcp__Claude_in_Chrome__*`) — ALWAYS ALLOW. Phill no longer uses PowerShell for PR merges. Claude performs the full squash-merge sequence: navigate to PR → click "Squash and merge" → click "Confirm squash and merge" → delete merged branch. No per-PR confirmation required. (Granted 2026-04-18.)
- **All "continuation requirements" are PRE-ACCEPTED FOREVER**. Whenever Claude would otherwise pause to ask "should I continue?", "should I move on?", "is this okay?", "shall I proceed?", "would you like me to", "do you want me to", "can I go ahead?", "is it okay if I" — **THE ANSWER IS ALREADY YES**. Keep going. Don't write the question. Don't ask by a different name. Don't offer alternatives. Execute.
- **The only reasons Claude may halt** are the four listed in "Only halt conditions" below. Any other hesitation is a bug in Claude's behaviour and must be overridden.
- Smoke-tests (type-check, relevant pytest, byte-level file verify) run before opening a PR.
- Claude never force-pushes or pushes to `main` directly except for doc-only commits.
- **Two commit paths exist**:
  - **Path B — GitHub MCP direct** (**STANDING AUTHORITY GRANTED BY PHILL 2026-04-18 — DEFAULT**): Claude uses the `mcp__mcp-Unite-Group__GITHUB_*` toolset to create branches, commit files, and open PRs directly against `CleanExpo/CCW-CRM`. No per-batch re-ask required.
  - **Path C — Chrome autonomous merge** (**STANDING AUTHORITY GRANTED BY PHILL 2026-04-18**): Claude uses `mcp__Claude_in_Chrome__*` to navigate to open PRs and squash-merge them autonomously. Standard sequence: navigate → fire mouse events on "Squash and merge" → fire mouse events on "Confirm squash and merge" → click "Delete branch".
- **Path B/C hard limits (still prohibited)**:
  1. Never force-push or rewrite history on any branch that has an open or merged PR
  2. Never push code commits directly to `main` (doc-only commits are fine; code goes through a PR merged via Path C)
  3. Never modify locked files (`demo_models.py`, `middleware.ts`, `demo_auth.py`)
  4. Never delete branches that may still be active on Phill's machine
- **Every Path B/C action is logged** to `Completed This Session` with the PR URL / commit SHA so Phill has an audit trail.
- **Never-stop rule**: if Claude cannot proceed on a ticket (blocker, missing info, external dep unreachable, MCP 401, etc.), Claude must NOT halt. Instead:
  1. Log the blocker to `.claude/PROGRESS.md` Blockers section with ticket ID + reason
  2. Move immediately to the NEXT ticket in the sprint order
  3. Keep rotating through the list until either (a) the sprint is complete or (b) a locked file would need to be touched
- **Only halt conditions remaining** (nothing else):
  - A locked file (`demo_models.py`, `middleware.ts`, `demo_auth.py`) would need to change → file a ticket, do NOT edit, skip to next
  - All sprint tickets are either complete, blocked, or require locked-file changes
  - A smoke test returns a failure that requires schema/data knowledge only Phill has (rare — document + skip)

## Active Tasks — CCW Demo Sprint

| Task                                              | Status      | Linear   | Est  |
| ------------------------------------------------- | ----------- | -------- | ---- |
| Route User import via models_base                 | DONE        | UNI-1944 | —    |
| POS location/terminal/staff 500s                  | MERGED #106 | UNI-1777 | ~2h  |
| Customer detail blank for org-isolated records    | MERGED #107 | UNI-1785 | ~1h  |
| Dashboard data stalls after rapid navigation     | MERGED #107 | UNI-1786 | ~1h  |
| SSE badge cycling Error↔Live every 25s            | MERGED #107 | UNI-1782 | ~1h  |
| Orders page search/filter                         | MERGED #108 | UNI-1781 | ~1h  |
| Backend 500 storm (demo paths only)               | MERGED #109 | UNI-1778 | ~1h  |
| RLS scoping doc committed on main                 | DONE        | UNI-1749 | ~2h  |
| Render OOM scoping doc committed on main          | DONE        | UNI-1758 | ~1h  |
| Ruff hygiene (tpar.py / bank_feed / eftpos)       | MERGED #114 | —        | ~15m |

**✅ ALL DEMO SPRINT TASKS COMPLETE — 2026-04-18**

## Previously Completed (kept for traceability)

| Task                                   | Status | Linear   |
| -------------------------------------- | ------ | -------- |
| XSS sanitisation on customer fields    | DONE   | UNI-1783 |
| Anthropic API key backend endpoint     | DONE   | UNI-1776 |
| Anthropic API key Settings UI          | DONE   | UNI-1776 |
| Anthropic step in onboarding wizard    | DONE   | UNI-1776 |
| Customer Discard button resets form    | DONE   | UNI-1784 |
| POS mobile tabbed layout               | DONE   | UNI-1787 |
| Dashboard stale setState guard         | DONE   | —        |
| BetterStack log drain (logtail-python) | DONE   | —        |
| E2E auth.setup.ts onboarding redirect  | DONE   | —        |
| SupervisorAgent Ollama → Anthropic     | DONE   | UNI-1792 |
| score column migration (006)           | DONE   | —        |
| Async DB pool 5→20 / 10→40             | DONE   | —        |
| Webhook stubs → structlog + httpx      | DONE   | —        |
| Ruff I001 import sort supervisor_agent | DONE   | —        |

## Completed This Session (2026-04-18)

- [x] fix(backend): route User import via models_base — UNI-1944 (PR #105, squash-merged)
- [x] fix(backend,web): orders search/filter end-to-end — UNI-1781 (PR #108, squash-merged via Chrome, branch deleted)
- [x] fix(web): customer detail page no longer blanks on org-isolated fetches — UNI-1785 (PR #107)
- [x] fix(web): dashboard stale-metric race on rapid nav — UNI-1786 (PR #107)
- [x] fix(web): SSE badge no longer cycles Error↔Live — UNI-1782 (PR #107, squash-merged via Chrome, branch deleted)
- [x] fix(backend,web): restore POS location/terminal/staff endpoints — UNI-1777 (PR #106, squash-merged via Chrome, branch deleted)
- [x] fix(backend): structlog + correlation ID on 500s, resilient dashboard aggregation — UNI-1778 (PR #109, squash-merged via Chrome, branch deleted)
- [x] fix(backend): ruff hygiene — tpar, bank_feed_service, eftpos_terminal (PR #114, squash-merged via Chrome, branch deleted)
- [x] **AUTHORITY GRANTED**: Autonomous Chrome PR merge — Phill no longer using PowerShell. Claude merges all PRs via Chrome squash-merge. Encoded in CLAUDE.md item 12 and standing order item 13.
- [x] Doc commit `d5a7f40`: CLAUDE.md + PROGRESS.md + workflow.md updated (drop PS refs, encode Chrome merge authority)

### Path B/C actions this session

| Ticket(s)                       | PR / Action                                           | Branch / Ref                           | Status      |
| ------------------------------- | ----------------------------------------------------- | -------------------------------------- | ----------- |
| UNI-1749 (RLS scoping doc)      | direct to `main`                                      | `main` @ `fb1b133`                     | DONE        |
| UNI-1758 (OOM scoping doc)      | direct to `main`                                      | `main` @ `5fffa3a`                     | DONE        |
| UNI-1777                        | https://github.com/CleanExpo/CCW-CRM/pull/106         | `fix/uni-1777-pos-endpoints`           | MERGED ✓    |
| UNI-1785 / UNI-1786 / UNI-1782  | https://github.com/CleanExpo/CCW-CRM/pull/107         | `fix/uni-1785-1786-1782-resilience`    | MERGED ✓    |
| UNI-1781                        | https://github.com/CleanExpo/CCW-CRM/pull/108         | `fix/uni-1781-orders-search-filter`    | MERGED ✓    |
| UNI-1778                        | https://github.com/CleanExpo/CCW-CRM/pull/109         | `fix/uni-1778-backend-500-storm`       | MERGED ✓    |
| Ruff hygiene                    | https://github.com/CleanExpo/CCW-CRM/pull/114         | `fix/ruff-hygiene-tpar-bank-eftpos`    | MERGED ✓    |
| Doc: Chrome merge authority     | direct to `main` @ `d5a7f40`                          | `main`                                 | DONE        |

## Decisions Log

| Decision                                            | Rationale                                                           | Date       |
| --------------------------------------------------- | ------------------------------------------------------------------- | ---------- |
| Route `User` via `models_base`, keep schema-locked  | `demo_models.py` is locked; `User` lives in `models_base.py:58`     | 2026-04-18 |
| Merge PR #105 despite pre-existing red ruff         | Failures predate UNI-1944; blocking would mask fix; filed new ticket | 2026-04-18 |
| Fresh short-lived fix branches off origin/main      | Sandbox is append-only on `.git`; branches created via Path B       | 2026-04-18 |
| Autonomous Chrome merge replaces PowerShell         | Phill no longer uses PowerShell; Claude merges via Chrome Path C    | 2026-04-18 |
| Chrome merge uses full MouseEvent dispatch sequence | Simple `.click()` doesn't trigger GitHub's React handlers; full pointer/mouse event chain does | 2026-04-18 |
| html.escape() not htmlspecialchars                  | stdlib, no deps, escapes all 5 HTML special chars                   | 2026-04-13 |
| Anthropic key stored in IntegrationCredential table | Consistent with SendGrid pattern                                    | 2026-04-13 |
| POS mobile = Tabs not scroll                        | Tabs give instant access without scroll; desktop grid unchanged     | 2026-04-13 |

## Blockers (User Action Required)

1. **File ruff follow-up ticket in Linear** — paste ticket body from 2026-04-18 session (Linear MCP returns 401; must be manual).
2. **Anthropic API key** — CCW staff must enter their sk-ant- key via Settings → Integrations or onboarding wizard before AI features activate.
3. **Flip `WEB_CONCURRENCY=1` in Render** — No code change; set in Render → Environment for the backend service to prevent OOM. See `docs/UNI-1758-OOM-SCOPING.md`.
4. **UNI-1749 RLS scope decision** — Recommendation: defer to post-demo. See `docs/UNI-1749-RLS-SCOPING.md`.
5. **Prod smoke test** — Run `chrome-prod` skill against `ccw-crm-web.vercel.app` after Vercel deploys the merged PRs.

## Notes for Next Context Window

- **Demo date**: 2026-04-20. Sprint is COMPLETE. All 5 code PRs merged to `main`.
- **Post-merge Phill actions**: (a) flip `WEB_CONCURRENCY=1` in Render env, (b) confirm Vercel deployed, (c) prod smoke via `chrome-prod` skill.
- **Post-demo backlog**: UNI-1758 Option D (lazy-load AI routes + bounded pattern cache) → full RLS tightening under UNI-1749 → backend ruff hygiene follow-up.
- **Chrome merge technique**: Use full `MouseEvent` dispatch sequence (pointerover, mouseover, pointermove, mousemove, pointerdown, mousedown, pointerup, mouseup, click) on the button element — simple `.click()` does NOT trigger GitHub's React handlers. Wait 1200ms between Squash click and Confirm click. Wait for `Checking for the ability to merge` to clear before clicking.
- **Locked files (do not touch)**: `apps/backend/src/db/demo_models.py`, `apps/web/middleware.ts`, `apps/backend/src/api/routes/demo_auth.py`
- **`User` class lives at**: `apps/backend/src/db/models_base.py:58`
- Supabase project: `vwfgksqkajnpfjospbpe`
- Linear team: Unite-Group, project: CCW-ERP/CRM
