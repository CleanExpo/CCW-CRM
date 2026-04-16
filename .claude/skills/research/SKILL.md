# Research Skill

**Name:** research
**Triggers:** `/research`, "how does X work", "trace this flow", "explain the auth path", "where is X implemented"
**Version:** 1.0.0

---

## Purpose

Answers codebase questions in an isolated subagent context so the main conversation never bloats with intermediate file reads. The parent session sees only the final 250-word summary — never the dozens of grep results, file fragments, and dead-end imports the subagent walked through to find the answer.

This skill is the **first line of defence against context bloat**. Use it whenever a question would otherwise require reading more than 2 files. The optimization audit found that 98.5% of tokens in long sessions are conversation re-reading; this skill cuts that at the source.

---

## Commands

### `/research <question>`

Dispatches an Explore subagent with the question. The subagent uses grep/glob to locate relevant code, reads only line ranges (never full files), traces imports, and stops as soon as it has the answer.

**Returns to main context (≤250 words):**

- **Answer**: 2-3 sentences directly answering the question
- **Key files**: `filepath:line` references for the 3-5 most important locations
- **Gotcha**: 1 non-obvious thing the user should know (edge case, hidden coupling, deprecated path)

---

## Dispatch Target

Routes to the **Explore** subagent type. For deeper architectural questions (multi-layer trace, requires reading 5+ files), the Explore agent itself may delegate to existing project agents (`spec-builder`, `truth-finder`) — but those calls also stay isolated from the main context.

---

## Process Rules (enforced inside the subagent)

1. **grep/glob first.** Never read a file before locating the relevant lines.
2. **Line ranges only.** `Read` calls must include `offset` + `limit` once the section is known.
3. **Stop early.** As soon as the question is answered, return — do not "explore further" speculatively.
4. **Word budget.** Output is hard-capped at 250 words. Trim verbose reasoning.
5. **No code generation.** This skill is read-only research. For implementation use `/implement` or `/fix`.

---

## When NOT to use this skill

- The question is already answered in `docs/PROJECT_MAP.md` — read that first
- The user needs to MODIFY code — use `/fix` or `/implement` instead
- Single-file lookup with a known path — just `Read` it directly with offset/limit
- Architecture-level design question requiring planning — use `/arch-plan`

---

## Related

- `.claude/skills/project-discovery/SKILL.md` — runs the structural inventory this skill assumes exists
- `.claude/agents/spec-builder/agent.md` — for spec-level "what should this do" questions
- `.claude/agents/truth-finder/agent.md` — for verification of claims found during research
