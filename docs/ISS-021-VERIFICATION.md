# ISS-021 VERIFICATION — Integrate Sentry Error Tracking

**Status**: ⏳ PENDING IMPLEMENTATION
**Date**: February 2, 2026
**Related Issues**: ISS-020 (Alert Rules), ISS-022 (Uptime Monitoring), ISS-023 (Operations Dashboards)
**Related Documents**: [Sentry Documentation](https://docs.sentry.io/), [Sentry Python SDK](https://docs.sentry.io/platforms/python/), [Sentry Next.js SDK](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

---

## Implementation Summary

ISS-021 validates comprehensive Sentry error tracking integration for production monitoring with real-time error capture, release tracking, source maps, performance monitoring, and alert integration with Prometheus/AlertManager. The system provides automatic error capture, user context tracking, breadcrumbs, and performance tracing for both backend (FastAPI) and frontend (Next.js) applications.

**Error Tracking Stack:**
- **Backend SDK**: sentry-sdk[fastapi] for Python 3.12
- **Frontend SDK**: @sentry/nextjs for Next.js 15
- **Release Tracking**: Git commit SHA-based releases
- **Source Maps**: Automatic upload for production debugging
- **Performance Monitoring**: Transaction tracing and profiling
- **Alert Integration**: Error rate alerts via Prometheus

**Features:**
- **Error Capture**: Automatic exception tracking
- **User Context**: User ID, email, IP tracking
- **Breadcrumbs**: HTTP requests, console logs, navigation
- **Performance Tracing**: API response times, database queries
- **Release Tracking**: Deploy tracking with git SHA
- **Source Maps**: Production source code debugging

---

## Files Created/Enhanced

### NEW Files (2)
1. **scripts/verify-sentry.sh** (660+ lines)
   - Comprehensive Sentry integration verification (15 categories)
   - Validates SDK installation (backend and frontend)
   - Checks configuration (DSN, environment, release tracking)
   - Tests source maps upload configuration
   - Validates error tracking functionality
   - Checks alert integration with Prometheus
   - Exit codes: 0 (success/warnings), 1 (critical failures)

2. **docs/ISS-021-VERIFICATION.md** (this file)
   - Complete Sentry integration summary
   - SDK installation guide (Python and Node.js)
   - Configuration guide (backend and frontend)
   - Source maps setup instructions
   - Testing procedures (manual error testing)
   - Troubleshooting guide

### FILES TO CREATE (Implementation Pending)
1. **apps/backend/src/config/sentry.py** (pending)
   - Sentry initialization for FastAPI
   - Environment-specific configuration
   - Error filtering and sampling
   - User context tracking

2. **apps/web/sentry.client.config.ts** (pending)
   - Sentry client-side configuration
   - DSN and environment setup
   - Release tracking
   - Performance monitoring

3. **apps/web/sentry.server.config.ts** (pending)
   - Sentry server-side configuration
   - Next.js API routes error tracking
   - Server-side performance monitoring

4. **apps/web/sentry.edge.config.ts** (optional, pending)
   - Sentry Edge runtime configuration
   - Middleware error tracking

5. **apps/web/instrumentation.ts** (pending)
   - Next.js instrumentation hook
   - Server-side Sentry registration

6. **.sentryclirc** or **sentry.properties** (pending)
   - Sentry CLI configuration
   - Source maps upload settings

### EXISTING Files Referenced
1. **.env.production.example** (line 87)
   - SENTRY_DSN placeholder configured
   - Ready for Sentry DSN value

2. **apps/backend/src/api/main.py** (existing)
   - FastAPI application entry point
   - Will add Sentry initialization

3. **apps/backend/src/config/settings.py** (existing)
   - Application settings
   - Will add sentry_dsn field

4. **monitoring/prometheus/alert_rules.yml** (existing)
   - Alert rules for error rates
   - HighErrorRate and CriticalErrorRate alerts

---

## Sentry Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SENTRY ERROR TRACKING ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────┐        ┌────────────────┐        ┌───────────────┐ │
│  │  APPLICATION   │        │  SENTRY SDK    │        │  SENTRY.IO    │ │
│  │  (ERRORS)      │───────▶│  (CAPTURE)     │───────▶│  (PLATFORM)   │ │
│  ├────────────────┤        ├────────────────┤        ├───────────────┤ │
│  │ • Backend API  │        │ • Auto capture │        │ • Error       │ │
│  │ • Frontend UI  │        │ • User context │        │   aggregation │ │
│  │ • Middleware   │        │ • Breadcrumbs  │        │ • Issue       │ │
│  │ • Database     │        │ • Performance  │        │   tracking    │ │
│  └────────────────┘        └────────────────┘        │ • Alerts      │ │
│           │                         │                │ • Releases    │ │
│           │                         │                └───────────────┘ │
│           ▼                         ▼                         │         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    ERROR CAPTURE FLOW                             │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ 1. Application throws exception or logs error                    │  │
│  │ 2. Sentry SDK captures error with context                        │  │
│  │ 3. SDK enriches with user, request, environment data             │  │
│  │ 4. SDK captures breadcrumbs (recent actions)                     │  │
│  │ 5. SDK applies filters (beforeSend, ignoreErrors)                │  │
│  │ 6. SDK sends to Sentry.io via HTTPS                              │  │
│  │ 7. Sentry groups errors into issues                              │  │
│  │ 8. Sentry triggers alerts based on rules                         │  │
│  │ 9. Source maps resolve production stack traces                   │  │
│  │ 10. Dashboard displays errors with full context                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    INTEGRATION POINTS                             │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │                                                                   │  │
│  │  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      │  │
│  │  │ PROMETHEUS  │◀────▶│   SENTRY    │────▶│ ALERTMANAGER│      │  │
│  │  │ (Metrics)   │      │ (Errors)    │      │ (Notify)    │      │  │
│  │  └─────────────┘      └─────────────┘      └─────────────┘      │  │
│  │         │                     │                     │             │  │
│  │         └─────────────────────┴─────────────────────┘             │  │
│  │                              │                                    │  │
│  │                    ┌─────────▼─────────┐                          │  │
│  │                    │  UNIFIED ALERTS   │                          │  │
│  │                    │  • Email          │                          │  │
│  │                    │  • Slack          │                          │  │
│  │                    │  • PagerDuty      │                          │  │
│  │                    └───────────────────┘                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              VERIFICATION CATEGORIES (15)                         │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ 1. Backend Sentry SDK Install    9. Performance Monitoring       │  │
│  │ 2. Frontend Sentry SDK Install   10. Alert Integration           │  │
│  │ 3. Backend Sentry Config         11. Error Filtering & Sampling  │  │
│  │ 4. Frontend Sentry Config        12. User Context & Breadcrumbs  │  │
│  │ 5. Environment Variables         13. Testing & Verification      │  │
│  │ 6. Release Tracking Config       14. Documentation               │  │
│  │ 7. Source Maps Configuration     15. Production Readiness        │  │
│  │ 8. Error Tracking Functionality  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Features Implementation Status

### ⏳ SDK Installation (Pending)
- ⏳ Backend: sentry-sdk[fastapi] package installation
- ⏳ Frontend: @sentry/nextjs package installation
- ⏳ Sentry CLI for source maps upload

### ⏳ Backend Configuration (Pending)
- ⏳ Sentry initialization in main.py
- ⏳ DSN configuration from environment
- ⏳ Environment tagging (development/staging/production)
- ⏳ Release tracking with git SHA
- ⏳ Error sampling configuration
- ⏳ Performance tracing (traces_sample_rate)
- ⏳ Profiling (profiles_sample_rate)

### ⏳ Frontend Configuration (Pending)
- ⏳ Client-side Sentry initialization
- ⏳ Server-side Sentry initialization
- ⏳ Edge runtime configuration (optional)
- ⏳ Instrumentation hook
- ⏳ Error boundary components
- ⏳ Performance monitoring
- ⏳ Session replay (optional)

### ⏳ Release Tracking (Pending)
- ⏳ Git commit SHA as release identifier
- ⏳ Release creation in Sentry
- ⏳ Deploy notifications
- ⏳ Release health monitoring

### ⏳ Source Maps (Pending)
- ⏳ Production browser source maps enabled
- ⏳ Sentry webpack plugin configuration
- ⏳ Automatic source maps upload on build
- ⏳ Source maps for server-side code

### ⏳ Error Filtering (Pending)
- ⏳ beforeSend callback for error filtering
- ⏳ ignoreErrors list for common noise
- ⏳ Error sampling in high-volume scenarios
- ⏳ PII scrubbing

### ⏳ User Context (Pending)
- ⏳ User ID tracking
- ⏳ User email tracking
- ⏳ Custom user attributes
- ⏳ Request context (IP, user agent)

### ⏳ Breadcrumbs (Pending)
- ✅ HTTP requests (automatic)
- ✅ Console logs (automatic)
- ✅ Navigation events (automatic)
- ⏳ Custom breadcrumbs for business logic

### ⏳ Performance Monitoring (Pending)
- ⏳ Transaction tracing
- ⏳ Database query tracking
- ⏳ API response time tracking
- ⏳ Frontend page load timing

### ⏳ Alert Integration (Pending)
- ✅ Prometheus error rate alerts (existing)
- ⏳ Sentry webhook to AlertManager
- ⏳ Error rate spike detection
- ⏳ New error type alerts

---

## Verification Script Details

### Location
`scripts/verify-sentry.sh`

### Usage

```bash
# Local verification
./scripts/verify-sentry.sh

# Production verification with DSN
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx ./scripts/verify-sentry.sh

# Custom backend URL
BACKEND_URL=http://localhost:8001 ./scripts/verify-sentry.sh
```

### Verification Categories (15)

1. **Backend Sentry SDK Installation** - sentry-sdk[fastapi] in pyproject.toml, importable
2. **Frontend Sentry SDK Installation** - @sentry/nextjs in package.json, installed
3. **Backend Sentry Configuration** - sentry_sdk.init in main.py, settings configured
4. **Frontend Sentry Configuration** - sentry.*.config.ts files, Sentry.init calls
5. **Environment Variables** - SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
6. **Release Tracking Configuration** - release parameter in configs, git integration
7. **Source Maps Configuration** - next.config source maps, Sentry CLI config, upload scripts
8. **Error Tracking Functionality** - Error boundaries, exception handlers, test endpoints
9. **Performance Monitoring** - traces_sample_rate, profiles_sample_rate configuration
10. **Alert Integration** - Prometheus error alerts, Sentry webhook integration
11. **Error Filtering & Sampling** - beforeSend callbacks, ignoreErrors lists, sample_rate
12. **User Context & Breadcrumbs** - setUser calls, breadcrumbs configuration
13. **Testing & Verification** - Integration tests, test error endpoints
14. **Documentation** - Sentry setup guide, usage documentation
15. **Production Readiness** - DSN configured, SDKs initialized, environment tagging

---

## Implementation Guide

### Step 1: Backend SDK Installation

```bash
# Install Sentry SDK with FastAPI integration
cd apps/backend
uv add sentry-sdk[fastapi]
```

### Step 2: Backend Configuration

**Create `apps/backend/src/config/sentry.py`:**

```python
"""Sentry error tracking configuration."""

import os
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.redis import RedisIntegration

def init_sentry(environment: str = "development", debug: bool = False) -> None:
    """Initialize Sentry error tracking.

    Args:
        environment: Environment name (development/staging/production)
        debug: Enable debug mode
    """
    sentry_dsn = os.getenv("SENTRY_DSN", "")

    if not sentry_dsn:
        print("Sentry DSN not configured - error tracking disabled")
        return

    # Get release from environment or git
    release = os.getenv("RELEASE", os.getenv("GIT_COMMIT", "unknown"))

    sentry_sdk.init(
        dsn=sentry_dsn,
        environment=environment,
        release=release,

        # Performance monitoring (10% of transactions)
        traces_sample_rate=0.1 if environment == "production" else 1.0,

        # Profiling (10% of transactions)
        profiles_sample_rate=0.1 if environment == "production" else 1.0,

        # Error sampling (100% in production, lower if high volume)
        sample_rate=1.0,

        # Integrations
        integrations=[
            FastApiIntegration(transaction_style="url"),
            SqlalchemyIntegration(),
            RedisIntegration(),
        ],

        # Error filtering
        before_send=before_send_filter,
        ignore_errors=[
            KeyboardInterrupt,
            SystemExit,
        ],

        # Debug mode
        debug=debug,

        # Send default PII (user IP, user agent)
        send_default_pii=True,
    )


def before_send_filter(event, hint):
    """Filter errors before sending to Sentry.

    Args:
        event: Sentry event
        hint: Event hint with exception info

    Returns:
        Modified event or None to drop
    """
    # Filter out health check errors
    if event.get("request", {}).get("url", "").endswith("/api/health"):
        return None

    # Filter out 404 errors
    if event.get("exception", {}).get("values", [{}])[0].get("type") == "NotFound":
        return None

    # Add custom tags
    event["tags"] = event.get("tags", {})
    event["tags"]["component"] = "backend"

    return event
```

**Update `apps/backend/src/api/main.py`:**

```python
from src.config.sentry import init_sentry

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan context manager."""
    setup_logging(debug=settings.debug)

    # Initialize Sentry
    init_sentry(
        environment=settings.environment,
        debug=settings.debug
    )

    logger.info("Starting application", environment=settings.environment)
    # ... rest of lifespan code
```

**Update `apps/backend/src/config/settings.py`:**

```python
class Settings(BaseSettings):
    """Application settings."""

    # ... existing settings

    # Sentry configuration
    sentry_dsn: str = Field(
        default="",
        description="Sentry DSN for error tracking"
    )
    sentry_environment: str = Field(
        default="development",
        description="Sentry environment (development/staging/production)"
    )
```

### Step 3: Frontend SDK Installation

```bash
# Install Sentry SDK for Next.js
pnpm add @sentry/nextjs --filter=web
```

### Step 4: Frontend Configuration

**Create `apps/web/sentry.client.config.ts`:**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT || "development",

  // Release tracking
  release: process.env.NEXT_PUBLIC_RELEASE || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Performance monitoring (10% of transactions in production)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Session replay (10% of sessions)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Integrations
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Error filtering
  beforeSend(event, hint) {
    // Filter out errors from browser extensions
    if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
      frame => frame.filename?.includes("chrome-extension://")
    )) {
      return null;
    }

    // Filter out network errors
    if (event.exception?.values?.[0]?.type === "NetworkError") {
      return null;
    }

    return event;
  },

  // Ignore common errors
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
  ],
});
```

**Create `apps/web/sentry.server.config.ts`:**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  environment: process.env.ENVIRONMENT || "development",
  release: process.env.RELEASE || process.env.VERCEL_GIT_COMMIT_SHA,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  beforeSend(event) {
    // Filter out health check errors
    if (event.request?.url?.includes("/api/health")) {
      return null;
    }

    return event;
  },
});
```

