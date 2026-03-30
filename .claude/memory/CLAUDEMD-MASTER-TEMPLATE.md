# CLAUDE.md Master Template (UNI-1138)

**Standard**: v1.0 | **Updated**: 2026-03-31 | **Audited**: fortnightly by Scout CRON

Use this template when creating a CLAUDE.md for any new Unite-Group project.
Replace `{{ }}` tokens with project-specific values.
Maximum length: 400 lines. Minimum: 150 lines.

---

```markdown
---
project: {{ PROJECT_NAME }}
business: {{ BUSINESS_NAME }}
version: 1.0
updated: {{ DATE }}
author: Phill McGurk (CEO)
ai_tooling: Superpowers 14 + gstack 29
---

## PRIME DIRECTIVE

You are enhancing {{ PROJECT_NAME }} — {{ ONE_SENTENCE_DESCRIPTION }}.

1. Follow instructions exactly
2. Never deviate from the plan
3. Preserve existing functionality
4. Ask when unclear — never assume

**Re-read this file at: session start, every 5 messages, when confused.**

---

## 🚫 ABSOLUTE PROHIBITIONS

| Forbidden | Why | Exception |
|---|---|---|
| Modifying {{ LOCKED_FILE_1 }} | {{ REASON }} | NEVER |
| Modifying {{ LOCKED_FILE_2 }} | {{ REASON }} | NEVER |
| Installing unlisted packages | Dependency hell | Ask first |
| Coding without a plan | Wasted effort | NEVER |
| Assuming user intent | Wrong direction | Always ASK |

---

## ✅ MANDATORY SESSION SEQUENCE (18 steps)

1. ☐ Read `.claude/STARTUP.md`
2. ☐ Read this file
3. ☐ Read `.claude/memory/current-state.md`
4. ☐ Check `docs/catalogs/` before adding routes/pages/models
5. ☐ Understand the task
6. ☐ Run `/plan` before coding
7. ☐ Get explicit approval for the plan
8. ☐ Apply Superpowers skill if applicable
9. ☐ Run gstack `/cto` for technical decisions
10. ☐ Run gstack `/cso` for security changes
11. ☐ Implement exactly as planned
12. ☐ Run `/sync-vault` after adding routes/pages/models
13. ☐ Run type-check — fix ALL errors
14. ☐ Run tests — ALL must pass
15. ☐ Run gstack `/qa` after sprint
16. ☐ Run gstack `/retro` post-sprint
17. ☐ Report changes (standard format below)
18. ☐ Update `.claude/memory/current-state.md`

---

## 🛠 TECH STACK (LOCKED)

**Frontend**: {{ FRONTEND_FRAMEWORK }} | {{ LANGUAGE }} | {{ UI_LIBRARY }}
**Backend**: {{ BACKEND_FRAMEWORK }} | {{ ORM }} | {{ DATABASE }}
**Deployment**: {{ FRONTEND_DEPLOY }} + {{ BACKEND_DEPLOY }}
**Package Manager**: {{ PACKAGE_MANAGER }}
**AI Tooling**: Superpowers (14 skills) + gstack (29 commands, Bun v1.3.11)

Do NOT upgrade major versions without explicit approval.

---

## 📁 KEY PATHS

```
{{ REPO_ROOT }}/
├── {{ FRONTEND_PATH }}/    # {{ FRONTEND_DESCRIPTION }}
├── {{ BACKEND_PATH }}/     # {{ BACKEND_DESCRIPTION }}
├── .claude/                # Framework (READ ONLY)
│   ├── agents/             # Board member + specialist agents
│   ├── memory/             # State files (CONSTITUTION, current-state, etc.)
│   └── skills/             # Superpowers + gstack
├── docs/                   # Documentation
└── scripts/                # Utility scripts
```

---

## 🤖 BOARD MEMBER → SKILL BINDINGS

| Member | gstack | Superpowers |
|---|---|---|
| CEO | `/ceo` | `writing-plans` + `brainstorming` |
| CTO | `/cto` | `subagent-driven-development` + `test-driven-development` |
| CSO | `/cso` | `systematic-debugging` + `verification-before-completion` |
| CMO | `/cmo` | `brainstorming` + `writing-skills` |
| CFO | `/cfo` | `executing-plans` + `finishing-a-development-branch` |
| COO | `/coo` | `dispatching-parallel-agents` + `using-git-worktrees` |

---

## 📋 COMMAND REFERENCE

| Command | When |
|---|---|
| `/plan` | Before any coding |
| `/test` | Before marking done |
| `/status` | When asked or stuck |
| `/reset` | When confused |
| `/sync-vault` | After adding routes/pages/models |
| `/health-check-10x` | After each sprint |

---

## 📊 PROGRESS REPORT FORMAT

After each task:
```
## ✅ Task Complete
**What was done:** [list]
**Files changed:** [list with (created/modified)]
**Tests:** ✅ Passing | ❌ Failing: [reason]
**Next steps:** [if any]
```

---

## 🔒 IMMUTABLE RULES

1. Never modify {{ LOCKED_FILE_1 }} or {{ LOCKED_FILE_2 }}
2. Never break existing API contracts
3. Never code without a plan
4. Never assume — ask
5. Always test before "done"
6. Always report changes
7. This file is reviewed fortnightly (Scout CRON audit)
```

---

## Template Governance

- **Owned by**: The Architect (board member)
- **Audit frequency**: Fortnightly via `scripts/boardroom/claudemd-audit.js`
- **Breaking changes**: Require CEO approval (Phill McGurk)
- **Inventory**: See `CLAUDEMD-GOVERNANCE.md`
