---
hook: TeammateIdle
type: agent-teams-quality-gate
version: 1.0
trigger: teammate_no_output
timeout_seconds: 300
severity: WARNING
updated: 2026-03-31
---

# TeammateIdle Quality Gate Hook (UNI-1134)

Fires when an Agent Teams teammate has produced no output for >300 seconds.

## Trigger Condition

```
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
teammate.last_output_at < (now - 300s)
```

## Actions

1. **Log the idle event** to `data/sessions/{sessionId}/teammate-idle.json`
2. **Notify the Lead agent** via the Teams coordination channel
3. **Check if teammate is blocked** (waiting on tool call, rate limited, etc.)
4. **Decision tree**:
   - If blocked on tool call: extend timeout by 120s, continue
   - If rate limited: pause 30s, retry
   - If genuinely stuck (>600s total): abort teammate, Lead continues with partial data

## Implementation Script

```bash
#!/usr/bin/env bash
# .claude/memory/check-teammate-idle.sh
# Called by Agent Teams runtime when TeammateIdle fires

TEAMMATE_ID="${1:-unknown}"
SESSION_ID="${2:-unknown}"
IDLE_SECONDS="${3:-300}"
LOG_FILE="data/sessions/${SESSION_ID}/teammate-idle.json"

mkdir -p "$(dirname "$LOG_FILE")"

# Log the idle event
echo "{
  \"event\": \"TeammateIdle\",
  \"teammateId\": \"${TEAMMATE_ID}\",
  \"sessionId\": \"${SESSION_ID}\",
  \"idleSeconds\": ${IDLE_SECONDS},
  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"action\": \"$([ ${IDLE_SECONDS} -gt 600 ] && echo 'ABORT' || echo 'EXTEND')\"
}" >> "$LOG_FILE"

# Exit code determines Lead's action:
# 0 = continue waiting (extend timeout)
# 1 = abort this teammate (Lead degrades gracefully)

if [ "${IDLE_SECONDS}" -gt 600 ]; then
  echo "[TeammateIdle] Teammate ${TEAMMATE_ID} idle for ${IDLE_SECONDS}s — ABORTING"
  exit 1
else
  echo "[TeammateIdle] Teammate ${TEAMMATE_ID} idle for ${IDLE_SECONDS}s — extending timeout"
  exit 0
fi
```

## Lead Agent Response (when notified)

When TeammateIdle fires, the Lead agent:
1. Checks if the task is still completable without this teammate's output
2. If yes: marks teammate as `PARTIAL`, continues synthesis with available data
3. If no: gracefully degrades to single-agent mode for the remaining work
4. Logs the degradation in `debrief.json.teamateFailures[]`

## Integration Point

Register in `.claude/agents/orchestrator/CLAUDE.md` under `quality_gates`:
```yaml
quality_gates:
  - hook: TeammateIdle
    timeout: 300
    script: .claude/memory/check-teammate-idle.sh
```
