# Progress

**Phase**: Production — Video Pipeline + Go-Live Sprint
**Last Updated**: 2026-04-01T15:00:00
**Branch**: `fix/railway-cache-auth-500`

## Active Tasks

| Task | Status | Linear |
|------|--------|--------|
| Remotion scene redesign (emoji-free) | DONE | — |
| YouTube uploads (10/26 done) | BLOCKED (quota) | UNI-1751 |
| ElevenLabs audio regeneration | BLOCKED (API key) | UNI-1752 |
| Supabase JWT hook activation | BLOCKED (manual) | UNI-1753 |
| Leaked password protection | BLOCKED (manual) | — |

## Completed This Session (2026-04-01)

- [x] FirstLookVideo: 6 scenes redesigned — emoji-free
- [x] ConnectionsGuideVideo: rewritten for 2-connection flow (Shopify + Xero)
- [x] Boardroom scenes (3): BuildStatusScene, CTAScene, MoonShotScene — emoji-free
- [x] Onboarding scenes (3): GoLiveScene, ConnectionSetupScene, RequirementsScene — SVG icons
- [x] YouTube channel ID fixed: `UChN8nQFig73BoefyMBIsN-w`
- [x] Videos rendered: firstlook.mp4 + connections-guide.mp4
- [x] TypeScript: 0 errors
- [x] Production site verified: dashboard loads, all KPIs rendering
- [x] Supabase advisors: 20 tables with USING(true) (acceptable MVP), leaked password WARN
- [x] Git: 3 commits pushed (9c7a6d5, b3d4f20, 735573c)
- [x] Linear: UNI-1747 Done, UNI-1751/1752/1753 created

## Decisions Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Remove Supabase from ConnectionsGuide | CCW manages infra; clients only connect Shopify + Xero | 2026-04-01 |
| RLS USING(true) on 20 operational tables | Single-tenant MVP; org-scoped on 13 PII tables | 2026-03-30 |
| Custom JWT over Supabase Auth | demo_auth.py locked; migration deferred | 2026-03-30 |
| YouTube private (not unlisted) | Internal training videos for now | 2026-04-01 |

## Blockers (User Action Required)

1. **ELEVENLABS_API_KEY** — add to .env, run `node scripts/generate-intro-audio.js all`
2. **Supabase JWT hook** — Dashboard > Auth > Hooks > enable `custom_access_token_hook`
3. **Leaked password protection** — Dashboard > Auth > Password Security > enable
4. **YouTube quota** — 16 videos pending, CRON retries daily at 9:07 AM
5. **Vercel env** — set `YOUTUBE_CHANNEL_ID=UChN8nQFig73BoefyMBIsN-w`

## Notes for Next Context Window

- All Remotion scenes are emoji-free. Do NOT re-introduce Unicode emoji in video scenes.
- ConnectionsGuideVideo is 2-connection only (Shopify + Xero). Supabase is CCW infrastructure.
- YouTube uploads are quota-gated (~6/day). Check `python scripts/youtube_upload.py --status`.
- The `.claude/CLAUDE.md` file is the old detailed version (archived as `.claude/CLAUDE.md.pre-control-system`). The new control system uses CLAUDE.md (root) + companion files in `.claude/`.
- Supabase project: `vwfgksqkajnpfjospbpe`
- Linear team: Unite-Group, project: CCW-ERP/CRM