**Create `apps/web/sentry.edge.config.ts`:**

```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  environment: process.env.ENVIRONMENT || "development",
  tracesSampleRate: 0.1,
});
```

**Create `apps/web/instrumentation.ts`:**

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
```

**Update `apps/web/next.config.mjs`:**

```javascript
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable source maps for production
  productionBrowserSourceMaps: true,

  // ... other Next.js config
};

// Sentry webpack plugin options
const sentryOptions = {
  // Upload source maps during production build
  silent: true,

  // Suppress logging
  widenClientFileUpload: true,

  // Automatically tree-shake Sentry logger statements
  disableLogger: true,

  // Hide source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically annotate React components for better stack traces
  reactComponentAnnotation: {
    enabled: true,
  },
};

export default withSentryConfig(nextConfig, sentryOptions);
```

### Step 5: Environment Variables

**Update `.env.production.example`:**

```bash
# Sentry Error Tracking
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
SENTRY_AUTH_TOKEN=<your-auth-token>
SENTRY_ORG=<your-org-slug>
SENTRY_PROJECT=<your-project-slug>
RELEASE=v1.0.0

# Frontend (public)
NEXT_PUBLIC_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_RELEASE=v1.0.0
```

### Step 6: Sentry CLI Configuration

**Create `.sentryclirc`:**

```ini
[auth]
token=<your-auth-token>

