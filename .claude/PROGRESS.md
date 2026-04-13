# Progress

**Phase**: Go-Live — Sprint 3 Infrastructure
**Last Updated**: 2026-04-14
**Branch**: `claude/reverent-sanderson`

## Active Tasks

| Task                              | Status | Linear |
| --------------------------------- | ------ | ------ |
| Agents Protocol v1.0 installation | DONE   | —      |

## Completed This Session (2026-04-14)

- [x] test(backend): Agents Protocol v1.0 integration tests — 123 assertions, all passing

- [x] feat(web): live search in Cmd+K palette — customers, products, orders
- [x] fix(web): command palette — stuck spinner, search error state, memoize commands
- [x] feat(web): search + status filter on Orders page — UNI-1795
- [x] fix(web): add updateField to debounce effect deps — orders search
- [x] feat(backend): in-app notifications for expiring quotes + low stock — UNI-1795
- [x] fix(backend): webhook stubs replaced with structlog + httpx forwarding
- [x] fix(backend): async_engine pool_size 5→20, max_overflow 10→40
- [x] fix(db): Alembic migration 006 — score column on product_recommendations
- [x] fix(ai): SupervisorAgent now calls Anthropic claude-haiku-4-5, not Ollama
- [x] fix(e2e): auth.setup.ts handles /onboarding redirect — CI unblocked
- [x] BetterStack log drain: logtail-python SDK + structlog stdlib bridge

## Completed Previous Sessions

- XSS sanitisation on customer fields — UNI-1783
- Anthropic API key backend + Settings UI + onboarding wizard step — UNI-1776
- Customer Discard button resets form — UNI-1784
- POS mobile tabbed layout — UNI-1787
- Dashboard stale setState guard

## Key Decisions

| Decision                               | Rationale                                 |
| -------------------------------------- | ----------------------------------------- |
| html.escape() for XSS                  | stdlib, no deps, escapes all 5 HTML chars |
| Anthropic key in IntegrationCredential | Consistent with SendGrid pattern          |
| POS mobile = Tabs not scroll           | Instant access; desktop grid unchanged    |
| Anthropic key: DB first → env fallback | Flexibility without hardcoding            |

## Blockers (User Action Required)

1. **PR #69 review** — merge claude/festive-keller → ai-updates when CI passes
2. **Anthropic API key** — CCW staff must enter sk-ant- key via Settings → Integrations

## Notes

- Customer string fields sanitised at Pydantic layer; SQL injection via Supabase parameterised queries
- POS desktop layout unchanged (h-[600px] at lg+)
- Supabase project: `vwfgksqkajnpfjospbpe`
