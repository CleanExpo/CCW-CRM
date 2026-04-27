# CCW-CRM

Portfolio repo (Unite-Group). Refer to portfolio standards and Pi-CEO orchestration in `Pi-Dev-Ops/`.

## Review Skills — Mandatory Discipline (2026-04-27)

Four skills live at `~/.claude/skills/` and form the lifecycle review gate for every Unite-Group portfolio repo. These are not the noisy Vercel/Next-upgrade advisories — these are mandatory and apply to interactive Claude Code sessions automatically.

| Skill | Phase | Trigger | Cost |
|---|---|---|---|
| `design-pressure-test` | Before code | Non-trivial feature plan, before writing | $0 (Opus on Max) |
| `parallel-delegate` | During code | 2+ independent subtasks | $0 (Sonnet subagents) |
| `opus-adversary` | After code, before push | Any non-trivial diff | $0 (Opus on Max) |
| `codex-adversarial` | Before merge, high-stakes only | Auth / payments / migrations / data-loss / security / races | ~1/day ChatGPT Plus quota |

Hard rules:
- `opus-adversary` runs before every push. Verdict BLOCK = do not push.
- `codex-adversarial` is never wired into autonomous loops; manual invocation only on dangerous changes.
- Skills are user-level — they fire automatically in any interactive Claude Code session.
- Trial criteria for codex-adversarial tracked in RA-1741.
