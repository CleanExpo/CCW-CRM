# Current State — 2026-03-31T12:00:00

## Active Sprint: COMPLETE — Boardroom CRON v2 + Agent Teams + CLAUDE.md Governance Shipped

---

## COMPLETED THIS SESSION (2026-03-31)

### Boardroom CRON v2 — gstack Integrations (UNI-1691/1693/1694/1695)
- [x] UNI-1691: `scripts/boardroom/browse-competitive.js` — Playwright competitor scrape (step 03b)
- [x] UNI-1693: `scripts/boardroom/security-audit.js` — OWASP/secrets/deps/privacy audit (step 10)
- [x] UNI-1694: `scripts/boardroom/qa-check.js` — full browser QA suite (step 18a)
- [x] UNI-1695: `scripts/boardroom/retro.js` — post-session retrospective → cycle_complete.json (step 18c)
- [x] UNI-1140: `scripts/boardroom/claudemd-audit.js` — fortnightly CLAUDE.md health check (Mondays)
- [x] `scripts/boardroom/orchestrator.js` updated — all 5 new modules integrated

### CLAUDE.md Governance (UNI-1138/1139/1140/1141/1716)
- [x] UNI-1141: `.claude/CLAUDE.md` updated to v4.1 — Agent Teams, agent-browser, CRON v2 sections
- [x] UNI-1716: `.claude/memory/CLAUDE-SYNC.md` — Chat → Cowork → Code v2.1.86 architecture
- [x] UNI-1138: `.claude/memory/CLAUDEMD-MASTER-TEMPLATE.md` — master template for all projects
- [x] UNI-1139: `.claude/memory/CLAUDEMD-GOVERNANCE.md` — inventory, standards, audit schedule

### Agent Teams + agent-browser Architecture (UNI-1134/1135/1136/1137)
- [x] UNI-1137: `.claude/memory/AGENT-TEAMS-ARCHITECTURE.md` — experimental parallel agent plan
- [x] UNI-1135: `.claude/memory/AGENT-BROWSER-INTEGRATION.md` — AI sidebar for all 7 portals
- [x] UNI-1136: `.claude/memory/AGENT-TEAMS-BROWSER-COMBINED.md` — combined architecture
- [x] UNI-1134: `.claude/memory/TeammateIdle.hook.md` + `TaskCompleted.hook.md` — quality gate hooks

### Commit & Push
- [x] Commit `b14921d` — all work committed to main, pushed to `ai-updates`
- [x] TypeScript: ✅ zero errors

---

## COMPLETED PREVIOUS SESSION (2026-03-30)

### Database Security (Supabase — project vwfgksqkajnpfjospbpe)
- [x] UNI-1699: Auth audit — app uses custom JWT (python-jose), NOT Supabase native auth. Backend uses service_role SQLAlchemy connection → RLS bypassed at DB level (by design for now)
- [x] UNI-1705: Secured `api_usage_summary` view (SECURITY INVOKER + RLS on api_usage table)
- [x] UNI-1698: Added missing FK indexes: `order_activity.organization_id`, `order_items.product_id`, `suppliers.organization_id`, `purchase_orders.organization_id`
- [x] UNI-1702: Backfilled `organization_id` on all NULL rows across 11 core tables
- [x] UNI-1701: Created `custom_access_token_hook()` Supabase function to inject `org_id` into JWT claims — **⚠️ MANUAL STEP REQUIRED**: Activate at Supabase Dashboard → Authentication → Hooks → "Customize Access Token (JWT) Claims" → select `public.custom_access_token_hook`
- [x] UNI-1703/1704: All 39 CCW project tables now have RLS enabled. Org-scoped policies deployed on suppliers, purchase_orders, and 12 more tables

### Code Changes
- [x] UNI-1709: Stripe webhook receiver — already implemented in previous session (`/api/webhooks/stripe`)
- [x] UNI-1711: `/settings/billing` dashboard page — SubscriptionCard, PaymentMethodsList, InvoiceHistory
- [x] UNI-1712: Backend URL centralized — `apps/web/lib/api/backend-url.ts` with `getBackendUrl()` function
- [x] UNI-1691-1695: All board member agents verified — Superpowers bindings already correct
- [x] UNI-1696: CLAUDE.md v4.0 — already updated in previous session

