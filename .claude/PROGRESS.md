# Progress

**Phase**: Go-Live — Sprint 2 Bug Fixes
**Last Updated**: 2026-04-13
**Branch**: `claude/festive-keller` → PR #69 into `ai-updates`

## Active Tasks

| Task                                | Status | Linear   |
| ----------------------------------- | ------ | -------- |
| XSS sanitisation on customer fields | DONE   | UNI-1783 |
| Anthropic API key backend endpoint  | DONE   | UNI-1776 |
| Anthropic API key Settings UI       | DONE   | UNI-1776 |
| Anthropic step in onboarding wizard | DONE   | UNI-1776 |
| Customer Discard button resets form | DONE   | UNI-1784 |
| POS mobile tabbed layout            | DONE   | UNI-1787 |
| Dashboard stale setState guard      | DONE   | —        |

## Completed This Session (2026-04-13)

- [x] Dark smoke test run: injection, rapid nav, mobile, CSV, auth bypass
- [x] Bugs logged to Linear: UNI-1783, UNI-1784, UNI-1787
- [x] PR #67 merged to ai-updates (POS $NaN, logout redirect, connecting badge, settings redirect)
- [x] fix(backend): html.escape() validator on CustomerBase + CustomerUpdate — UNI-1783
- [x] feat(backend): GET/POST /api/integrations/anthropic/\* — UNI-1776
- [x] feat(web): Anthropic API key input in Settings → Integrations — UNI-1776
- [x] feat(onboarding): Claude AI step (step 4) in setup wizard — UNI-1776
- [x] fix(web): Customer Discard button now calls form.reset() — UNI-1784
- [x] fix(web): POS responsive tabbed layout for mobile (below lg) — UNI-1787
- [x] fix(web): isMounted + cancelled flags on dashboard async fetches
- [x] PR #69 raised: claude/festive-keller → ai-updates

## Decisions Log

| Decision                                            | Rationale                                                           | Date       |
| --------------------------------------------------- | ------------------------------------------------------------------- | ---------- |
| html.escape() not htmlspecialchars                  | stdlib, no deps, escapes all 5 HTML special chars                   | 2026-04-13 |
| Anthropic key stored in IntegrationCredential table | Consistent with SendGrid pattern                                    | 2026-04-13 |
| POS mobile = Tabs not scroll                        | Tabs give instant access without scroll; desktop grid unchanged     | 2026-04-13 |
| isMounted plain object (not useRef)                 | useRef not imported; plain object works identically in this pattern | 2026-04-13 |

## Blockers (User Action Required)

1. **PR #69 review** — merge claude/festive-keller → ai-updates when CI passes
2. **Anthropic API key** — CCW staff must enter their sk-ant- key via Settings → Integrations or onboarding wizard before AI features activate

## Notes for Next Context Window

- All customer string fields are sanitised at Pydantic layer — SQL injection protection is via Supabase parameterised queries (not html.escape)
- Anthropic key is checked: DB first → ANTHROPIC_API_KEY env var fallback
- POS desktop layout is unchanged (h-[600px] still applies at lg+)
- Dashboard first useEffect uses a plain `{ current: true }` object as isMounted flag (not useRef — was not imported)
- Supabase project: `vwfgksqkajnpfjospbpe`
- Linear team: Unite-Group, project: CCW-ERP/CRM
