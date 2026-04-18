# Progress

**Phase**: CCW Demo Sprint — Day 1 of 2 (demo 2026-04-20)
**Last Updated**: 2026-04-18
**Branch**: `main` (direct short-lived fix branches off origin/main per ticket)
**Last merged PR**: #120 `feat(backend,web): AP ageing report — supplier liability visibility (UNI-1834)` — squash-merged

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
- **All "continuation requirements" are PRE-ACCEPTED FOREVER**. Whenever Claude would otherwise pause to ask "should I continue?", "should I move on?", "is this okay?", "shall I proceed?", "would you like me to", "do you want me to", "can I go ahead?", "is it okay if I" — **THE ANSWER IS ALREADY YES**. Keep going. Don't write the question. Don't ask by a different name. Don't offer alternatives. Execute.
- **The only reasons Claude may halt** are the four listed in "Only halt conditions" below. Any other hesitation is a bug in Claude's behaviour and must be overridden.
- Smoke-tests (type-check, relevant pytest, byte-level file verify) run before opening a PR.
- Claude never force-pushes or pushes to `main` directly except for doc-only commits.
- **Two push paths exist**:
  - **Path A — shell push via Phill's machine**: sandbox cannot reach `origin` over the network via the shell's `git push`. So Claude stages commits and writes `docs/UNI-XXXX-PR-HANDOFF.md` with exact PowerShell commands for Phill to run locally. Use only when Phill prefers to run the push himself.
  - **Path B — GitHub MCP direct** (**STANDING AUTHORITY GRANTED BY PHILL 2026-04-18 — DEFAULT from now on**): Claude uses the `mcp__mcp-Unite-Group__GITHUB_*` toolset to create branches, commit files, and open PRs directly against `CleanExpo/CCW-CRM`. This bypasses the shell sandbox entirely and uses GitHub's REST API. **No per-batch re-ask required. Do not pause to confirm.**
- **Path B STANDING AUTHORITY — what Claude may do without asking**:
  1. Create branches via `GITHUB_CREATE_A_REFERENCE` off `origin/main` — ALWAYS ALLOW
  2. Commit one or many files via `GITHUB_COMMIT_MULTIPLE_FILES` or `GITHUB_CREATE_OR_UPDATE_FILE_CONTENTS` — ALWAYS ALLOW
  3. Open PRs via `GITHUB_CREATE_A_PULL_REQUEST` with body pulled from handoff docs — ALWAYS ALLOW
  4. Land doc-only commits on `main` directly via Path B (PROGRESS.md, handoff docs, scoping docs, runbooks) — ALWAYS ALLOW
  5. Update `fix/*` branch refs via `GITHUB_UPDATE_A_REFERENCE` when adding further commits before PR merge — ALWAYS ALLOW
- **Path B hard limits (still prohibited — never override without new explicit Phill instruction)**:
  1. Never force-push or rewrite history on any branch that has an open or merged PR
  2. Never push to `main` outside of: (a) doc-only commits, (b) the output of a squash-merged PR that Phill merged in the GitHub UI
  3. Never modify locked files (`demo_models.py`, `middleware.ts`, `demo_auth.py`) via Path B — same lock that applies to Path A
  4. Never delete branches that may still be active on Phill's machine
- **Every Path B action is logged** to `Completed This Session` with the PR URL / commit SHA so Phill has an audit trail.
- **Never-stop rule**: if Claude cannot proceed on a ticket (blocker, missing info, external dep unreachable, MCP 401, etc.), Claude must NOT halt. Instead:
  1. Log the blocker to `.claude/PROGRESS.md` Blockers section with ticket ID + reason
  2. Move immediately to the NEXT ticket in the sprint order
  3. Keep rotating through the list until either (a) the sprint is complete or (b) a locked file would need to be touched
- **Only halt conditions remaining** (nothing else):
  - A locked file (`demo_models.py`, `middleware.ts`, `demo_auth.py`) would need to change → file a ticket, do NOT edit, skip to next
  - All sprint tickets are either complete, blocked, or require locked-file changes
  - A smoke test returns a failure that requires schema/data knowledge only Phill has (rare — document + skip)