[defaults]
org=<your-org-slug>
project=<your-project-slug>

[http]
keepalive=true
```

**Add to `.gitignore`:**

```
.sentryclirc
sentry.properties
```

### Step 7: Source Maps Upload

**Add to `apps/web/package.json`:**

```json
{
  "scripts": {
    "build": "next build",
    "sentry:sourcemaps": "sentry-cli sourcemaps upload --release=$RELEASE ./out"
  }
}
```

### Step 8: Error Boundary (Frontend)

**Create `apps/web/components/ErrorBoundary.tsx`:**

```typescript
"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Something went wrong!</h2>
        <p className="text-muted-foreground mt-2">
          Our team has been notified and is working on it.
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded bg-primary px-4 py-2 text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
```

### Step 9: Test Error Endpoint (Backend)

**Add to `apps/backend/src/api/routes/health.py`:**

```python
@router.get("/test-error")
async def test_error():
    """Test error endpoint for Sentry verification.

    This endpoint intentionally raises an exception to test Sentry integration.
    Only use in development/staging environments.
    """
    if settings.environment == "production":
        raise HTTPException(
            status_code=403,
            detail="Test error endpoint disabled in production"
        )

    raise Exception("Test error for Sentry - this is intentional!")
```

---

## Testing Procedures

### Backend Error Testing

```bash
# Start backend
cd apps/backend
uv run uvicorn src.api.main:app --reload

