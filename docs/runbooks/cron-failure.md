# Runbook: CRON Execution Failure

## Symptoms
- CRON session does not complete within expected window (6am/12pm/6pm/12am AEST)
- Session state shows `status: failed` or `status: running` with stale heartbeat
- No governance log entries for the expected session
- Linear issues not updated after expected CRON window

## Severity
**HIGH** — Boardroom intelligence delayed. Escalate if two consecutive sessions fail.

## First Response (< 5 minutes)
1. Check session state: `ls .session-state/` and inspect most recent JSON
2. Check logs: `tail -100 logs/cron.jsonl`
3. Check if process is still running (check for hanging Node processes)

## Diagnostic Steps

### Step 1: Identify Failure Phase
```bash
# Check last checkpoint in session state
cat .session-state/<session-id>.json | grep -E '"phase"|"status"|"error"'
```

### Step 2: Check External API Health
```bash
node -e "const { getAllStatus } = require('./scripts/lib/circuit-breaker'); console.log(JSON.stringify(getAllStatus(), null, 2))"
```
Open circuit breakers indicate which external services failed.

### Step 3: Check for Stale Sessions
```bash
node -e "const { findStaleSessions } = require('./scripts/lib/session-manager'); console.log(JSON.stringify(findStaleSessions(), null, 2))"
```

### Step 4: Check Security Log for Blocks
```bash
tail -50 logs/security.jsonl | node -e "const lines=[]; process.stdin.on('data',d=>lines.push(...d.toString().trim().split('\n'))); process.stdin.on('end',()=>lines.filter(Boolean).map(l=>JSON.parse(l)).forEach(e=>console.log(e.timestamp, e.event)))"
```

## Resolution Steps

### Option A: Recover Crashed Session
```javascript
const { recoverSession } = require('./scripts/lib/session-manager');
const session = recoverSession('<session-id>');
console.log('Resuming from:', session.resumeFrom);
// Re-trigger CRON from the resume phase
```

### Option B: Skip and Run Fresh Session
```bash
# Mark failed session and start new
node -e "const { failSession } = require('./scripts/lib/session-manager'); failSession('<id>', 'Manual skip by operator');"
# Trigger new CRON session manually
```

### Option C: Reset Open Circuit Breakers
```javascript
const { getBreaker } = require('./scripts/lib/circuit-breaker');
getBreaker('supabase').reset();
getBreaker('perplexity').reset();
// Re-run CRON
```

## Post-Mortem Template
- Date/Time of failure:
- Session ID:
- Phase failed at:
- Root cause:
- Services affected:
- Time to recover:
- Prevention action:
