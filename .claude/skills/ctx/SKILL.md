# Context Health Check Skill

**Name:** ctx
**Triggers:** `/ctx` (manual invocation only — not natural language)
**Version:** 1.0.0

---

## Purpose

One-line context health check. Runs the built-in `/context` command, summarises the result, and recommends ONE action: disconnect an idle MCP server, run `/compact`, run `/clear`, or "context clean" (no action needed). Designed to be cheap enough to run between tasks without itself adding measurable context.

This is the diagnostic counterpart to `/next` and `/resume`. Run it when the session feels slow or when you want to know whether you can keep going without compacting.

---

## Commands

### `/ctx`

Runs `/context` (the built-in Claude Code command), parses the output for:

- **MCP overhead** — total tokens used by idle MCP servers
- **Conversation size** — current % of the context window in use
- **Free space** — tokens remaining before auto-compact triggers
- **Top consumer** — single biggest token sink (conversation history, MCP, file reads, skills, etc.)

Then prints **ONE LINE** with:

- Status: 🟢 healthy / 🟡 watch / 🔴 act now
- Top consumer with token count
- ONE recommendation

**Example outputs:**

```
🟢 35% — top: conversation 42K — context clean, keep going
🟡 68% — top: MCP gmail 18K idle — disconnect gmail server
🔴 89% — top: conversation 180K — /next then /clear
🟡 71% — top: file reads 35K — /compact preserve "file paths, decisions"
```

---

## Process Rules

1. **One line output. Hard cap.** No additional explanation, no breakdown, no "here are some other things you could do". One line.
2. **One recommendation. Always.** Even at 🟢 healthy, name the next thing to watch.
3. **Disable model invocation.** Never fire on natural language. Only explicit `/ctx`.
4. **No file reads.** This skill exists to MEASURE context, not consume more of it. The only tool call should be `/context` itself.
5. **Honest thresholds:**
   - 🟢 < 60% used
   - 🟡 60-79% used
   - 🔴 ≥ 80% used (auto-compact zone)

---

## Recommendation Decision Tree

```
IF MCP servers > 5 tokens/message AND idle > 10 min:
  → "disconnect <server>" (CLI > MCP)
ELIF conversation > 70% AND task complete:
  → "/next then /clear"
ELIF conversation > 70% AND task in progress:
  → "/compact preserve <key items>"
ELIF file reads > 30K AND task complete:
  → "/compact preserve file paths"
ELIF skills loaded > 10 AND most unused:
  → "rare skills should set disable-model-invocation"
ELSE:
  → "context clean, keep going"
```

---

## When NOT to use this skill

- You already know context is fine — skip the check
- You already know context is full — just `/compact` or `/clear` directly, no diagnosis needed
- You want a detailed breakdown — run `/context` directly instead

---

## Related

- `.claude/skills/context-monitor/SKILL.md` — heavier auto-monitoring skill that runs every 10 messages
- `.claude/skills/next/SKILL.md` — task transition (the action `/ctx` recommends when conversation > 70%)
- `.claude/skills/resume/SKILL.md` — recovery after `/clear`
