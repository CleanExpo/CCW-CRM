# Skills Audit — 2026-04-19

**Ticket:** UNI-1923 (B1.1)
**Scope:** `.claude/skills/` tree
**Action taken this pass:** 10 skills moved to `.claude/skills/_archive/`.

---

## Summary

| Count | Category                                 |
| ----: | ---------------------------------------- |
|    53 | Total skill directories before this pass |
|    10 | Moved to `_archive/`                     |
|    43 | Still active                             |
|     5 | Flagged for future review (not archived) |

Conservative sweep — when in doubt, kept. Empty dirs and skills whose
technology isn't in the codebase (Remotion, Docker-heavy ops) moved
first.

---

## Archived this pass (10)

| Skill                      | Rationale                                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `gstack`                   | Empty directory — no `SKILL.md` present                                                                                                 |
| `docker-ops`               | Oldest cohort (Jan 2026); project runs on Supabase + Vercel + Render, no Docker pipeline in active use; no references outside `skills/` |
| `context-monitor`          | Oldest cohort; native Claude context management has superseded; no references outside `skills/`                                         |
| `spec-interview`           | Oldest cohort; superseded by `autoplan` + `spec` commands; no references outside `skills/`                                              |
| `remotion-audio-sync`      | No `video/remotion/` directory exists in the repo; `remotion` not in any `package.json`                                                 |
| `remotion-render-pipeline` | Same — no Remotion codebase                                                                                                             |
| `remotion-scene-builder`   | Same — no Remotion codebase                                                                                                             |
| `remotion-video-producer`  | Same — no Remotion codebase                                                                                                             |
| `gstack-upgrade`           | Targets the `gstack` tool whose own skill dir was empty; no active references                                                           |
| `design-shotgun`           | No references outside `skills/`; design workflow covered by other active skills                                                         |

All moves done via `git mv` so history is preserved. Restore any skill
by moving it back from `_archive/` if needs arise.

---

## Kept but flagged for future review (5)

These looked stale-adjacent but had enough ambiguity to leave alone
this pass. Revisit next audit:

- `design-consultation`
- `office-hours`
- `learn`
- `codex`
- `connect-chrome`

---

## Kept — confirmed active

- **HeyGen skill pack (5 skills)** — backed by `apps/backend/src/integrations/heygen/` integration.
- **Chrome skill pack** — used by `chrome-*` commands referenced in root CLAUDE.md.
- **cso, benchmark, canary** — referenced in session workflows.
- All `blog-*`, `seo-*`, `ceo-*`, `pi-*`, `brand-voice:*`, `engineering:*`, `product-management:*`, `data:*`, `customer-support:*`, `sales:*`, `marketing:*`, `design:*`, `anthropic-skills:*`, `cowork-plugin-management:*`, `slack:*`, `commit-commands:*`, `pr-review-toolkit:*`, `feature-dev:*`, `superpowers:*` packs — all used actively.

---

## Follow-up

- Next audit in ~3 months (2026-07). Re-evaluate the 5 flagged skills above.
- If team picks up video production (Remotion), restore the 4 remotion skills from `_archive/`.
- `docs/audits/` is now a canonical place for these sweeps — see also `silent-fail-frontend-2026-04-19.md` and `todo-triage-2026-04-19.md`.