# Test error endpoint
curl -X GET http://localhost:8000/api/test-error

# Check Sentry dashboard
# Navigate to: https://sentry.io/organizations/<your-org>/issues/
# Verify error appears with full stack trace and context
```

### Frontend Error Testing

**Option 1: Intentional Error Button**

```typescript
// Add to a test page
<button onClick={() => { throw new Error("Test error from frontend!"); }}>
  Test Sentry Error
</button>
```

**Option 2: Console Test**

```javascript
// Open browser console
throw new Error("Test error from console");

// Or use Sentry.captureException
Sentry.captureException(new Error("Manual test error"));
```

### Source Maps Testing

```bash
# Build frontend with source maps
cd apps/web
pnpm build

# Upload source maps
export SENTRY_AUTH_TOKEN=<your-token>
export RELEASE=$(git rev-parse HEAD)
pnpm sentry:sourcemaps

# Trigger error in production build
pnpm start
# Navigate to app and trigger error
# Check Sentry dashboard - stack traces should show original source code
```

### Performance Monitoring Testing

```bash
# Backend: Monitor slow endpoints
curl -X GET http://localhost:8000/api/products?page=1&page_size=1000

# Frontend: Monitor page load
# Open browser DevTools → Network → Slow 3G
# Navigate between pages
# Check Sentry Performance dashboard for transaction traces
```

---

## Success Criteria

### ⏳ Backend Integration (Pending)
- ⏳ sentry-sdk[fastapi] installed
- ⏳ Sentry initialized in main.py
- ⏳ DSN configured from environment
- ⏳ Error filtering configured
- ⏳ User context tracking
- ⏳ Performance monitoring enabled

### ⏳ Frontend Integration (Pending)
- ⏳ @sentry/nextjs installed
- ⏳ Client-side config exists
- ⏳ Server-side config exists
- ⏳ Error boundary implemented
- ⏳ Source maps enabled
- ⏳ Performance monitoring enabled

### ⏳ Release Tracking (Pending)
- ⏳ Git SHA used as release
- ⏳ Releases created in Sentry
- ⏳ Deploy notifications sent

### ⏳ Source Maps (Pending)
- ⏳ Production source maps enabled
- ⏳ Sentry CLI configured
- ⏳ Automatic upload on build

### ⏳ Error Filtering (Pending)
- ⏳ beforeSend callback implemented
- ⏳ ignoreErrors list configured
- ⏳ PII scrubbing enabled

### ⏳ Testing (Pending)
- ⏳ Test error endpoint created
- ⏳ Backend errors captured
- ⏳ Frontend errors captured
- ⏳ Source maps resolve correctly
- ⏳ Performance traces visible

### ⏳ Production Deployment (Pending)
- ⏳ SENTRY_DSN configured
- ⏳ SENTRY_AUTH_TOKEN configured
- ⏳ Source maps uploaded
- ⏳ Error alerts configured
- ⏳ Sentry dashboard monitored

---

## Troubleshooting

### Problem: Errors Not Appearing in Sentry

**Solution:**
```bash
# Check DSN is configured
echo $SENTRY_DSN

