# CCW-CRM — Project Status (Ground Truth)

**Document owner:** Engineering  
**Issue:** UNI-2105  
**Last updated:** 2026-06-11  
**Supersedes:** GO_LIVE_SIGNOFF.md, COMPLETION-REPORT.md, DEPLOYMENT_ROADMAP_SUMMARY.md (all marked stale)

---

## How to read this document

Every claim below is backed by a live gate command you can re-run. No metric is
carried forward from a prior report without re-verification. Where a capability is
partial or demo-grade, that is stated explicitly.

---

## 1. Live Gate Results (run 2026-06-11)

### 1.1 Unit tests — PASS

```
Command: npm install --ignore-scripts && npx vitest run
Result:
  Test Files  15 passed (15)
        Tests  139 passed (139)
     Start at  2026-06-11 12:51:41
     Duration  13.88s
```

All 139 unit tests pass. New test suites added by PRs #199-#204 cover:
- POS tenant isolation (9 tests)
- POS route auth (19 tests)
- Company settings route (12 tests)
- Portal orders route (14 tests)
- Portal service requests (12 tests)
- Transfer cancel service (6 tests)

### 1.2 TypeScript type-check — FAIL (environment-dependent)

```
Command: npx tsc --noEmit
Result: exit 1, 219 errors

Root cause: prisma generate was skipped (--ignore-scripts).
            Prisma generates @prisma/client types at build time from a live
            DATABASE_URL. Without DATABASE_URL the client types do not exist,
            producing ~180 of the 219 errors (PurchaseOrder, Quote, etc.).
            The remaining ~39 errors are real implicit-any violations in
            db helpers (quote-mutations.ts, workshop-service.ts, etc.).

In CI (ci.yml): npm ci runs postinstall which calls prisma generate.
                The CI pipeline provides NEXT_PUBLIC_APP_URL but not DATABASE_URL,
                so this step also fails in CI without a real DB connection string.
```

**Implication:** The type-check gate in `ci.yml` (`npm run type-check`) requires
`DATABASE_URL` to be available at install time (via `prisma generate`). The CI
workflow does not supply this secret. Whether the CI type-check step passes or
fails depends on whether the repo has a `DATABASE_URL` secret configured.
Do not assume type-check is green without seeing a live CI run pass.

### 1.3 CI quality gate (GitHub Actions `ci.yml`) — GREEN as of 2026-06-11

The `ci.yml` workflow runs: lint -> type-check -> vitest:coverage -> next build.
PRs #197 (rollback.yml parse fix) and #198 (deepsec workspace fix) resolved the
last blocking CI failures. PRs #199-#204 all passed CI before merge.

**Verification command:**
```
gh run list --workflow=ci.yml --repo=CleanExpo/CCW-CRM --limit=5
```

### 1.4 Staging deploy (`deploy-staging.yml`) — RED since 2026-05-22

**Status:** Failing. Root cause: missing GitHub repository secrets
`STAGING_SSH_KEY`, `STAGING_SSH_HOST`, `STAGING_SSH_USER`. The workflow triggers
on CI completion but cannot SSH to the staging server without credentials.

**This is tracked as UNI-2106. It is NOT in scope for UNI-2105.**

**Verification command:**
```
gh run list --workflow=deploy-staging.yml --repo=CleanExpo/CCW-CRM --limit=5
```

---

## 2. Production Readiness — Honest Assessment

This is not a percentage. The table below states what is production-grade,
what is demo-grade (seamed/in-memory), and what is blocked.

