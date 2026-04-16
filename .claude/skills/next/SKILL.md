# Next Skill

**Name:** next
**Triggers:** `/next` (manual invocation only — not natural language)
**Version:** 1.0.0

---

## Purpose

Task transition. Snapshots the current task state to disk, then guides the user to either `/compact` (if the next task is related) or `/clear` (if unrelated). Single biggest token saver in the optimization pack — the audit found that 98.5% of tokens in long sessions are conversation re-reading, and `/clear` between unrelated tasks eliminates that cost entirely.

This skill is **manual invocation only**. It is not triggered by natural language because the decision to compact or clear is intentional and CEO-driven.

---

## Commands

### `/next`

Runs three steps:

**Step 1 — Snapshot.** Writes `.claude/snapshots/last-task.md` containing:

- What completed (checklist of done items)
- Files modified (full paths)
- Decisions made (architectural choices, naming conventions, gotchas discovered)
- Next steps (what the user said they want to do next, even if vague)

The snapshot is plain markdown. `/resume` reads it later to recover state without re-reading the conversation.

**Step 2 — Ask.** Asks the user one question via `AskUserQuestion`:

> Is your next task RELATED to what we just did, or UNRELATED?
>
> - **RELATED** — same module, same file, follow-up work → run `/compact` and preserve file paths + decisions + test results
> - **UNRELATED** — different module, different concern → run `/clear` and start fresh

**Step 3 — Confirm.** After the user picks, the skill prints one line:

- `Ready. Context [compacted/cleared]. Run /resume to restore the snapshot if needed.`

---

## Snapshot Format

`.claude/snapshots/last-task.md`:

```markdown
# Last Task Snapshot

**Date:** YYYY-MM-DD HH:MM
**Branch:** claude/<worktree>
**Status:** [in-progress | complete | blocked]

## Completed

- [item 1]
- [item 2]

## Files Modified

- apps/backend/src/api/routes/X.py
- apps/web/components/Y.tsx

## Decisions

- [architectural choice + why]
- [pattern used + reference file]

## Next Steps

- [what the user asked for next]
- [open questions]

## Verification State

- Tests: [passing | failing | not run]
- Lint: [clean | dirty | not run]
- Type-check: [clean | dirty | not run]
```

---

## Process Rules

1. **Snapshot before asking.** Write the file first, THEN ask the user. If the user closes the session before answering, the snapshot is still on disk.
2. **Never auto-clear.** The user must explicitly choose. `/clear` is destructive to conversation context.
3. **Never auto-compact.** Same reason. The user controls when context is reduced.
4. **Disable model invocation.** This skill must never fire on natural language — only the explicit `/next` slash command.
5. **Snapshot is plain markdown.** No frontmatter, no YAML, no JSON. `/resume` parses it as plain text.

---

## When NOT to use this skill

- You're mid-task and not done — finish first, then `/next`
- You don't plan to start a new task — just leave the session open
- You want to fully wipe state including the snapshot — `/clear` directly

---

## Related

- `.claude/skills/resume/SKILL.md` — reads the snapshot this skill writes
- `.claude/skills/ctx/SKILL.md` — diagnoses whether `/compact` or `/clear` is needed
- `.claude/snapshots/` — directory that holds snapshots and pre-compact diffs (auto-created by hooks + this skill)