# Check Sentry is initialized
# Backend: Check logs for "Sentry initialized" message
# Frontend: Check browser console for Sentry initialization

# Test with manual error
# Backend:
curl http://localhost:8000/api/test-error

# Frontend:
# Open console and run: Sentry.captureException(new Error("Test"));

# Check Sentry logs
# Backend: docker-compose logs backend | grep -i sentry
# Frontend: Check browser DevTools → Network → Filter "sentry"
```

### Problem: Source Maps Not Working

**Solution:**
```bash
# Verify source maps are uploaded
sentry-cli releases files $RELEASE list

# Check release is tagged correctly
# Should match NEXT_PUBLIC_RELEASE in frontend
# Should match RELEASE in backend

# Verify source maps URL
# Check next.config.mjs: productionBrowserSourceMaps: true

# Re-upload source maps
cd apps/web
pnpm build
export RELEASE=$(git rev-parse HEAD)
sentry-cli sourcemaps upload --release=$RELEASE .next

# Verify in Sentry
# Settings → Projects → [Project] → Source Maps
```

### Problem: Too Many Errors (High Volume)

**Solution:**
```bash
# Reduce sample rate
# Backend (sentry.py):
# sample_rate=0.5  # 50% of errors

# Frontend (sentry.client.config.ts):
# sampleRate: 0.5

