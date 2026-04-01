# Runbook: Session Recovery

## Symptoms
- CRON session stuck in `running` state with stale heartbeat
- Session state file exists but process is not running
- Session failed mid-phase and needs to resume
- Multiple stale sessions blocking new CRON runs

## Severity
**HIGH** — Data may be incomplete. CRON cannot start new session while stale session exists.

## First Response (< 5 minutes)
1. Identify stale sessions
2. Check if any partial data was written to Supabase
3. Determine whether to recover or skip

## Diagnostic Steps

### Step 1: Find Stale Sessions
```javascript
const { findStaleSessions, listSessions } = require('./scripts/lib/session-manager');
console.log('Stale:', JSON.stringify(findStaleSessions(), null, 2));
console.log('All running:', JSON.stringify(listSessions('running'), null, 2));
```

### Step 2: Inspect Session State
```bash
# View the session file
cat .session-state/<session-id>.json
# Key fields: status, phase, checkpoints, heartbeatAt, startedAt
```

### Step 3: Check What Phase Failed
```bash
# Review cron log for this session
grep "<session-id>" logs/cron.jsonl | tail -20
```

### Step 4: Check for Partial Data
```bash
# Check Supabase for partial writes from this session
node -e "
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
db.from('boardroom_sessions').select('*').eq('session_id', '<id>').then(({data}) => console.log(data));
"
```

## Resolution Steps

### Option A: Resume from Checkpoint
```javascript
const { recoverSession } = require('./scripts/lib/session-manager');
const session = recoverSession('<session-id>');
console.log('Resume from:', session.resumeFrom);
// Re-trigger CRON — it will pick up from this checkpoint
```
Use when: Session has valid checkpoints and failure was transient (network, timeout).

### Option B: Skip Failed Session
```javascript
const { failSession } = require('./scripts/lib/session-manager');
failSession('<session-id>', 'Manual skip: [reason]');
// CRON can now start a fresh session
```
Use when: Session data is corrupt, or too much time has passed (>24h).

### Option C: Clear All Stale Sessions
```javascript
const { findStaleSessions, failSession } = require('./scripts/lib/session-manager');
const stale = findStaleSessions();
stale.forEach(s => {
  failSession(s.id, 'Cleared by operator during recovery');
  console.log('Cleared:', s.id);
});
```
Use when: Multiple stale sessions are blocking CRON.

### Option D: Manual State File Cleanup
```bash
# Last resort — directly update state file
# DO NOT do this unless the session-manager functions fail
node -e "
const fs = require('fs');
const path = '.session-state/<session-id>.json';
const state = JSON.parse(fs.readFileSync(path, 'utf8'));
state.status = 'failed';
state.error = 'Manual recovery by operator';
state.completedAt = new Date().toISOString();
fs.writeFileSync(path, JSON.stringify(state, null, 2));
"
```

## Verification
```javascript
const { listSessions } = require('./scripts/lib/session-manager');
console.log('Running sessions:', listSessions('running').length); // Should be 0
// Trigger a new CRON session to confirm recovery
```

## Post-Mortem Template
- Session ID:
- Failure phase:
- Recovery method used:
- Data gaps (if any):
- Time from failure to recovery:
- Root cause:
- Prevention action:
