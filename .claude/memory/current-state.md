# Current State — 2026-03-30T09:30:00

## Active Sprint: MVP Go-Live + Security Remediation

---

## RECENTLY COMPLETED (2026-03-29 → 2026-03-30)

### AI Tooling
- [x] UNI-1689: Superpowers installed — 14 skills at `.claude/skills/superpowers/`
- [x] UNI-1690: gstack installed — 29 commands, Bun 1.3.11, Playwright Chromium 145

### RLS Security Phase 1-3 (UNI-1697 partial)
- [x] Phase 1 — Auth bridge: `auth_id` + `organization_id` columns added to `public.users`, backfilled by email match
- [x] Phase 2 — Org backfill: `organization_id` populated on all rows in linked tables
- [x] Phase 3 — Org-scoped policies applied to 13 core tables

### Production Fixes
- [x] UNI-1706: Fixed localhost fallback in workflow/analytics API routes (4 files)
- [x] UNI-1707: Disabled stale Xero cron jobs (stopped 96+ failed invocations/day)
- [x] UNI-1710: Guarded all 4 monitoring routes against missing Prometheus URL (503 instead of timeout)

### CMO + CFO Board Member Agents
- [x] `.claude/agents/cmo-board-member.md` — `/cmo` gstack, brainstorming + writing-skills
- [x] `.claude/agents/cfo-board-member.md` — `/cfo` gstack, executing-plans + finishing-a-development-branch

### Report Pipeline Skills (7 new Superpowers skills)
- [x] `report-module-cataloger/SKILL.md`
- [x] `report-integration-auditor/SKILL.md`
- [x] `report-training-writer/SKILL.md`
- [x] `report-security-reviewer/SKILL.md`
- [x] `report-screenshot-capturer/SKILL.md`
- [x] `report-appendix-generator/SKILL.md`
- [x] `report-composer/SKILL.md` (orchestrator)
- [x] `docs/CCW-Product-Report.md` — 12-section client report (1,193 lines)
- [x] `docs/CCW-Product-Report.pdf` — 644KB PDF

---

## IN PROGRESS

### UNI-1697 — RLS Remediation (Boardroom Security Audit)
Status: Phases 1-3 done. Phases 4+ blocked on sub-tasks below.
Parent issue: https://linear.app/unite-group/issue/UNI-1697

---

## BOARDROOM-GENERATED BACKLOG (2026-03-29 → 2026-03-30)

### 🔴 P0 CRITICAL

- [ ] **UNI-1688**: Privacy Architecture — AU Privacy Act consent + AI transparency framework
  - July 2026 deadline (small business exemption removed)
  - Required: consent banner, data processing agreements, AI transparency notices
  - https://linear.app/unite-group/issue/UNI-1688

### 🔴 P1 URGENT — Security

- [ ] **UNI-1699**: P1-A Audit app auth flow — service_role key vs user JWT determination
  - `public.users` has `hashed_password` + UUID not matching `auth.users.id`
  - Must determine if app uses service_role (bypasses RLS) or user JWT
  - https://linear.app/unite-group/issue/UNI-1699

- [ ] **UNI-1700**: P1-B Remove hashed_password from public.users — migrate to Supabase native auth
  - Critical: any auth'd user can SELECT hashed_password (RLS policy is always-true)
  - Blocked by: UNI-1699
  - https://linear.app/unite-group/issue/UNI-1700

- [ ] **UNI-1701**: P1-C Add organization_id to public.users + Supabase JWT custom claim hook
  - Inject `org_id` into every JWT so RLS policies can use it without expensive subqueries
  - https://linear.app/unite-group/issue/UNI-1701

### 🔴 P1 URGENT — MVP Go-Live

- [ ] **UNI-1708**: Unblock Xero OAuth — setup guide + env vars + test flow
  - Code is complete. Blocker: CCW needs Xero Dev App + env vars on Railway
  - https://linear.app/unite-group/issue/UNI-1708

- [ ] **UNI-1696**: Update CLAUDE.md to v4.0 — Superpowers + gstack integration
  - Session sequence: 13 → 18 steps. Board member skill bindings. COO/CSO commands.
  - https://linear.app/unite-group/issue/UNI-1696

### 🟡 P2 HIGH — Security Remediation

- [ ] **UNI-1702**: P2-A Backfill organization_id on NULL rows across all data tables
  - `customers` + `orders` have org_id column but ALL rows are NULL
  - Single existing org: `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11` (CCW Equipment Suppliers)
  - https://linear.app/unite-group/issue/UNI-1702

- [ ] **UNI-1703**: P2-B Add organization_id column to 21 unlinked tables
  - 21 tables with only `id` column — cannot be org-isolated without schema changes
  - Decision required per table: org-scoped or global/shared
  - https://linear.app/unite-group/issue/UNI-1703

- [ ] **UNI-1704**: P3 Replace all 35 always-true RLS policies with org-scoped isolation
  - Blocked by: UNI-1702, UNI-1703, UNI-1701
  - https://linear.app/unite-group/issue/UNI-1704

- [ ] **UNI-1705**: SEC-FIX Drop api_usage_summary SECURITY DEFINER view + fix function search_path
  - View runs with creator's permissions, bypasses RLS — privilege escalation vector
  - https://linear.app/unite-group/issue/UNI-1705

- [ ] **UNI-1698**: D-021 Index unindexed foreign keys on order_activity and order_items
  - Supabase Performance Advisor flagged: JOINs degrade to O(n) sequential scans
  - https://linear.app/unite-group/issue/UNI-1698

