# Google API Security Checklist

**Status:** ✅ Implemented
**Last Updated:** 2026-01-27

---

## Pre-Deployment Checklist

Use this checklist before deploying to production to ensure your Google API key is secure.

### 1. Environment Configuration ✅

- [ ] **API key is set in environment variables only**
  - File: `.env` (development) or system environment (production)
  - Never hardcoded in source code
  - Never committed to Git

- [ ] **`.env` file is in `.gitignore`**
  ```bash
  # Verify:
  grep -r "\.env" .gitignore
  # Should show .env, .env.local, *.env, etc.
  ```

- [ ] **No API keys in version control**
  ```bash
  # Search for potential leaked keys:
  git log -p | grep -i "AIzaSy"
  # Should return nothing
  ```

### 2. Access Control ✅

- [ ] **API key has appropriate scopes**
  - Only enabled APIs that are actually used
  - Disabled unused Google Cloud APIs

- [ ] **Separate keys for different environments**
  - Development key (testing only)
  - Staging key (pre-production)
  - Production key (live system)

- [ ] **API key restrictions configured**
  - IP restrictions (if applicable)
  - HTTP referrer restrictions (for frontend)
  - API restrictions (limit to specific Google APIs)

### 3. Code Security ✅

- [ ] **All Google API calls use centralized client**
  ```python
  # ✅ CORRECT:
  from src.integrations.google import get_google_ai_client
  client = get_google_ai_client()

  # ❌ WRONG:
  import google.generativeai as genai
  genai.configure(api_key=os.getenv("GOOGLE_AI_API_KEY"))
  ```

- [ ] **No direct API key references in code**
  ```bash
  # Search for potential hardcoded keys:
  grep -r "AIzaSy" apps/backend/src/
  # Should only find references in client.py (secure configuration)
  ```

- [ ] **Error messages don't leak API key**
  - Exceptions don't print full configuration
  - Logs don't contain API keys

### 4. Monitoring & Logging ✅

- [ ] **Structured logging enabled**
  - All Google AI calls logged
  - No sensitive data (API keys) in logs

- [ ] **Usage monitoring configured**
  - Google Cloud Console dashboard set up
  - Alerts for unusual usage patterns
  - Budget alerts configured

- [ ] **Rate limiting implemented**
  - Per-user rate limits
  - Per-endpoint rate limits
  - Graceful degradation on quota exceeded

### 5. Production Hardening ✅

- [ ] **Secure cookies enabled in production**
  ```python
  # In settings.py:
  secure_cookies: bool = True  # For production
  ```

- [ ] **CORS properly configured**
  ```python
  # Only allow your domain:
  cors_origins=["https://your-domain.com"]
  ```

- [ ] **HTTPS enforced**
  - All API endpoints use HTTPS
  - No HTTP fallback

- [ ] **API authentication required**
  - Google AI endpoints require user authentication
  - No public access to AI features

### 6. Incident Response ✅

- [ ] **Key rotation procedure documented**
  - Steps to rotate API key
  - Zero-downtime rotation process

- [ ] **Security contact defined**
  - Email: security@ccw-erp.com
  - Phone: +61 XXX XXX XXX

- [ ] **Incident response plan ready**
  - What to do if key is leaked
  - How to revoke compromised key
  - Who to notify

---

## Deployment Steps

### Step 1: Verify Security

```bash
# Run security checks
cd apps/backend

# 1. Check no keys in code
grep -r "AIzaSy" src/ || echo "✅ No hardcoded keys"

# 2. Check .env is gitignored
git check-ignore .env && echo "✅ .env is ignored" || echo "❌ WARNING: .env not ignored!"

# 3. Check environment variable is set
python -c "from src.config.settings import get_settings; assert get_settings().google_ai_api_key, 'API key not set'" && echo "✅ API key configured"
```

### Step 2: Test Integration

```bash
# Test Google AI client
python -c "from src.integrations.google import get_google_ai_client; print('✅ Google AI client ready')"

# Optional: Test API call (if key is configured)
# python -c "import asyncio; from src.integrations.google import generate_text_with_google; print(asyncio.run(generate_text_with_google('Hello')))"
```

### Step 3: Deploy

```bash
# Set environment variable in production
export GOOGLE_AI_API_KEY="your-production-key-here"

# Or use secret management:
# AWS: aws secretsmanager get-secret-value --secret-id google-ai-key
# GCP: gcloud secrets versions access latest --secret="google-ai-key"
# Azure: az keyvault secret show --name google-ai-key --vault-name your-vault
```

### Step 4: Verify

```bash
# Health check endpoint
curl https://your-domain.com/api/google-ai/health

# Expected response:
# {"configured": true, "status": "ready", "default_model": "gemini-1.5-flash"}
```

---

## Security Monitoring

### Daily Checks

- [ ] Review API usage in Google Cloud Console
- [ ] Check for unusual spikes in requests
- [ ] Verify no quota warnings

### Weekly Checks

- [ ] Review error logs for authentication failures
- [ ] Check rate limit violations
- [ ] Audit user access patterns

### Monthly Checks

- [ ] Review and optimize API costs
- [ ] Update API key restrictions if needed
- [ ] Review security alerts

### Quarterly Checks

- [ ] **Rotate API keys** (every 90 days)
- [ ] Review and update security policies
- [ ] Conduct security audit

---

## Common Security Issues

### Issue: API Key Committed to Git

**Severity:** 🔴 CRITICAL

**Immediate Actions:**
1. Revoke the exposed key in Google Cloud Console
2. Generate a new API key
3. Update environment variables
4. Rotate key in all environments
5. Review Git history and remove key from all commits:
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   ```

### Issue: Key Visible in Logs

**Severity:** 🟡 MEDIUM

**Actions:**
1. Scrub logs to remove API key
2. Update logging configuration to filter sensitive data
3. Review log retention policies

### Issue: Unauthorized API Usage

**Severity:** 🔴 CRITICAL

**Actions:**
1. Check Google Cloud Console for unauthorized requests
2. Review access logs
3. Rotate API key immediately
4. Enable IP restrictions
5. Enable API restrictions

### Issue: Quota Exceeded

**Severity:** 🟢 LOW

**Actions:**
1. Check if legitimate or attack
2. Request quota increase if legitimate
3. Implement better rate limiting
4. Add caching to reduce API calls

---

## Key Rotation Procedure

### Step 1: Generate New Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy the new key

### Step 2: Update Staging

```bash
# Update staging environment
export GOOGLE_AI_API_KEY="new-key-here"

# Restart application
docker-compose restart backend
```

### Step 3: Verify Staging

```bash
curl https://staging.your-domain.com/api/google-ai/health
# Should return: {"configured": true, "status": "ready"}
```

### Step 4: Update Production

```bash
# Update production environment (zero-downtime)
kubectl set env deployment/backend GOOGLE_AI_API_KEY="new-key-here"

# Or with secret management:
# aws secretsmanager update-secret --secret-id google-ai-key --secret-string "new-key"
```

### Step 5: Revoke Old Key

1. Wait 24 hours to ensure no active requests using old key
2. Go to Google Cloud Console
3. Delete the old API key
4. Verify new key is working in all environments

---

## Emergency Contacts

**Security Team:**
- Email: security@ccw-erp.com
- Phone: +61 XXX XXX XXX (24/7)

**Google Cloud Support:**
- Console: https://console.cloud.google.com/support
- Phone: Based on support plan

---

## Audit Log

| Date | Action | Performed By | Notes |
|------|--------|--------------|-------|
| 2026-01-27 | Initial setup | DevOps Team | Google AI integration implemented |
| YYYY-MM-DD | Key rotation | | |
| YYYY-MM-DD | Security audit | | |

---

## Compliance

### GDPR Compliance

- [ ] Data processing agreement with Google signed
- [ ] Privacy policy updated to mention Google AI usage
- [ ] User consent obtained for AI features

### SOC 2 Compliance

- [ ] Access controls documented
- [ ] Audit logging enabled
- [ ] Incident response plan documented

### ISO 27001 Compliance

- [ ] Information security policy includes API key management
- [ ] Risk assessment includes third-party API risks
- [ ] Regular security audits scheduled

---

**Checklist Version:** 1.0
**Next Review:** 2026-04-27
