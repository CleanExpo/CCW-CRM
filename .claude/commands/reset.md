# /reset Command

**Purpose:** Reset Claude's context and re-read all configuration

**Triggers:** `/reset`

---

## What It Does

1. Clears current task context
2. Re-reads `.claude/STARTUP.md`
3. Re-reads `.claude/CLAUDE.md`
4. Re-reads `.claude/.directives`
5. Re-reads `.claude/.execution`
6. Re-reads `docs/IMPLEMENTATION-PROGRESS.md`
7. Reports current state

---

## When To Use

- When confused about what to do
- After a long conversation (>50 messages)
- When things seem off or incorrect
- When explicitly asked by user
- After context compaction
- When switching between tasks

---

## What Happens

```
🔄 Resetting Context...

Reading configuration files...
✅ .claude/STARTUP.md
✅ .claude/CLAUDE.md
✅ .claude/.directives
✅ .claude/.execution

---

## Current State

**Project:** CCW-Online ERP
**Phase:** Phase 1 Complete (i18n)
**Active Task:** None
**Status:** Idle, awaiting instructions

**Last Completed:**
- Translation Management Dashboard
- All 9 Phase 1 tasks

**Next Recommended:**
- Phase 4: AI-Powered Search (8 tasks)

---

**Ready.** What would you like to work on?
```

---

## What Gets Reset

- Current task context
- Temporary notes
- Conversation flow

## What Stays

- File system state
- Git history
- Code changes
- Test results
- Database state

---

## Usage

```
/reset
```

---

## After Reset

You may need to:
- Re-explain current task
- Re-approve any pending plans
- Re-run commands if needed

---

## Related

- `.claude/STARTUP.md` - What gets re-read
- `/context` - Check context usage before reset