### 🟡 P2 HIGH — MVP Go-Live Sprint

- [ ] **UNI-1709**: Create Stripe webhook receiver endpoint — POST /api/webhooks/stripe
  - Revenue blocker. Create `apps/backend/src/api/routes/stripe_webhooks.py`
  - Processes: invoice.paid, invoice.payment_failed, customer.subscription.updated, checkout.session.completed
  - https://linear.app/unite-group/issue/UNI-1709

- [ ] **UNI-1711**: Build /settings/billing dashboard page (L — 4-5 hours)
  - Backend + billing.ts API client exist. No UI page yet.
  - Components: SubscriptionCard, PaymentMethodsList, InvoiceHistory
  - Follow: `apps/web/app/(dashboard)/invoices/page.tsx` pattern
  - https://linear.app/unite-group/issue/UNI-1711

- [ ] **UNI-1712**: Centralize backend URL configuration across frontend (S — 1 hour)
  - 3 different env var names across 25+ files. Create `apps/web/lib/api/backend-url.ts`
  - https://linear.app/unite-group/issue/UNI-1712

- [ ] **UNI-1713**: Nightly sync E2E verification — Cin7 + Xero + Shopify (M — 2 hours)
  - Manually trigger: shadow-sync-cin7 (7pm), shadow-sync-xero (8pm), auto-reorder (9pm), daily-report (9am)
  - https://linear.app/unite-group/issue/UNI-1713

- [ ] **UNI-1714**: Production smoke test — 15-point checklist (M — 2 hours)
  - Landing page, login, dashboard, CRUD, POS, Cin7 status, cron jobs, sidebar links, CSV export, mobile viewport, Settings > Integrations
  - https://linear.app/unite-group/issue/UNI-1714

- [ ] **UNI-1715**: Production operations runbook for CCW handoff (M — 2 hours)
  - Env var checklist, cron inventory, Xero OAuth guide, Stripe webhook config, monitoring guide, rollback procedure, staff onboarding
  - https://linear.app/unite-group/issue/UNI-1715

### 🟡 P2 HIGH — Boardroom CRON Enhancement

- [ ] **UNI-1691**: Wire gstack /browse competitor scrape into CRON pre-session
  - Add between apify.js (step 4) and orchestrator.js (step 7)
  - https://linear.app/unite-group/issue/UNI-1691

- [ ] **UNI-1692**: Bind Superpowers skills to board member system prompts
  - Each board member's prompt needs updating with their skill bindings
  - https://linear.app/unite-group/issue/UNI-1692

- [ ] **UNI-1693**: Add gstack /cso security audit to CRON cycle (weekly — Monday 06:00 AEST)
  - https://linear.app/unite-group/issue/UNI-1693

- [ ] **UNI-1694**: Add gstack /qa browser testing to every CRON cycle
  - https://linear.app/unite-group/issue/UNI-1694

### 🟢 P3 MEDIUM — Boardroom CRON

- [ ] **UNI-1695**: Add gstack /retro feedback loop to CRON post-session (step 18)
  - https://linear.app/unite-group/issue/UNI-1695

- [ ] **UNI-1672**: CCW YouTube — Channel setup, branding + trailer
  - Non-code: channel config, banner, profile, trailer brief
  - https://linear.app/unite-group/issue/UNI-1672

---

## EXECUTION ORDER (recommended)

1. UNI-1699 (auth audit — unblocks 1700, 1701, 1702, 1703, 1704)
2. UNI-1705 (SEC-FIX SECURITY DEFINER view — quick win, standalone)
3. UNI-1698 (index unindexed FKs — quick win, standalone)
4. UNI-1708 (Xero OAuth setup guide — CCW action required)
5. UNI-1709 (Stripe webhook receiver — revenue blocker)
6. UNI-1712 (centralize backend URL — cleanup before billing page)
7. UNI-1711 (billing dashboard page)
8. UNI-1713 (nightly sync verification)
9. UNI-1714 (smoke test)
10. UNI-1715 (runbook — for CCW handoff)

---

## BLOCKED

- UNI-172 SUB-8: Backend pytest tests for new inventory endpoints
- UNI-173 SUB-7: Xero sync (gated on Xero auth — unblocked by UNI-1708)
- UNI-664 SUBs 2/4/5/6: GitHub Environments, branch protection (require GitHub UI)
- UNI-1235: pgvector semantic search (requires demo_models.py schema change approval)
- UNI-1236: Enhanced Shopify (blocked by Shopify auth prerequisite)
- UNI-1700, 1701, 1702, 1703, 1704: blocked by UNI-1699 (auth audit first)

---

## IMMUTABLE RULES (never change)

- DO NOT modify `demo_models.py` (schema locked)
- DO NOT modify `middleware.ts` or `demo_auth.py` (auth locked)
- Always: /plan → approve → implement → test → report

## Tech Stack

- Frontend: Next.js 15, React 19, TypeScript 5.7, Tailwind v4, shadcn/ui, Vercel
- Backend: FastAPI Python 3.12, SQLAlchemy 2.0, Pydantic v2, Railway
- Database: PostgreSQL 15 — Supabase Cloud
- Package Manager: pnpm (frontend), uv (backend)
- AI Tooling: Superpowers (14 skills) + gstack (29 commands, Bun 1.3.11)
- Branch: ai-updates → origin CleanExpo/CCW-CRM