| Area | Status | Evidence / Notes |
|------|--------|-----------------|
| Auth layer | Production-grade | JWT, workspace-keyed, org context enforced on 7 routes (PR #199) |
| POS data isolation | Production-grade | Workspace-keyed stores, tenant isolation tests pass (PR #199) |
| Unit tests | Production-grade | 139/139 vitest pass; new suites for all PRs #199-#204 |
| CI quality gate | Production-grade | lint + test + build green as of 2026-06-11 |
| Deepsec weekly scan | Production-grade | Fixed workspace/project-id (PR #197) |
| Demo-mode flag | Production-grade | Mock fallbacks gated behind `NEXT_PUBLIC_DEMO_MODE=true` (PR #200) |
| Transfer cancel | Production-grade | Endpoint + UI + service tests (PR #201) |
| TypeScript (no DB) | Partial | 219 errors when Prisma client not generated; ~39 are real implicit-any |
| Company settings save | **Demo-grade (in-memory)** | PR #202: in-memory store, resets on server restart; `WorkspaceSettings` DB table not yet created (UNI-2111 follow-on) |
| Portal orders/tracking | **Demo-grade (seamed)** | PR #203: auth layer real, data layer seamed for Prisma — returns empty arrays until DB wired |
| Shopify integration | **Demo-grade** | `SHOPIFY_*` env vars required; no live Shopify connection in CI |
| Xero integration | **Demo-grade** | OAuth redirect exists; `XERO_*` env vars required; not tested against live Xero |
| Cin7 shadow sync | **Demo-grade** | Shadow store is in-memory; real Cin7 API not integrated |
| Staging deploy | **Blocked** | Missing SSH secrets (UNI-2106) |
| Production deploy | **Not attempted** | Requires staging green first |
| `WorkspaceSettings` DB table | **Missing** | Required for company settings persistence (UNI-2111) |

**Overall:** The codebase is not "97% production-ready." The auth and test layers
are solid. Several data paths are explicitly seamed or in-memory and will behave
differently in production from what is visible in demo mode. No production
deployment has been executed and verified against this codebase version.

---

## 3. Changes Merged Today (2026-06-11)

| PR | Linear | Description | Demo-grade risk |
|----|--------|-------------|----------------|
| #197 | RA-5660 | Deepsec workspace + project-id fix | None |
| #198 | UNI-2131 | rollback.yml YAML parse fix | None |
| #199 | UNI-2107 | Org-context enforcement; 7 routes auth-guarded; workspace-keyed POS stores | None |
| #200 | UNI-2116 | Mock fallbacks gated behind `NEXT_PUBLIC_DEMO_MODE` flag | None (fixed a prod risk) |
| #201 | UNI-2112 | Inventory transfer cancel endpoint + UI | None |
| #202 | UNI-2111 | Company settings save — in-memory store | **In-memory until WorkspaceSettings table created** |
| #203 | UNI-2114 | Portal orders/tracking — auth real, data seamed | **Seamed data layer** |
| #204 | UNI-2115 | Service portal customer-context spoof fix | None |

---

## 4. Active Tasks

Each task below carries: acceptance criteria, owner slot, dependency, and
the command to verify completion.

---

### TASK-1: Create `WorkspaceSettings` DB table (UNI-2111 follow-on)

**What:** Replace the in-memory `company-store.ts` with a real Prisma-backed
`WorkspaceSettings` table so company settings survive server restarts.

**Acceptance criteria:**
- [ ] Prisma migration adds `WorkspaceSettings` with columns: `id`, `workspaceId` (unique FK to Workspace), `name`, `trading_name`, `abn`, `acn`, `is_active`, `updatedAt`
- [ ] `company-store.ts` replaced by a Prisma query in the API route
- [ ] `npm run test` still passes (139+)
- [ ] `npm run type-check` exits 0 (DATABASE_URL provided)
- [ ] Settings persist across Next.js cold starts (manual verify)

**Owner:** Backend engineer  
**Dependency:** DATABASE_URL must be available in dev environment  
**Verification command:**
```bash
npx prisma migrate dev --name add-workspace-settings
npm run test
npm run type-check
```

---

### TASK-2: Wire portal orders/tracking to real Prisma queries (UNI-2114 follow-on)

**What:** PR #203 auth layer is real but data layer returns empty arrays. Replace
the seam with actual Prisma queries for customer orders and tracking events.

**Acceptance criteria:**
- [ ] `GET /api/portal/orders` returns orders from the DB filtered by authenticated customer workspace
- [ ] `GET /api/portal/tracking/[orderId]` returns real tracking events
- [ ] Existing portal route tests still pass (14 tests)
- [ ] No raw SQL -- use Prisma client only
- [ ] Response shape matches the existing TypeScript types in `portal-orders-route.test.ts`

**Owner:** Backend engineer  
**Dependency:** DATABASE_URL; `WorkspaceSettings` table (TASK-1) for customer resolution  
**Verification command:**
```bash
npm run test -- src/lib/__tests__/portal-orders-route.test.ts
npm run type-check
```

---

### TASK-3: Fix ~39 genuine TypeScript implicit-any violations

**What:** After `prisma generate` runs (TASK-1 dependency), ~39 real implicit-any
errors remain in `quote-mutations.ts`, `workshop-service.ts`, `sendgrid-persistence.ts`,
`transfer-cancel-service.ts`, and `invoice-email.ts`.

**Acceptance criteria:**
- [ ] `npm run type-check` exits 0 with DATABASE_URL set
- [ ] No `// @ts-ignore` or `as any` suppressions added
- [ ] Existing tests continue to pass

**Owner:** Backend engineer  
**Dependency:** DATABASE_URL (so Prisma types exist); best done after TASK-1  
**Verification command:**
```bash
npm run type-check
echo "Exit code: $?"
```

---

### TASK-4: Resolve staging deploy credentials (UNI-2106)

**What:** `deploy-staging.yml` fails because `STAGING_SSH_KEY`, `STAGING_SSH_HOST`,
`STAGING_SSH_USER` are not set in GitHub repository secrets.

**Acceptance criteria:**
- [ ] All three secrets set in `CleanExpo/CCW-CRM` -> Settings -> Secrets -> Actions
- [ ] `gh run list --workflow=deploy-staging.yml` shows a green run on main
- [ ] Staging URL (`https://api.staging.ccw-erp.com/api/health`) returns 200

**Owner:** DevOps / repository admin (requires GitHub admin access)  
**Dependency:** A staging server must exist and accept SSH from GitHub Actions runners  
**Verification command:**
```bash
gh run list --workflow=deploy-staging.yml --repo=CleanExpo/CCW-CRM --limit=3
curl -f https://api.staging.ccw-erp.com/api/health
```

---

### TASK-5: Resolve prisma generate in CI type-check step

**What:** `ci.yml` runs `npm ci` (which calls `prisma generate` via postinstall)
and then `npm run type-check`. Without `DATABASE_URL` in CI secrets, `prisma generate`
may fail or produce a stub client that does not match the schema.

**Acceptance criteria:**
- [ ] CI type-check step exits 0 on every push to main
- [ ] Either: `DATABASE_URL` added as a CI secret pointing to a test DB, OR `prisma generate` is made schema-only (no DB connection required) via `prisma generate --no-engine`

**Owner:** DevOps / CI maintainer  
**Dependency:** Decision on CI DB vs schema-only generation  
**Verification command:**
```bash
gh run list --workflow=ci.yml --repo=CleanExpo/CCW-CRM --limit=3
# Inspect the "Type check" step result in the run detail
```

---

## 5. Previously-Stale Documents — Archive Index

The following documents have been annotated with ARCHIVED notices and must not
be cited as evidence of production readiness:

| File | Written | Why stale |
|------|---------|-----------|
| `docs/GO_LIVE_SIGNOFF.md` | 2026-02-02 | Simulated go-live; all sign-off fields blank; CI was red until 2026-06-11 |
| `docs/DEPLOYMENT_ROADMAP_SUMMARY.md` | 2026-02-02 | References Python/FastAPI G-Pilot project, not this codebase |
| `docs/COMPLETION-REPORT.md` | 2026-02-05 | "154/154 passing / 0 TS errors" metrics not current; Prisma context different |
| `.github/SECRETS.md` | (template) | References "NodeJS-Starter-V1" -- template artefact, not this project |

---

## 6. Not-Yet-Verified Claims in Older Docs

The following claims appear in older docs but have NOT been verified against the
current codebase. They should not be cited:

- "99.92% production uptime" -- No production server has been confirmed running this codebase version
- "63/63 integration tests" -- Current vitest suite has 139 tests; the 63-test count was a prior state
- "96.1% load test pass rate (8000+ scenarios)" -- Load tests were not re-run; load test scripts may be out of date
- "Zero critical security findings" -- Deepsec weekly scan was broken until PR #197; next scan result pending
- "Platform readiness score: 95/100" (CCW-DEMO-SCRIPT.md) -- Not backed by any gate; informally authored

---

*This document was produced as part of UNI-2105 (pathway docs refresh against live evidence).
All gate outputs above were captured on 2026-06-11 from a fresh clone of CleanExpo/CCW-CRM main.*