# Add more filters in beforeSend
# Filter by error type, URL, user agent, etc.

# Increase ignoreErrors list
# Add common browser extension errors
# Add known harmless errors
```

### Problem: Performance Traces Not Visible

**Solution:**
```bash
# Check traces_sample_rate is set
# Backend: traces_sample_rate=0.1
# Frontend: tracesSampleRate: 0.1

# Verify performance monitoring is enabled in Sentry project
# Settings → Projects → [Project] → Performance

# Trigger enough traffic to generate traces
# Need 10+ transactions for 10% sample rate

# Check Sentry Performance dashboard
# Performance → Transactions
```

### Problem: User Context Not Tracked

**Solution:**
```python
# Backend: Add user context in auth middleware
# apps/backend/src/api/middleware/auth.py

from sentry_sdk import set_user

async def set_user_context(request: Request, user: User):
    """Set Sentry user context."""
    set_user({
        "id": str(user.id),
        "email": user.email,
        "username": user.full_name,
        "ip_address": request.client.host,
    })
```

```typescript
// Frontend: Set user after login
// apps/web/lib/auth.ts

import * as Sentry from "@sentry/nextjs";

function setUserContext(user: User) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.full_name,
  });
}
```

---

## Next Steps

### Immediate
1. **Install Sentry SDKs**
   ```bash
   cd apps/backend && uv add sentry-sdk[fastapi]
   cd apps/web && pnpm add @sentry/nextjs --filter=web
   ```

2. **Configure Sentry**
   - Create sentry.py in backend
   - Create sentry.*.config.ts in frontend
   - Add Sentry initialization to main.py

3. **Set Up Sentry Account**
   - Create account at https://sentry.io
   - Create new project for CCW-ERP
   - Get DSN and auth token
   - Configure environment variables

### Short-term (Within 7 Days)
4. **Test Error Tracking**
   - Create test error endpoint
   - Trigger test errors
   - Verify errors appear in Sentry dashboard
   - Verify source maps resolve correctly

5. **Configure Source Maps**
   - Enable production source maps
   - Configure Sentry CLI
   - Test source maps upload
   - Verify stack traces in Sentry

6. **Set Up Alerts**
   - Configure error rate alerts in Sentry
   - Integrate with AlertManager (optional)
   - Test alert delivery
   - Configure on-call schedule

7. **Performance Monitoring**
   - Enable performance tracking
   - Configure sample rates
   - Review performance dashboard
   - Identify slow transactions

---

## Related Issues

### Prerequisites (Complete)
- ✅ **ISS-019**: Deploy Prometheus/Grafana - Monitoring infrastructure
- ✅ **ISS-020**: Configure Alert Rules - Error rate alerts

### Current Issue
- ⏳ **ISS-021**: Integrate Sentry Error Tracking - Error monitoring (PENDING IMPLEMENTATION)

### Next Steps
- **ISS-022**: Set Up Uptime Monitoring - External monitoring
- **ISS-023**: Create Operations Dashboards - Business metrics dashboards

---

## Sign-off

**Sentry Error Tracking Integration**: ⏳ PENDING IMPLEMENTATION

**Date**: February 2, 2026

**Artifacts Delivered**:
1. ✅ scripts/verify-sentry.sh (660+ lines, 15 categories)
2. ✅ docs/ISS-021-VERIFICATION.md (this document)

**Implementation Status**:
- ✅ Verification script created
- ✅ Documentation complete
- ✅ Environment variable placeholder configured (.env.production.example)
- ⏳ Backend SDK installation (pending)
- ⏳ Frontend SDK installation (pending)
- ⏳ Sentry initialization code (pending)
- ⏳ Source maps configuration (pending)
- ⏳ Error testing (pending)

**Testing Status**:
- ✅ Verification script tested (dry run)
- ⏳ Backend error capture (pending implementation)
- ⏳ Frontend error capture (pending implementation)
- ⏳ Source maps upload (pending implementation)
- ⏳ Performance monitoring (pending implementation)
- ⏳ Alert integration (pending implementation)

**Production Readiness**: ⏳ PENDING FULL IMPLEMENTATION
- Verification tools ready
- Implementation guide complete
- Awaiting SDK installation
- Awaiting Sentry account setup
- Awaiting DSN configuration
- Awaiting code implementation
- Awaiting testing and validation

**Approved by**: [Pending Review]

---

**End of ISS-021 Verification Document**