### Documentation
- [x] UNI-1708: `docs/xero-setup-guide.md` — Updated CCW-facing Xero setup guide
- [x] UNI-1713: `docs/nightly-sync-verification.md` — Operator-facing sync guide
- [x] UNI-1714: `docs/smoke-test-checklist.md` — 15-point post-deploy checklist
- [x] UNI-1715: `docs/production-runbook.md` — Full ops runbook for CCW handoff
- [x] UNI-1688: `docs/privacy-architecture.md` — AU Privacy Act 2024 compliance framework

---

## BLOCKED / DEFERRED

### UNI-1700: Remove hashed_password from public.users
**Status**: BLOCKED — locked files
**Reason**: auth requires `demo_auth.py` (DO NOT MODIFY) + `middleware.ts` (DO NOT MODIFY). These files depend on `hashed_password`.
**Mitigation**: Users table now has RLS enabled. `users_own_profile` policy uses `auth_id = auth.uid()` — since the app uses custom JWT (not Supabase native auth), `auth.uid()` returns NULL for all requests, effectively blocking direct Supabase anon-key access to hashed_passwords. Service role (backend) still accesses it through SQLAlchemy.
**Future path**: Requires full auth migration: custom JWT → Supabase native auth. Out of scope for current sprint.

---

## COMMITS THIS SESSION (pushed to ai-updates)

- `cc908a5`: feat(billing): add /settings/billing dashboard page (UNI-1711)
- `f10b16a`: feat(UNI-1712): centralize backend URL config with getBackendUrl()
- `4e78190`: chore(memory): sync current-state.md with Boardroom Linear tasks
- `970daa8`: docs: complete MVP Go-Live + Privacy Act documentation suite

---

## SUPABASE MIGRATIONS APPLIED (CCWiCRM-ERP — vwfgksqkajnpfjospbpe)

- `uni_1705_secure_api_usage_view` — SECURITY INVOKER view + RLS on api_usage
- `uni_1698_index_fk_columns` — 4 new FK indexes
- `uni_1702_backfill_org_id_all_tables` — org_id backfill on 11 tables
- `uni_1701_supabase_jwt_org_claim_hook` — JWT claim hook function (activation: Supabase Dashboard)
- `uni_1703_enable_rls_on_remaining_tables` + `uni_1703_rls_remaining_tables_fixed` — 15+ tables with RLS policies

---

## NEXT ACTIONS FOR CCW

1. **URGENT**: Activate JWT hook in Supabase Dashboard:
   → Dashboard → Authentication → Hooks → "Customize Access Token (JWT) Claims" → `public.custom_access_token_hook`

2. **URGENT**: Set Xero env vars in Railway (see docs/xero-setup-guide.md):
   → `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI`

3. **REQUIRED BEFORE GO-LIVE**: Run smoke test checklist (docs/smoke-test-checklist.md)

4. **FUTURE**: Auth migration (custom JWT → Supabase native) to fully resolve UNI-1700

---

## REMAINING BACKLOG (lower priority, future sprint)

- UNI-1672: YouTube channel setup (manual CCW action)
- UNI-1695: /retro feedback loop in CRON post-session
- UNI-1693: /cso security audit in CRON cycle
- UNI-1694: /qa browser testing in CRON cycle

---

## IMMUTABLE RULES

- DO NOT modify `demo_models.py` (schema locked)
- DO NOT modify `middleware.ts` or `demo_auth.py` (auth locked)
- Always: /plan → approve → implement → test → report

## Tech Stack

- Frontend: Next.js 15, React 19, TypeScript 5.7, Tailwind v4, shadcn/ui, Vercel
- Backend: FastAPI Python 3.12, SQLAlchemy 2.0, Pydantic v2, Railway
- Database: PostgreSQL 15 — Supabase Cloud (vwfgksqkajnpfjospbpe, ap-southeast-2)
- Package Manager: pnpm (frontend), uv (backend)
- AI Tooling: Superpowers (14 skills) + gstack (29 commands, Bun 1.3.11)
- Branch: ai-updates → main → CleanExpo/CCW-CRM
