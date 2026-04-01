# /spec Command

**Purpose:** Read and review project specifications

**Triggers:** `/spec`, `/spec [topic]`

---

## What It Does

Reads and summarizes key specification files:
- `CLAUDE.md` (root) - Quick reference
- `.claude/CLAUDE.md` - Full instructions
- `.claude/.directives` - Active rules
- `docs/IMPLEMENTATION-PROGRESS.md` - Current phase
- `.claude/.execution` - Active task state

---

## Usage

```
# Read all specs
/spec

# Read specific topic
/spec database
/spec forbidden
/spec workflow
```

---

## When To Use

- When unclear about requirements
- Before starting work
- When confused about what's allowed
- Every conversation start (automatic)
- Every 5 messages (recommended)

---

## Output

```
## 📋 Project Specifications

**Project:** CCW-Online ERP
**Current Phase:** Phase 1 Complete (i18n)
**Status:** Ready for next phase

### Key Points
- Equipment Supplier ERP
- Next.js 15 + FastAPI stack
- 10 languages supported
- Translation dashboard complete

### What's Forbidden
- Database schema changes
- Auth code modifications
- Breaking API changes

### Current Task
[From .execution file]

**Ready to proceed with:** [Next recommended action]
```

---

## Related

- `.claude/STARTUP.md` - Read first every session
- `.claude/CLAUDE.md` - Full system instructions
- `docs/` - Additional documentation
