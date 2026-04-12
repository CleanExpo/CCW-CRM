# Runbook: Agent / CRON Failure Recovery

**Last updated**: 2026-03-31
**On-call contact**: Phill McGurk

## When to use this runbook

- CRON session fails mid-execution
- Agent stops responding or returns errors
- Circuit breaker opens for a service
- Session state shows "stale" for > 2 minutes

---

## 1. Detect the failure

```bash
# Check session state
ls -la .session-state/ 2>/dev/null

# Find stale sessions (> 2 min no heartbeat)
node -e "const {findStaleSessions}=require('./scripts/lib/session-manager'); console.log(JSON.stringify(findStaleSessions(),null,2))"

# Check circuit breaker status
node -e "const {getAllStatus}=require('./scripts/lib/circuit-breaker'); console.log(JSON.stringify(getAllStatus(),null,2))"

# Check recent errors in audit log
node -e "const {queryLogs,GOVERNANCE_LOG}=require('./scripts/lib/audit-logger'); console.log(JSON.stringify(queryLogs(GOVERNANCE_LOG,{since: new Date(Date.now()-3600000).toISOString()}),null,2))"
```

---

## 2. Common failure patterns

### Circuit breaker open (Supabase/API timeout)

```bash
# Wait for auto-reset (10 minutes) OR manually reset:
node -e "const {getBreaker}=require('./scripts/lib/circuit-breaker'); getBreaker('supabase').reset(); console.log('reset')"
```

### CRON session stale — resume from checkpoint

```bash
# Get last checkpoint from stale session
node -e "
  const {findStaleSessions,recoverSession}=require('./scripts/lib/session-manager');
  const stale = findStaleSessions();
  if (stale.length > 0) {
    const recovery = recoverSession(stale[0].id);
    console.log('Resuming from:', recovery.resumeFrom);
  }
"
```

### Missing Linear issue update

```bash
# Check if CRON completed but Linear wasn't updated
# Look in cron audit log for last session
cat logs/cron.jsonl 2>/dev/null | tail -20
```

---

## 3. Escalation

If above steps don't resolve:

1. Check Supabase dashboard for DB connectivity
2. Check Railway logs for FastAPI backend errors
3. Check Vercel deployment logs for frontend errors
4. Post in Slack #ccw-alerts with error details

---

## Related

- `scripts/lib/session-manager.js` — session lifecycle
- `scripts/lib/circuit-breaker.js` — API protection
- `scripts/lib/audit-logger.js` — structured logs
- `logs/` — raw log files (gitignored)
