# Current State — 2026-04-01T15:00:00

## Active Sprint: Video Pipeline — COMPLETE (Session 3)

### Session 3 Completion Status (2026-04-01)

#### Video Pipeline — ALL DONE
- [x] FirstLookVideo: 6 scenes — emoji-free (colored dots, letter-circles, step numbers, CSS shapes, screenshot-driven)
- [x] ConnectionsGuideVideo: 2-connection flow (Shopify + Xero only — Supabase removed, CCW infrastructure)
- [x] Narration scripts: FirstLook synced to scene durations, Connections updated for 2-connection flow
- [x] Boardroom scenes (3): BuildStatusScene, CTAScene, MoonShotScene — emoji-free
- [x] Onboarding scenes (3): GoLiveScene, ConnectionSetupScene, RequirementsScene — emoji-free with SVG icons
- [x] Videos rendered: `firstlook.mp4` + `connections-guide.mp4`

#### YouTube Channel ID — FIXED (UNI-1747 — Done)
- [x] DemoVideoBanner.tsx, youtube_upload.py — both set to `UChN8nQFig73BoefyMBIsN-w`

#### YouTube Uploads — 10/26 done, 16 pending (UNI-1751 — Backlog)
- Quota-gated: ~6 uploads/day. CRON job at 9:07 AM retries daily.
- Pending: connections-guide, first-look, overview, pos, products, purchase-orders, quotes, reports, settings, shipments, suppliers, tradies, vs-spreadsheets, warehouse, workflows, workshop

#### TypeScript — ✅ 0 errors
- `pnpm turbo run type-check` — 2 packages checked, 0 errors (cached)

#### Production Site — ✅ VERIFIED
- Dashboard: `ccw-crm-web.vercel.app/dashboard` — loads correctly
- All 6 KPIs rendering: $0.00 Revenue, 5 Active Orders, 60 SKUs, 35 Customers, 12 Low Stock, 7 Pending Quotes
- Full navigation sidebar with all modules visible
- Revenue Trend, Stock Health, Sales by Category all rendering

#### Supabase Security Advisors (documented, not blocking)
- **INFO**: `alembic_version` + `carrier_configurations` — RLS enabled, no policies (non-PII system tables, acceptable)
- **WARN**: 20 operational tables with `USING (true)` policies — Phase 3 RLS (acceptable for single-tenant MVP, Phase 4 future work)
- **WARN**: `auth_leaked_password_protection` disabled — **MANUAL ACTION**: Supabase Dashboard → Auth → Password Security → enable

#### Git — Branch: fix/railway-cache-auth-500
- `9c7a6d5` — feat(video): redesign Remotion scenes (12 files)
- `b3d4f20` — feat(video): complete emoji removal, fix YouTube channel ID (10 files)
- `735573c` — chore(git): exclude remotion artifacts (latest)
- All pushed to `origin/fix/railway-cache-auth-500`

#### Linear Issues
- UNI-1747 — Done (YouTube channel ID fixed)
- UNI-1751 — Backlog (Upload 16 remaining YouTube videos, High)
- UNI-1752 — Backlog (Regenerate ElevenLabs audio, Medium — needs API key)
- UNI-1753 — Backlog (Activate Supabase JWT hook, Urgent — manual)

---

## BLOCKERS (user-action required)

1. **ELEVENLABS_API_KEY** — not in any .env. Run: `ELEVENLABS_API_KEY=sk_... node scripts/generate-intro-audio.js all`
2. **Supabase JWT hook** — Manual: Dashboard → Authentication → Hooks → enable `custom_access_token_hook`
3. **Supabase leaked password protection** — Manual: Dashboard → Auth → Password Security → enable
4. **YouTube quota** — 16 videos pending. CRON handles daily retry at 9:07 AM.
5. **Vercel env var** — Set `YOUTUBE_CHANNEL_ID=UChN8nQFig73BoefyMBIsN-w` in Vercel dashboard

---

## Previous Sprint: COMPLETE — All CCW-ERP/CRM Linear Issues Resolved

### Session 2 Additions (2026-03-31 evening)

#### Linear Housekeeping — All Issues Marked Done
- [x] UNI-1691/1693/1694/1695/1716/1138/1139/1140/1141/1137/1135/1136/1134 — marked Done
- [x] UNI-1712/1711/1709/1715/1714/1713/1696/1708 — previously completed, now marked Done

#### UNI-1692: Superpowers Skill Bindings (DONE)
- [x] `scripts/boardroom/orchestrator.js` — all 10 board members + Witness get `superpowers: []` field
- [x] Commit `9ad7a73` pushed to `ai-updates`

#### UNI-1697: RLS Security (DONE)
- [x] pg_trgm moved from public → extensions schema
- [x] 13 customer PII tables: org-scoped RLS deployed
- [x] 20 operational tables: acceptable risk for single-tenant MVP
- ⚠️ MANUAL: Enable leaked password protection in Supabase Auth settings

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
- Branch: fix/railway-cache-auth-500 → main → CleanExpo/CCW-CRM