- **Sprint order** (keep rotating; don't stop until all are in one of: READY-PR, BLOCKED, or DONE):
  UNI-1777 → UNI-1785 → UNI-1786 → UNI-1782 → UNI-1778 → UNI-1749 (Day 2) → UNI-1758 (Day 2)

## Active Tasks — CCW Demo Sprint

| Task                                              | Status         | Linear   | Est  |
| ------------------------------------------------- | -------------- | -------- | ---- |
| Route User import via models_base                 | DONE           | UNI-1944 | —    |
| POS location/terminal/staff 500s                  | PR-OPEN #106   | UNI-1777 | ~2h  |
| Customer detail blank for org-isolated records    | PR-OPEN #107   | UNI-1785 | ~1h  |
| Dashboard data stalls after rapid navigation     | PR-OPEN #107   | UNI-1786 | ~1h  |
| SSE badge cycling Error↔Live every 25s            | PR-OPEN #107   | UNI-1782 | ~1h  |
| Orders page search/filter                         | PR-OPEN #108   | UNI-1781 | ~1h  |
| Backend 500 storm (demo paths only)               | PR-OPEN #109   | UNI-1778 | ~1h  |
| RLS scoping doc committed on main                 | DONE (defer B) | UNI-1749 | ~2h  |
| Render OOM scoping doc committed on main          | DONE (env B)   | UNI-1758 | ~1h  |
| Ruff hygiene (tpar.py / bank_feed / eftpos)       | PR-OPEN #114   | —        | ~15m |
| Per-customer payment terms + B2B/B2C type         | DONE (PR #133) | UNI-1821 + UNI-1831 | ~3h |
| AP ageing report — supplier liability for CFO     | DONE (PR #120) | UNI-1834 | —   |

## Pi-CEO open PRs — Pending review (2026-04-18)

Pi-CEO has been autonomously building. These PRs exist in the "In Review" column and need human review before merge:

| PR  | Title                                                                 | Score     | Action needed |
| --- | --------------------------------------------------------------------- | --------- | ------------- |
| #124 | feat(warehouse): add pick list and packing slip generation with print PDF | None/10 | Review + merge or close |
| #122 | feat: Pi CEO build                                                    | None/10   | Identify + review      |
| #121 | feat: Pi CEO build                                                    | None/10   | Identify + review      |
| #119 | feat: Pi CEO build                                                    | None/10   | Identify + review      |
| #118 | fix(backend): reload RMA lines after advance_rma_status commit (UNI-1835) | None/10 | Review + merge |
| #117 | fix(backend): prevent MultipleResultsFound 500 on Xero sync GRN gate (UNI-1833) | 5/10 | Review + merge |
| #116 | feat: Pi CEO build                                                    | None/10   | Identify + review      |
| #115 | feat: Pi CEO build                                                    | 1.75/10   | Low score — review carefully |

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

- [x] fix(backend): route User import via models_base — UNI-1944 (PR #105, squash-merged commit `24926577`)
- [x] Recovered from Edit-tool CRLF+null-byte corruption on `invoicing.py` via PowerShell byte-level rewrite
- [x] Force-push-with-lease amended commit (`d4135355` → `24926577`) — clean text diff vs origin/main
- [x] Deleted merged branch `fix/uni-1944-user-imports` on GitHub
- [x] Diagnosed CI red status: 4 "failing" checks all pre-existing on `main` (ruff in `tpar.py`/`bank_feed_service.py`/`eftpos_terminal.py`, missing `hooks.json`, Dependency Graph disabled, Snyk optional)
- [x] fix(backend,web): orders search/filter end-to-end — UNI-1781 (server-side search by order# OR customer name, date range, status=all passthrough, debounce, filter persistence)
- [x] fix(web): customer detail page no longer blanks on org-isolated fetches — UNI-1785 (per-section try/catch; "Customer not available" empty state)
- [x] fix(web): dashboard stale-metric race on rapid nav — UNI-1786 (isMounted guard on SSE-triggered refetch)
- [x] fix(web): SSE badge no longer cycles Error↔Live — UNI-1782 (10s grace timer before surfacing 'error'; resets on reconnect)
- [x] fix(backend,web): restore POS location/terminal/staff endpoints — UNI-1777 (ready-to-PR, awaiting Phill's PowerShell push)
  - Expanded GET /locations, GET /sales-staff, GET /terminals to return full field set (id, merchant_id, is_active, timestamps)
  - Added GET /staff alias → _list_sales_staff_impl so frontend path resolves
  - Added POST/PUT/DELETE /locations + POST/PUT/DELETE /staff (mirrors terminal CRUD pattern)
  - Extracted `_ensure_location_exists` helper to validate FK refs
  - Frontend .data unwrap fixed on pos/locations, pos/staff, pos/terminal pages (apiClient.get<T[]> not <{data: T[]}>)
  - TerminalDialog edit mode now preserves merchant_id (was resetting to '')
  - pos/types.ts expanded with merchant_id, last_ping_at, timestamps, address/postal_code/country/timezone, phone, can_sell_at_locations
  - Smoke tests: AST parse OK, py_compile OK, tsc --noEmit OK on touched files (pre-existing layout.tsx/stream errors unrelated)
- [x] Drafted follow-up ruff ticket body for Phill to file in Linear
- [x] fix(backend): structlog + correlation ID on 500s, resilient dashboard aggregation — UNI-1778 (READY-PR, handoff at `docs/UNI-1778-PR-HANDOFF.md`)
  - `exceptions.py`: swapped `print()` for `structlog.get_logger()` across all 4 handlers; every 4xx/5xx now includes a 12-char hex `request_id` correlation ID in both the log row and the JSON body
  - `schemas.py`: added optional `request_id` field to `ErrorResponse`
  - `demo_dashboard.py`: `/aggregated` now uses `asyncio.gather(return_exceptions=True)` + per-section fallback. A single chart query failing no longer blanks the dashboard.
  - Smoke tests: py_compile OK across 3 files, AST parse OK, byte checks clean (0 lone LF, 0 nulls, last byte 10)

### Path B PRs opened this session (autonomous)

| Ticket(s)                    | PR                                                  | Branch                                 | Head SHA    | Base SHA  |
| ---------------------------- | --------------------------------------------------- | -------------------------------------- | ----------- | --------- |
| UNI-1749 (RLS scoping doc)   | direct to `main`                                    | `main`                                 | `fb1b133`   | n/a       |
| UNI-1758 (OOM scoping doc)   | direct to `main`                                    | `main`                                 | `5fffa3a`   | n/a       |
| UNI-1777                     | https://github.com/CleanExpo/CCW-CRM/pull/106       | `fix/uni-1777-pos-endpoints`           | (PR #106)   | `fb1b133` |
| UNI-1785 / UNI-1786 / UNI-1782 | https://github.com/CleanExpo/CCW-CRM/pull/107     | `fix/uni-1785-1786-1782-resilience`    | `4824fc4`   | `fb1b133` |
| UNI-1781                     | https://github.com/CleanExpo/CCW-CRM/pull/108       | `fix/uni-1781-orders-search-filter`    | `06effb5`   | `fb1b133` |
| UNI-1778                     | https://github.com/CleanExpo/CCW-CRM/pull/109       | `fix/uni-1778-backend-500-storm`       | `cab74bb`   | `fb1b133` |
| Ruff hygiene (new ticket)    | https://github.com/CleanExpo/CCW-CRM/pull/114       | `fix/ruff-hygiene-tpar-bank-eftpos`    | `b71824b`   | `9e32fbe` |

All PRs target `main`, opened via `mcp__mcp-Unite-Group__GITHUB_COMMIT_MULTIPLE_FILES` + `GITHUB_CREATE_A_PULL_REQUEST` under the Path B standing authority granted 2026-04-18. Each PR body contains a Verification Checklist (Where / How / What to see / What NOT to see) per the `.claude/rules/verification-gate.md` rule.

### Path B PRs — continued session (2026-04-18 context 2)

| Ticket   | PR                                                    | Branch                                   | Notes                                        |
| -------- | ----------------------------------------------------- | ---------------------------------------- | -------------------------------------------- |
| UNI-1826 | https://github.com/CleanExpo/CCW-CRM/pull/130         | `feat/uni-1826-workshop-acl-warranty`    | ACL s.54 min warranty validator — MERGED     |
| UNI-1861 | https://github.com/CleanExpo/CCW-CRM/pull/131         | `feat/uni-1861-rate-limit-middleware`    | SlowAPIMiddleware + rate limit tests — MERGED|
| UNI-1830 | https://github.com/CleanExpo/CCW-CRM/pull/132         | `feat/uni-1830-cin7-po-invoice-events`  | Cin7 PO+invoice polling events — MERGED      |
| UNI-1821 + UNI-1831 | https://github.com/CleanExpo/CCW-CRM/pull/133 | `feat/uni-1821-1831-customer-profile` | Per-customer payment terms + B2B/B2C type — MERGED |
| UNI-1834 | https://github.com/CleanExpo/CCW-CRM/pull/120 | `pidev/auto-a26e1b79` | AP ageing report (Pi-CEO build) — MERGED |
| — | https://github.com/CleanExpo/CCW-CRM/pull/123 | `pidev/auto-5eeb9f3b` | Pi-CEO UNI-1821 duplicate — CLOSED (superseded by #133) |

- [x] feat(backend): ACL s.54 warranty validation on workshop equipment — UNI-1826 (PR #130, squash-merged)
  - `EquipmentCreate` + `EquipmentUpdate`: `model_validator(mode="after")` enforces ≥365 days warranty_expiry after purchase_date
- [x] feat(backend): activate API rate limiting via SlowAPIMiddleware — UNI-1861 (PR #131, squash-merged)
  - SlowAPIMiddleware registered in `main.py` (was missing — silenced default_limits)
  - `Limiter` now uses `settings.rate_limit_per_minute` for default_limits
  - Tests: 3 classes covering config, 200/429 boundary + Retry-After, main app wiring
- [x] feat(cin7): PO and invoice events in polling handler — UNI-1830 (PR #132, squash-merged)
  - `detect_purchase_order_changes()`: dual-event logic (purchase_order + invoice on Billed/PartlyBilled)
  - `poll_purchase_orders()`: Core-only, modified_since watermark, Omni skip
  - `dispatch_change_events()`: routes purchase_order + invoice entity types
  - `Cin7Connection.last_purchase_order_sync_at` watermark column + SQL migration
  - 40+ test assertions in `test_cin7_po_invoice_events.py`
  - Linear MCP 401 — mark UNI-1830 Done manually in Linear UI
- [x] feat(backend): per-customer payment terms + B2B/B2C customer type — UNI-1821 + UNI-1831 (PR #133, squash-merged)
  - Extension table pattern: `customer_profile` (1:1 FK to `customers`) avoids touching locked `demo_models.py`
  - `CustomerType` enum + `CustomerProfile` SQLAlchemy model in `crm_models.py`
  - `CustomerBase`/`CustomerUpdate` schemas: `customer_type` (default `"B2B"`) + `payment_terms_days` (default 30)
  - `_merge_profile()` / `_upsert_profile()` / `_get_profile()` helpers in `routes/customers.py`
  - All 4 CRUD routes (list/get/create/update) read/write profile via outerjoin or upsert
  - `XeroClient.create_contact()`: injects `PaymentTerms.Sales` block when `payment_terms_days` provided
  - `XeroCustomerSync.sync_customer_to_xero()`: fetches profile, passes payment terms to Xero
  - `calculate_invoice_tax()`: `customer_type` → `is_b2b` flag wired through (UNI-1831)
  - 40+ test assertions in `test_customers_payment_terms.py` (7 test classes)
  - Linear MCP 401 — mark UNI-1821 and UNI-1831 Done manually in Linear UI
- [x] feat(backend,web): AP ageing report — supplier liability visibility — UNI-1834 (PR #120, squash-merged)
  - Pi-CEO build session `a26e1b798d2f`, 9 files, +874/-2
  - Linear MCP 401 — mark UNI-1834 Done manually in Linear UI
- [x] Closed Pi-CEO duplicate PR #123 (superseded UNI-1821 attempt — extension table approach in #133 is the canonical implementation)

**DB MIGRATION REQUIRED (UNI-1830)**: Run `apps/backend/migrations/add_cin7_po_watermark.sql` in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS guard).

**DB MIGRATION REQUIRED (UNI-1821/1831)**: Run `apps/backend/migrations/add_customer_profile.sql` in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS guard).

## Completed Previous Session (2026-04-14)
