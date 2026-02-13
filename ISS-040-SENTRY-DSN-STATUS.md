# ISS-040: Configure Sentry DSN - COMPLETE

**Date**: February 12, 2026
**Status**: COMPLETE
**Priority**: High
**Depends On**: ISS-021 (Sentry Integration)

---

## Summary

ISS-040 completes the Sentry error tracking configuration by:
1. Adding Sentry settings to the backend Settings class for cleaner configuration
2. Updating docker-compose.yml to pass Sentry environment variables
3. Creating comprehensive documentation for DSN setup
4. Updating environment example files with detailed Sentry configuration

## Changes Made

### 1. Backend Settings (`apps/backend/src/config/settings.py`)

Added Sentry configuration fields to the Settings class:

```python
# Sentry Error Tracking
sentry_dsn: str = Field(
    default="",
    description="Sentry DSN for error tracking (get from https://sentry.io/settings/[org]/projects/[project]/keys/)",
)
sentry_traces_sample_rate: float = Field(
    default=0.1,
    ge=0.0,
    le=1.0,
    description="Sentry performance traces sample rate (0.0-1.0, 0.1 = 10%)",
)
sentry_profiles_sample_rate: float = Field(
    default=0.1,
    ge=0.0,
    le=1.0,
    description="Sentry profiling sample rate (0.0-1.0, 0.1 = 10%)",
)
sentry_release: str = Field(
    default="",
    description="Sentry release identifier (defaults to ccw-erp@1.0.0 if not set)",
)
```

### 2. Sentry Client (`apps/backend/src/integrations/sentry_client.py`)

Updated to use settings instead of direct environment variables:
- Now reads configuration from `settings.sentry_dsn`, `settings.sentry_traces_sample_rate`, etc.
- Falls back to environment variables for backward compatibility
- Improved logging messages (removed Unicode emojis for Windows compatibility)
- Added helpful instructions when DSN is not configured

### 3. Docker Compose (`docker-compose.yml`)

Added Sentry environment variables to the backend service:

```yaml
# Sentry Error Tracking (optional in development)
SENTRY_DSN: ${SENTRY_DSN:-}
SENTRY_TRACES_SAMPLE_RATE: ${SENTRY_TRACES_SAMPLE_RATE:-1.0}
SENTRY_PROFILES_SAMPLE_RATE: ${SENTRY_PROFILES_SAMPLE_RATE:-1.0}
SENTRY_RELEASE: ${SENTRY_RELEASE:-development}
```

### 4. Environment Example (`.env.production.example`)

Updated with comprehensive Sentry configuration:

```bash
# Sentry Error Tracking
SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/your-project-id
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
SENTRY_RELEASE=ccw-erp@1.0.0

# Sentry Auth Token (for source maps upload during build)
SENTRY_AUTH_TOKEN=sntrys_your_auth_token_here
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=ccw-erp-backend

# Frontend Sentry
NEXT_PUBLIC_SENTRY_DSN=https://your-frontend-key@o123456.ingest.sentry.io/your-frontend-project-id
```

### 5. Documentation (`docs/SENTRY-CONFIGURATION.md`)

Created comprehensive guide covering:
- Quick start guide for getting DSN
- Environment-specific configuration (development, staging, production)
- Testing error tracking
- Source maps upload for production
- Alert configuration
- Security considerations
- Troubleshooting guide

## Files Modified

| File | Change |
|------|--------|
| `apps/backend/src/config/settings.py` | Added Sentry configuration fields |
| `apps/backend/src/integrations/sentry_client.py` | Updated to use settings, improved logging |
| `docker-compose.yml` | Added Sentry environment variables |
| `.env.production.example` | Added comprehensive Sentry config |
| `docs/SENTRY-CONFIGURATION.md` | NEW - Complete setup guide |
| `ISS-040-SENTRY-DSN-STATUS.md` | NEW - This status file |

## Verification

### Settings Import Test

```bash
cd apps/backend
uv run python -c "from src.config.settings import Settings; s = Settings(); print(s.sentry_dsn, s.sentry_traces_sample_rate)"
# Output: '' 0.1 (defaults when not configured)
```

### Sentry Initialization Test (without DSN)

```bash
cd apps/backend
uv run python -c "from src.integrations.sentry_client import initialize_sentry; initialize_sentry()"
# Output: [WARNING] Sentry DSN not configured, skipping initialization
```

### Sentry Initialization Test (with DSN)

```bash
cd apps/backend
uv run python -c "import os; os.environ['SENTRY_DSN'] = 'https://testkey@o123456.ingest.sentry.io/789012'; from src.integrations.sentry_client import initialize_sentry; initialize_sentry()"
# Output: [OK] Sentry initialized (environment: development, traces: 0.1)
```

## How to Enable Error Tracking

### 1. Get Sentry DSN

1. Go to [https://sentry.io/signup/](https://sentry.io/signup/) and create an account
2. Create a Python/FastAPI project for backend
3. Create a Next.js project for frontend
4. Copy the DSN values from project settings

### 2. Configure Backend

```bash
# In apps/backend/.env or via environment
SENTRY_DSN=https://your-key@o123456.ingest.sentry.io/your-project-id
```

### 3. Configure Frontend

```bash
# In apps/web/.env.local
NEXT_PUBLIC_SENTRY_DSN=https://your-frontend-key@o123456.ingest.sentry.io/your-frontend-project-id
SENTRY_DSN=https://your-frontend-key@o123456.ingest.sentry.io/your-frontend-project-id
```

### 4. Restart Services

```bash
docker compose down && docker compose up -d
```

### 5. Verify in Sentry Dashboard

Check the Sentry dashboard for incoming events.

## Next Steps

1. **Obtain Real DSN**: Create Sentry account and projects
2. **Configure Production**: Set DSN in production environment (Railway, Vercel, etc.)
3. **Configure Alerts**: Set up error rate alerts in Sentry
4. **Source Maps**: Configure SENTRY_AUTH_TOKEN for readable stack traces

## Related Issues

- ISS-021: Sentry Integration (code) - COMPLETE
- ISS-040: Configure Sentry DSN - COMPLETE
- ISS-019: Prometheus Monitoring - COMPLETE
- ISS-020: Alert Rules - COMPLETE
- ISS-039: Grafana Dashboards - COMPLETE

---

*Completed: February 12, 2026*
*Week 2, Day 6 - Production Readiness Sprint*
