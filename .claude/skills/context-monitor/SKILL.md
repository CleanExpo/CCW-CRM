# Context Monitor Skill

**Name:** context-monitor
**Triggers:** `/context`, auto (every 10 messages)
**Version:** 1.0.0

---

## Purpose

Monitors conversation context usage and prevents context overflow.

---

## Commands

### `/context`
Shows current context status

**Output:**
```
📊 Context Status

Tokens used: ~85,000 / 200,000 (42%)
Status: 🟢 Normal

Messages: 42
Last CLAUDE.md read: 15 messages ago (⚠️ re-read recommended)

Recommendations:
- Continue normally
- Re-read CLAUDE.md within next 5 messages
```

### `/context compact`
Triggers context compaction (summarize and continue)

### `/context clear`
Resets context (use sparingly)

---

## Thresholds

- 🟢 **< 80k tokens**: Normal - continue
- 🟡 **80k - 120k tokens**: Warning - consider compaction
- 🟠 **120k - 150k tokens**: High - compact soon
- 🔴 **> 150k tokens**: Critical - auto-compact

---

## Auto-Actions

Every 10 messages:
- Check token count
- Warn if approaching limit
- Suggest compaction if needed

Every 5 messages:
- Remind to re-read CLAUDE.md

---

## Usage

```
# Check status
/context

# Trigger compaction
/context compact
```
