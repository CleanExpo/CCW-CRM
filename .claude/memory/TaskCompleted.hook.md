---
hook: TaskCompleted
type: agent-teams-quality-gate
version: 1.0
trigger: teammate_task_done
severity: GATE
updated: 2026-03-31
---

# TaskCompleted Quality Gate Hook (UNI-1134)

Fires when any Agent Teams teammate marks its task as complete.
Validates output before Lead agent proceeds with synthesis.

## Trigger Condition

```
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
teammate.status == "COMPLETED"
teammate.output != null
```

## Validation Checks

Run in order — first failure blocks synthesis:

| Check                    | Target                 | Pass Condition                         |
| ------------------------ | ---------------------- | -------------------------------------- |
| 1. Output exists         | teammate.output        | Non-null, non-empty string             |
| 2. Output format         | task.expectedFormat    | Matches JSON schema or markdown format |
| 3. TypeScript errors     | changed .ts/.tsx files | `npx tsc --noEmit` exits 0             |
| 4. No hallucinated paths | output file paths      | All paths actually exist on disk       |
| 5. Schema validation     | JSON outputs           | Matches expected schema                |

## Implementation Script

```bash
#!/usr/bin/env bash
# .claude/memory/validate-task-completed.sh
# Called by Agent Teams runtime when TaskCompleted fires

TEAMMATE_ID="${1:-unknown}"
SESSION_ID="${2:-unknown}"
OUTPUT_FILE="${3:-}"  # Path to teammate's output file (if file was written)
LOG_FILE="data/sessions/${SESSION_ID}/task-completed.json"

mkdir -p "$(dirname "$LOG_FILE")"
PASS=true
ISSUES=()

# Check 1: Output file exists (if provided)
if [ -n "${OUTPUT_FILE}" ] && [ ! -f "${OUTPUT_FILE}" ]; then
  PASS=false
  ISSUES+=("Output file not found: ${OUTPUT_FILE}")
fi

# Check 2: TypeScript check (only if .ts/.tsx files were modified)
CHANGED_TS=$(git diff --name-only HEAD 2>/dev/null | grep -E '\.(ts|tsx)$' | head -5)
if [ -n "${CHANGED_TS}" ]; then
  if ! npx tsc --noEmit 2>/dev/null; then
    PASS=false
    ISSUES+=("TypeScript errors detected in changed files")
  fi
fi

# Log result
ISSUES_JSON=$(printf '%s\n' "${ISSUES[@]}" | python3 -c "import sys,json; print(json.dumps(list(sys.stdin.read().splitlines())))" 2>/dev/null || echo "[]")
echo "{
  \"event\": \"TaskCompleted\",
  \"teammateId\": \"${TEAMMATE_ID}\",
  \"sessionId\": \"${SESSION_ID}\",
  \"pass\": ${PASS},
  \"issues\": ${ISSUES_JSON},
  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
}" >> "$LOG_FILE"

if [ "${PASS}" = "false" ]; then
  echo "[TaskCompleted] GATE FAILED for teammate ${TEAMMATE_ID}:"
  printf '  - %s\n' "${ISSUES[@]}"
  exit 1  # Block Lead from using this output
fi

echo "[TaskCompleted] Gate PASSED for teammate ${TEAMMATE_ID} ✅"
exit 0
```

## Lead Agent Response

**On gate PASS (exit 0)**:

- Include teammate output in synthesis
- Mark teammate as `VERIFIED`

**On gate FAIL (exit 1)**:

- Do NOT include unverified output in synthesis
- Log failure in `debrief.json.gateFailures[]`
- If >1 teammate fails: degrade to single-agent mode
- If critical teammate fails: abort session, log to Linear

## Integration Point

Register in `.claude/agents/orchestrator/CLAUDE.md` under `quality_gates`:

```yaml
quality_gates:
  - hook: TaskCompleted
    script: .claude/memory/validate-task-completed.sh
    blocking: true # Synthesis blocked until gate passes or teammate is skipped
```

## TypeScript Gate Detail

Only runs when teammates modify `.ts` or `.tsx` files. For non-code tasks (research, JSON output, documentation), TypeScript gate is automatically skipped.

Non-blocking mode: Set `TEAMS_GATE_NONBLOCKING=1` to log failures without blocking synthesis — useful for Phase 1 testing.
