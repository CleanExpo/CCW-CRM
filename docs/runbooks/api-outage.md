# Runbook: External API Outage

## Symptoms
- Circuit breaker OPEN for one or more external services
- CRON session failing at data fetch phase
- 503/504 errors in logs for Xero, Cin7, Shopify, SendGrid, etc.
- Perplexity/Anthropic/OpenAI API errors during boardroom analysis

## Severity
**HIGH** for single service. **CRITICAL** if Supabase or Anthropic is down.

## First Response (< 5 minutes)
1. Check circuit breaker status for all services
2. Identify whether outage is provider-side or credential issue
3. Alert CTO if Supabase or primary AI provider is down

## Diagnostic Steps

### Step 1: Check Circuit Breaker Status
```javascript
const { getAllStatus, getOpenBreakers } = require('./scripts/lib/circuit-breaker');
console.log(JSON.stringify(getAllStatus(), null, 2));
console.log('Open breakers:', getOpenBreakers());
```

### Step 2: Check Provider Status Pages
- Supabase: https://status.supabase.com
- Anthropic: https://status.anthropic.com
- Xero: https://status.xero.com
- Shopify: https://www.shopifystatus.com

### Step 3: Test Connectivity
```bash
curl -s https://api.supabase.io/health
curl -s https://api.anthropic.com/health
```

### Step 4: Check Credentials
```bash
# Verify env vars are set (do not log values)
node -e "['SUPABASE_URL','ANTHROPIC_API_KEY','XERO_CLIENT_ID'].forEach(k => console.log(k, !!process.env[k]))"
```

## Resolution Steps

### Option A: Wait for Provider Recovery
1. Monitor provider status page
2. Circuit breaker will auto-recover when HALF_OPEN test passes
3. CRON will resume from last checkpoint on next scheduled run

### Option B: Manual Circuit Breaker Reset
```javascript
const { getBreaker } = require('./scripts/lib/circuit-breaker');
// Only reset after confirming provider is healthy
getBreaker('xero').reset();
getBreaker('perplexity').reset();
```

### Option C: Skip Unavailable Service
```javascript
const { createSession, checkpoint } = require('./scripts/lib/session-manager');
// Manually advance session past the failing phase
checkpoint(sessionId, 'xero-sync', { status: 'skipped', reason: 'provider-outage' });
```

### Option D: Rotate Credentials
1. Generate new API key in provider dashboard
2. Update Railway/Vercel environment variables
3. Redeploy if necessary
4. Reset circuit breaker after confirming new credentials work

## Post-Mortem Template
- Affected service(s):
- Outage start time:
- Recovery time:
- CRON sessions impacted:
- Data gaps created:
- Credential rotation required: Yes/No
- Prevention actions:
