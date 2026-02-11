# Sentry Error Tracking Configuration Guide

This document provides step-by-step instructions for configuring Sentry DSN to enable error tracking in CCW-ERP.

## Overview

Sentry is integrated into both the backend (FastAPI) and frontend (Next.js) for:
- Real-time error tracking and alerting
- Performance monitoring (traces)
- Release tracking
- User context tracking
- Session replay (frontend only)

## Quick Start

### 1. Get Your Sentry DSN

1. **Create a Sentry Account** (if you don't have one):
   - Go to [https://sentry.io/signup/](https://sentry.io/signup/)
   - Sign up for a free account (5,000 errors/month free)

2. **Create a Project**:
   - Backend: Create a "Python" project (select "FastAPI" as framework)
   - Frontend: Create a "Next.js" project

3. **Get the DSN**:
   - Go to **Settings** > **Projects** > **[Your Project]** > **Client Keys (DSN)**
   - Copy the DSN (looks like: `https://abc123@o123456.ingest.sentry.io/789012`)

### 2. Configure Environment Variables

#### Backend Configuration

Create or update `.env` in `apps/backend/`:

```bash
# Sentry Error Tracking
SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/your-project-id
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% of transactions for performance monitoring
SENTRY_PROFILES_SAMPLE_RATE=0.1  # 10% for profiling
SENTRY_RELEASE=ccw-erp@1.0.0  # Or use git SHA: $(git rev-parse HEAD)
```

#### Frontend Configuration

Create or update `.env.local` in `apps/web/`:

```bash
# Sentry Error Tracking
NEXT_PUBLIC_SENTRY_DSN=https://your-frontend-key@o123456.ingest.sentry.io/your-frontend-project-id
SENTRY_DSN=https://your-frontend-key@o123456.ingest.sentry.io/your-frontend-project-id
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_RELEASE=ccw-erp@1.0.0
```

#### Docker Compose (Development)

The `docker-compose.yml` is already configured to read Sentry variables. Just set them in your shell or `.env` file:

```bash
# Create .env in project root
SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/your-project-id
SENTRY_TRACES_SAMPLE_RATE=1.0  # 100% in development
SENTRY_PROFILES_SAMPLE_RATE=1.0
SENTRY_RELEASE=development
```

### 3. Verify Configuration

#### Backend Verification

Restart the backend and check logs:

```bash
# Docker
docker restart nodejs-starter-backend
docker logs nodejs-starter-backend 2>&1 | grep -i sentry

# Expected output (with DSN):
# ✅ Sentry initialized (environment: development, traces: 1.0)

# Expected output (without DSN):
# ⚠️  Sentry DSN not configured, skipping initialization
```

#### Frontend Verification

Build the frontend and check for Sentry initialization:

```bash
cd apps/web
pnpm build
```

Check browser console for Sentry initialization messages.

## Environment-Specific Configuration

### Development (Local)

```bash
# High sample rates for debugging
SENTRY_DSN=https://...
SENTRY_TRACES_SAMPLE_RATE=1.0    # 100% - capture all transactions
SENTRY_PROFILES_SAMPLE_RATE=1.0  # 100% - capture all profiles
SENTRY_RELEASE=development-local
ENVIRONMENT=development
```

### Staging

```bash
# Moderate sample rates for testing
SENTRY_DSN=https://...
SENTRY_TRACES_SAMPLE_RATE=0.5    # 50% - good balance for staging
SENTRY_PROFILES_SAMPLE_RATE=0.5
SENTRY_RELEASE=$(git rev-parse HEAD)
ENVIRONMENT=staging
```

### Production

```bash
# Lower sample rates to reduce costs
SENTRY_DSN=https://...
SENTRY_TRACES_SAMPLE_RATE=0.1    # 10% - sufficient for production
SENTRY_PROFILES_SAMPLE_RATE=0.1
SENTRY_RELEASE=$(git rev-parse HEAD)
ENVIRONMENT=production
```

## Testing Error Tracking

### Backend Test

Trigger a test error to verify Sentry is working:

```bash
# Create a test endpoint (if not exists) or trigger an error manually
curl -X POST http://localhost:8000/api/health -H "Content-Type: application/json" -d '{"test": "invalid"}'
```

Or add a test error endpoint:

```python
# In apps/backend/src/api/routes/health.py
@router.get("/api/test-sentry")
async def test_sentry():
    """Test Sentry error tracking (development only)."""
    import sentry_sdk
    try:
        raise ValueError("Test Sentry error - ignore this!")
    except Exception as e:
        sentry_sdk.capture_exception(e)
        return {"status": "error sent to Sentry"}
```

### Frontend Test

Open browser console and run:

```javascript
throw new Error("Test Sentry frontend error");
```

Check Sentry dashboard for the error within 1-2 minutes.

## Source Maps Upload (Production)

For readable stack traces in production, upload source maps:

### 1. Create Sentry Auth Token

1. Go to [https://sentry.io/settings/account/api/auth-tokens/](https://sentry.io/settings/account/api/auth-tokens/)
2. Create a new token with `project:releases` scope
3. Add to environment:

```bash
SENTRY_AUTH_TOKEN=sntrys_your_auth_token_here
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
```

### 2. Configure Build

The `apps/web/next.config.ts` is already configured for source map upload. Ensure these environment variables are set during build:

```bash
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=ccw-erp
SENTRY_PROJECT=ccw-erp-frontend
```

## Alert Configuration

Configure alerts in Sentry dashboard:

### Recommended Alert Rules

1. **Error Spike Detection**
   - Condition: Error count increases by 100% in 5 minutes
   - Action: Send email + Slack notification

2. **New Error Type**
   - Condition: First occurrence of error type
   - Action: Send email to dev team

3. **High Error Rate**
   - Condition: Error rate > 5% for 10 minutes
   - Action: Send PagerDuty alert (production)

### Integration with AlertManager

Sentry can forward alerts to Prometheus AlertManager via webhook:

1. In Sentry: **Settings** > **Integrations** > **Webhooks**
2. Add AlertManager webhook URL
3. Configure alert rules to trigger webhook

## Security Considerations

1. **Never commit DSN to git** - Use environment variables or secrets management
2. **Use different DSNs** for development, staging, and production
3. **PII handling** - Review Sentry's data scrubbing settings
4. **Rate limiting** - Configure sample rates appropriately for costs

## Troubleshooting

### Sentry Not Initializing

1. Check DSN format: `https://key@org.ingest.sentry.io/project`
2. Verify environment variable is set: `echo $SENTRY_DSN`
3. Check network connectivity to Sentry servers

### Errors Not Appearing

1. Wait 1-2 minutes (Sentry batches events)
2. Check Sentry dashboard filters (environment, release)
3. Verify sample rate is not 0

### Source Maps Not Working

1. Verify `SENTRY_AUTH_TOKEN` is set during build
2. Check build logs for source map upload
3. Ensure release versions match

## Cost Management

Sentry pricing tiers (as of 2026):
- **Developer**: Free, 5,000 errors/month
- **Team**: $26/month, 50,000 errors/month
- **Business**: $80/month, 100,000 errors/month

Tips to reduce costs:
- Use appropriate sample rates (0.1 for production)
- Filter out known errors (browser extensions, etc.)
- Use error grouping to reduce noise

## Files Reference

| File | Purpose |
|------|---------|
| `apps/backend/src/integrations/sentry_client.py` | Backend Sentry initialization |
| `apps/backend/src/config/settings.py` | Backend settings (includes Sentry) |
| `apps/web/sentry.client.config.ts` | Frontend client-side config |
| `apps/web/sentry.server.config.ts` | Frontend server-side config |
| `apps/web/sentry.edge.config.ts` | Frontend edge runtime config |
| `apps/web/instrumentation.ts` | Next.js instrumentation hook |
| `apps/web/next.config.ts` | Next.js config with Sentry wrapper |

## Related Issues

- ISS-021: Sentry Integration (code complete)
- ISS-040: Configure Sentry DSN (this guide)
- ISS-019: Prometheus Monitoring
- ISS-020: Alert Rules

---

*Last updated: February 12, 2026*
*Status: Ready for configuration*
