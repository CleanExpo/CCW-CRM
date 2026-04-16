# Runbook: Security Incident Response

## Symptoms

- Credential/secret detected in codebase or logs
- Unauthorised data access detected in audit logs
- RLS policy bypass discovered
- Unusual API usage patterns
- User data deletion request with suspected breach

## Severity Levels

- **CRITICAL**: Credential exposure, RLS bypass, payment data access
- **HIGH**: Potential injection attack, suspicious automation activity
- **MEDIUM**: Policy violation, unexpected data access pattern

## First Response (< 2 minutes for CRITICAL)

### For CRITICAL incidents:

1. Post to #ccw-security Slack: "SECURITY INCIDENT — [brief description] — investigating"
2. Do NOT attempt to fix before understanding the scope
3. Alert CTO and CEO immediately

## Diagnostic Steps

### Step 1: Review Security Audit Log

```bash
tail -200 logs/security.jsonl | grep -i "CRITICAL\|HIGH"
```

### Step 2: Check for Secret Exposure

```bash
node scripts/ci/scan-secrets.js 2>&1 | head -50
```

### Step 3: Review Governance Log for Anomalies

```bash
node -e "
const { queryLogs, GOVERNANCE_LOG } = require('./scripts/lib/audit-logger');
const logs = queryLogs(GOVERNANCE_LOG, { since: new Date(Date.now()-3600000).toISOString(), riskLevel: 'HIGH' });
console.log(JSON.stringify(logs, null, 2));
"
```

### Step 4: Check Approval Gate for Unauthorised Operations

```bash
ls .approvals/ | head -20
# Check for any approved operations that should not have been
```

## Resolution Steps

### Credential Rotation (CRITICAL)

1. Immediately revoke compromised credentials in provider dashboard
2. Generate new credentials
3. Update environment variables in Railway/Vercel
4. Verify no active sessions using old credentials
5. Audit all operations performed with compromised credential

### RLS Policy Fix

1. Identify affected table and policy
2. Create hotfix branch: `hotfix/UNI-XXXX-rls-emergency`
3. Write corrected RLS policy
4. Test with both user and service_role contexts
5. Apply via Supabase MCP (requires CEO approval for production)
6. Verify fix via penetration test scenario

### Data Breach Response (AU Privacy Act)

1. Assess scope: which users affected, what data exposed
2. Document in incident log
3. Contact CLO within 1 hour
4. Notify affected users within 72 hours (AU Privacy Act requirement)
5. Notify OAIC if >$3M turnover threshold met

## Post-Mortem Template

- Incident ID:
- Discovery time:
- Containment time:
- Root cause:
- Data/users affected:
- AU Privacy Act obligations triggered: Yes/No
- Prevention actions:
- Detection improvements:
