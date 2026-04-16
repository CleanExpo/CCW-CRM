# Resume Skill

**Name:** resume
**Triggers:** `/resume` (manual invocation only — not natural language)
**Version:** 1.0.0

---

## Purpose

Recovers from a saved task snapshot after `/clear` or after starting a new session. Reads `.claude/snapshots/last-task.md` and `.claude/snapshots/pre-compact-diff.txt` (if they exist), reports a brief status under 80 words, and asks what to work on next. Does NOT re-read previously-touched files — that defeats the entire point of clearing context.

This is the recovery half of `/next`. Together they form the task-transition cycle: `/next` snapshots and clears, `/resume` reads the snapshot and starts fresh.

---

## Commands

### `/resume`

Runs three steps:

**Step 1 — Read snapshots.** Reads (with `Read` tool, no agent dispatch needed):

- `.claude/snapshots/last-task.md` if it exists
- `.claude/snapshots/pre-compact-diff.txt` if it exists (set by the PreCompact hook)
- `.claude/snapshots/compaction.log` for the most recent compaction timestamp (last 5 lines only)

If no snapshot exists, reports "No snapshot found. Starting fresh." and stops.

**Step 2 — Brief status.** Prints under 80 words:

- Last task: [one line from the snapshot's title or status]
- Files touched: [count + most-recent path]
- Verification state: [tests/lint/type-check status from snapshot]
- Branch: [from snapshot]

**Step 3 — Ask.** "What would you like to work on?" — single open question. Does NOT speculate about next steps.

---

## Process Rules

1. **No file re-reads.** The whole point of `/clear` was to drop the conversation. Do not re-read any of the files listed in the snapshot. The snapshot itself is the only source of truth this skill needs.
2. **No agent dispatch.** Snapshots are small (< 2 KB). Read them directly with the `Read` tool. Do not invoke subagents.
3. **80-word budget.** Status report is hard-capped. The user can ask follow-up questions if they need more.
4. **Disable model invocation.** Never fire on natural language. Only the explicit `/resume` slash command.
5. **Graceful degradation.** If the snapshot file is corrupted or missing, report it plainly and offer to start fresh. Do not try to "reconstruct" state from git log.

---

## What this skill is NOT

- Not a session restorer — it does not restore the previous conversation
- Not a context loader — it deliberately keeps context minimal
- Not a "catch up" tool — for that, ask the user directly what they remember
- Not a debugger — if the previous task was blocked, the snapshot says so but `/resume` does not investigate why

---

## When NOT to use this skill

- This is a fresh session on a topic the snapshot has nothing to do with — just start working, ignore the snapshot
- You want full conversation restoration — that's not possible after `/clear`; restart the session
- The snapshot is more than 7 days old — probably stale, treat it as informational only

---

## Related

- `.claude/skills/next/SKILL.md` — writes the snapshot this skill reads
- `.claude/snapshots/` — snapshot directory (auto-created)
- `.claude/settings.local.json` PreCompact hook — writes `pre-compact-diff.txt` automatically
