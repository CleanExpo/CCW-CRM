# Claude Code Agent Teams — Architecture Plan (UNI-1137)

**Status**: EXPERIMENTAL | **Version**: 1.0 | **Updated**: 2026-03-31
**Enable**: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
**Docs**: https://code.claude.com/docs/en/agent-teams

---

## What Agent Teams Is

Agent Teams is an experimental Claude Code feature where a **Lead agent** breaks work into 3-5 subtasks and dispatches each to a **Teammate agent** that runs in its **own isolated context window**.

Key difference from Superpowers subagents:

| Feature | Superpowers Subagents | Agent Teams |
|---|---|---|
| Context window | Shared 200k tokens | 200k per teammate |
| Execution | Sequential or simulated parallel | True parallel |
| Coordination | Via Tool calls in same context | Lead ↔ Teammate API |
| Use case | Linear task chains | Truly parallel, independent work |
| Token bottleneck | Yes — shared pool depletes | No — each teammate has full budget |

---

## How It Works

```
Lead Agent (Orchestrator)
    │
    ├── Task spec → Teammate A (context: 200k)  ─── runs in parallel ──┐
    ├── Task spec → Teammate B (context: 200k)  ─── runs in parallel ──┤
    ├── Task spec → Teammate C (context: 200k)  ─── runs in parallel ──┤
    └── Task spec → Teammate D (context: 200k)  ─── runs in parallel ──┘
                                                                         │
                                          Lead synthesises all outputs ←─┘
```

---

## Unite-Group Use Cases

### 1. CCW Boardroom Parallel Deliberation
- **Lead**: Orchestrator agent (OPUS)
- **Teammates**:
  - Teammate A: Architect + Product Oracle (SONNET)
  - Teammate B: Revenue Guardian + Security Sentinel (SONNET)
  - Teammate C: Data Sovereign + Agent Whisperer (SONNET)
  - Teammate D: Video Director + Moon Shooter (SONNET)
- **Benefit**: Session time drops from ~45min to ~12min (4x parallel)

### 2. Multi-Repo Documentation Sync
- **Lead**: Scout agent
- **Teammates**: One per repo (CCW, CARSI, RestoreAssist, G-Pilot, Bron)
- **Benefit**: Sync all 5 repos in the time it takes to sync 1

### 3. Parallel Security Audit
- **Lead**: Security Sentinel (CSO role)
- **Teammates**:
  - Teammate A: OWASP Top 10 pattern scanner
  - Teammate B: Dependency vulnerability checker
  - Teammate C: Secrets archaeology
  - Teammate D: Privacy Act compliance checker
- **Benefit**: Full security audit in ~3min instead of ~12min

---

## Configuration

### Enable Agent Teams
```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

### Agent Configs
Each agent must have its own `.claude/agents/{name}/CLAUDE.md` defining:
- Role and capabilities
- Available tools
- Output format expected by Lead

### Existing Agent Configs (already have structure)
```
.claude/agents/
├── orchestrator/           # Lead agent
├── architect-agent.md      # Technical architect
├── builder-agent.md        # Implementation
├── validator-agent.md      # Quality gate
├── ceo-board-member.md    # Strategy
├── cto-board-member.md    # Technical
├── cso-board-member.md    # Security
├── cmo-board-member.md    # Marketing
├── cfo-board-member.md    # Finance
└── coo-board-member.md    # Operations
```

---

## Quality Gates

### TeammateIdle Hook
- Trigger: Teammate has no output for >300 seconds
- Action: Log idle, notify Lead, optionally restart
- File: `.claude/memory/TeammateIdle.hook.md`

### TaskCompleted Hook
- Trigger: Teammate marks task done
- Action: Validate output (type-check, schema, tests)
- File: `.claude/memory/TaskCompleted.hook.md`

---

## Implementation Phases

| Phase | Target | Action |
|---|---|---|
| 1 (now) | Enable + test | Enable flag, test with 2 teammates (security audit split) |
| 2 (Apr 2026) | Boardroom parallel | Split board deliberation across 4 teammates |
| 3 (May 2026) | All 7 projects | Multi-repo doc sync, per-project audits |

---

## Limitations (EXPERIMENTAL)

- Max teammates: 5 per Lead
- Teammates cannot spawn their own teammates (1 level deep only)
- No shared memory between teammates (Lead must synthesise)
- May not be available in all Claude Code versions
- Performance varies — monitor with `TaskCompleted` hook
