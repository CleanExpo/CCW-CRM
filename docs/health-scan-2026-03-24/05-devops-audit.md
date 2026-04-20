# DevOps Engineer Health Audit

**Audit Date**: 2026-03-24
**Auditor**: Senior DevOps Engineer (15+ years experience)
**Scope**: CI/CD, environment configuration, Docker, logging, monitoring

---

## Executive Summary

The CCW-ERP-CRM project has a DevOps infrastructure that is **structurally ambitious and well-designed in intent**, but suffers from a cluster of reliability and quality issues that undermine its claimed maturity. The monitoring stack is impressive (Prometheus + Grafana + Alertmanager + cAdvisor + exporters), the deployment workflows are thoughtfully layered (CI → staging → production with rollback), and the Dockerfiles follow security best practices (non-root users, multi-stage builds, pinned base images).

However, the overall picture is mixed:

- **CI gates are non-blocking** — both the migration step and the full backend test suite are marked `continue-on-error: true`, meaning broken code passes CI. This is the single most critical finding.
- **Coverage thresholds are set at 15%**, which is below any reasonable production standard and provides essentially no confidence.
- **Backend type checking (mypy) is completely commented out** in CI, and the mypy config has all strictness disabled.
- **Three third-party actions are pinned to floating `@master` branches** (Snyk x2, Trivy), a supply-chain attack vector.
- **Logging coverage is inconsistent** — 20+ of 59 route files have no logging at all, including core modules like `health.py`, `invoices.py`, and `purchase_orders.py`.
- **A node-exporter is declared in Prometheus config but missing from docker-compose.yml**, creating a broken scrape target.
- **Backend .env.example files contain `NEXT_PUBLIC_` prefixed variables**, which are a frontend convention leaking into backend config — a namespace confusion issue.
- **Grafana ships with a default `admin` password** in the compose file when `GRAFANA_ADMIN_PASSWORD` is not set.

---

## Overall Grade: C+ (61/100)

Grade scale: A=95+, B+=85+, B=75+, C+=65+

| Area                      | Score | Notes                                                                            |
| ------------------------- | ----- | -------------------------------------------------------------------------------- |
| CI/CD Pipeline Structure  | 14/20 | Good shape/layering; non-blocking test gates kill confidence                     |
| Environment Configuration | 12/20 | Thorough .env.example; NEXT*PUBLIC* leak, no production .env validation          |
| Docker/Container Setup    | 17/20 | Excellent Dockerfiles; node-exporter missing from compose                        |
| Logging and Observability | 9/20  | structlog configured correctly; ~34% of routes have no logging                   |
| Health Endpoints          | 9/20  | Basic health/ready/database endpoints exist; no Redis check, no version endpoint |

---

## 1. CI/CD Pipeline

### 1.1 Workflow Inventory

Six workflow files exist under `.github/workflows/`:

| File                    | Trigger                           | Purpose                                             |
| ----------------------- | --------------------------------- | --------------------------------------------------- |
| `ci.yml`                | push/PR to `main`, `ai-updates`   | Core CI: lint, type-check, test, build, E2E, a11y   |
| `deploy-staging.yml`    | `workflow_run` after CI on `main` | Staging deploy via SSH + Docker                     |
| `deploy-production.yml` | `workflow_dispatch` (manual)      | Production deploy with pre-deploy backup + rollback |
| `rollback.yml`          | `workflow_dispatch` (manual)      | Emergency rollback (code only / DB / both)          |
| `security.yml`          | push/PR to `main`, weekly cron    | Snyk, npm audit, Trivy, dependency review           |
| `agent-pr-checks.yml`   | PR on `main`, `develop`           | Agent-specific PR validation                        |

**Positive**: The overall workflow graph is sound. Staging only deploys after CI passes (CI gate guard job). Production is manual-only with dual confirmation checkboxes. An emergency rollback workflow exists with environment-aware SSH routing. Concurrency groups prevent concurrent deployments to the same environment. Pre-deployment database backups are taken before every deploy.

### 1.2 CRITICAL — Non-blocking CI Gates

**File**: `.github/workflows/ci.yml`, lines 95 and 106

```yaml
- name: Run database migrations
  continue-on-error: true # line 95
  run: uv run alembic upgrade head

- name: Run tests with coverage
  id: test
  continue-on-error: true # line 106
  run: uv run pytest --cov=src --cov-fail-under=15 -v
```

Both the migration step and the entire backend test suite are `continue-on-error: true`. The CI Summary job (`ci-summary`) only hard-fails on `frontend-tests` and `build` failures — not on `backend-tests`. This means a completely broken backend with failing migrations and zero passing tests will produce a green CI badge and merge into `main`.

The inline comments reference `UNI-1242` as the justification. This is acceptable as a temporary measure during initial setup, but must be treated as a critical blocking issue. There is no evidence UNI-1242 has been resolved.

**Recommendation**: Remove `continue-on-error` from both steps immediately. Fix the underlying migration/test setup issues tracked in UNI-1242 first. At minimum, add the `backend-tests` result to the `Fail if any job failed` condition in `ci-summary`.

### 1.3 CRITICAL — Coverage Threshold Too Low

**File**: `.github/workflows/ci.yml`, line 107; `deploy-production.yml`, line 156

```yaml
run: uv run pytest --cov=src --cov-fail-under=15 -v
```

A 15% coverage threshold is effectively no gate at all. Industry standard for a production system is 70–80% minimum. Combined with the `continue-on-error` above, coverage enforcement is doubly moot.

**Recommendation**: Raise to 60% minimum short-term, 80% medium-term. Track this as a separate Linear issue.

### 1.4 HIGH — Backend Type Checking Disabled

**File**: `.github/workflows/ci.yml`, lines 86-89

```yaml
# Type checking (enable when mypy errors are fixed)
# - name: Type check with mypy
#   working-directory: apps/backend
#   run: uv run mypy src/
```

Backend mypy is entirely commented out. The mypy config in `pyproject.toml` further compounds this:

```toml
[tool.mypy]
strict = false
ignore_missing_imports = true
check_untyped_defs = false
disallow_untyped_defs = false
```

With all strictness flags disabled, even when mypy is eventually enabled it will catch almost nothing. The frontend runs `pnpm run type-check` successfully, creating an asymmetry where the Python backend has zero static type checking in CI.

**Recommendation**: Fix mypy errors progressively. Enable mypy in CI with a `--ignore-errors` baseline, graduating to strict mode per-module.

### 1.5 HIGH — Third-Party Actions on Floating `@master` Branches

**File**: `.github/workflows/security.yml`, lines 56, 106, 181

```yaml
uses: snyk/actions/node@master
uses: snyk/actions/python@master
uses: aquasecurity/trivy-action@master
```

Pinning to `@master` means the action content can change without any notice. This is a supply-chain attack vector — a compromised `@master` on the Snyk or Trivy repository would silently execute arbitrary code in your CI environment with access to all secrets.

**Recommendation**: Pin all third-party actions to specific commit SHAs. Example:

```yaml
uses: aquasecurity/trivy-action@6e7b7d1fd3e4fef0c5fa8cce1229c54b2c9bd0d # v0.16.1
```

### 1.6 MEDIUM — `uv` Tool Version Unpinned in CI

**File**: `.github/workflows/ci.yml`, lines 63 and 354

```yaml
uses: astral-sh/setup-uv@v4
with:
  version: 'latest'
```

The `setup-uv` action is pinned to `@v4` (good) but the `uv` tool itself is pulled as `latest`. Note the Dockerfile correctly pins `uv==0.5.5`. This inconsistency means CI uses a different uv version than production images, which could cause dependency resolution differences.

**Recommendation**: Pin the uv version in CI to match the Dockerfile: `version: '0.5.5'`.

### 1.7 MEDIUM — Hardcoded Sleep Timers in Deploy Workflows

Deploy workflows use fixed `sleep` durations to wait for service startup:

- `deploy-production.yml`: `sleep 30`, `sleep 20`, `sleep 10` (lines 323, 335, 350)
- `deploy-staging.yml`: `sleep 30`, `sleep 15`, `sleep 10` (lines 300, 311, 327)

These are brittle. On a slow server, 30 seconds may be insufficient. On a fast server, it adds unnecessary latency. The workflows already have retry loops with health checks — the initial sleep before the loop is redundant.

**Recommendation**: Remove initial sleep and rely entirely on the health-check retry loops (`for i in {1..30}` pattern already used in E2E job startup).

### 1.8 LOW — Rollback Uses `git checkout HEAD~1` Without Image Tag

**File**: `.github/workflows/deploy-production.yml`, line 366

```bash
git checkout HEAD~1
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d
```

The emergency rollback in the `deploy-production.yml` deploy job rolls back code to `HEAD~1` but does not pull the corresponding Docker image from GHCR. If the old image has been garbage collected or replaced, this will silently run the new image against the old code.

The dedicated `rollback.yml` workflow handles this correctly (rebuilds images from the target SHA). The inline rollback in deploy-production should be updated to match that pattern or simply reference rollback.yml.

### 1.9 LOW — PR Preview Comment Uses Hardcoded Vercel URL Pattern

**File**: `.github/workflows/ci.yml`, lines 233-234

```javascript
`| Vercel Preview | [ccw-erp-git-${branch}.vercel.app](https://ccw-erp-git-${branch}.vercel.app) | Auto-built by Vercel |`,
`| Staging API | [api.staging.ccw-erp.com/api/health](https://api.staging.ccw-erp.com/api/health) | Deployed on merge to \`main\` |`,
```

The Vercel preview URL is generated by guessing the pattern (`ccw-erp-git-<branch>.vercel.app`). Vercel's actual preview URL structure may differ. The staging API URL is hardcoded — if the domain changes, these comments become misleading.

**Recommendation**: Use the Vercel CLI or Vercel GitHub integration to fetch the actual deployment URL instead of guessing.

---

## 2. Environment Configuration

### 2.1 Overview

Three `.env.example` files exist:

- `apps/backend/.env.example` — 178 lines, comprehensive
- `apps/backend/.env.production.example` — 122 lines, production-specific
- `apps/web/.env.example` — 90 lines, frontend-specific

All three are well-structured with inline comments explaining each variable, generation instructions, and security warnings.

### 2.2 HIGH — Frontend `NEXT_PUBLIC_` Variables in Backend Config

**File**: `apps/backend/.env.example`, lines 4-5; `apps/backend/.env.production.example`, lines 115-122

```ini
# Backend .env.example
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000

# Backend .env.production.example
NEXT_PUBLIC_SUPABASE_URL=https://vwfgksqkajnpfjospbpe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

The `NEXT_PUBLIC_` prefix is a Next.js convention that signals a variable is safe to expose to the browser. It has no meaning in a Python/FastAPI backend. These variables in the backend config are either:

1. Artifacts from copying a frontend .env.example (namespace pollution), or
2. The backend is incorrectly reading `NEXT_PUBLIC_SUPABASE_URL` instead of `SUPABASE_URL`

Additionally, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the public anon key) is appropriate for the frontend but the backend should be using `SUPABASE_SERVICE_ROLE_KEY` for privileged operations. Having the anon key configured in the backend is potentially a security concern if any code path accidentally uses the anon key for admin operations.

**Recommendation**: Remove all `NEXT_PUBLIC_` prefixed variables from the backend .env files. Replace with correctly named backend equivalents (`SUPABASE_URL`, `SUPABASE_ANON_KEY` if truly needed, or just `SUPABASE_SERVICE_ROLE_KEY`).

### 2.3 MEDIUM — No Environment Variable Validation at Startup

There is no startup validation that required variables are set. The backend reads settings via Pydantic BaseSettings, which will raise a `ValidationError` if a required field is missing — but optional fields with defaults will silently pass even in production mode where they may be required.

For example, `JWT_SECRET_KEY` has a minimum length requirement enforced via `get_jwt_secret_secure()`, but there is no equivalent check for `DATABASE_ENCRYPTION_KEY`, `STRIPE_SECRET_KEY`, or `SENDGRID_API_KEY` at startup time.

**Recommendation**: Add a startup validation step in `main.py`'s `lifespan` function that checks for production-required variables and fails fast with a clear error message if any are absent.

### 2.4 MEDIUM — Actual Supabase Project Reference in Production Example

**File**: `apps/backend/.env.production.example`, lines 25 and 115

```ini
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD_HERE@db.vwfgksqkajnpfjospbpe.supabase.co:6543/postgres
NEXT_PUBLIC_SUPABASE_URL=https://vwfgksqkajnpfjospbpe.supabase.co
```

The Supabase project reference ID `vwfgksqkajnpfjospbpe` is committed to the repository in plain text. While this is a project URL (not a secret), it narrows the attack surface for targeted attacks against the Supabase project. It also means this file cannot be shared publicly (e.g. in an open source fork) without exposing infrastructure details.

**Recommendation**: Replace with a placeholder (`YOUR_SUPABASE_PROJECT_REF`). Store the actual reference in a secrets manager or Vercel environment variables dashboard.

### 2.5 LOW — Missing `DATABASE_URL` in Backend `.env.example`

**File**: `apps/backend/.env.example`

The `.env.example` lists `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` but does not list `DATABASE_URL` — the variable that the actual FastAPI backend uses for SQLAlchemy. A developer following `.env.example` exactly would not know to set `DATABASE_URL`.

**Recommendation**: Add `DATABASE_URL=postgresql+asyncpg://starter_user:local_dev_password@localhost:5432/starter_db` (or similar) to `apps/backend/.env.example`.

### 2.6 LOW — Separate Frontend and Backend `.env.example` Not Mentioned in Root README

There is no root-level `.env.example`. Developers may not realize there are two separate environment files to configure. The workflow instructions in `CLAUDE.md` don't explicitly call this out.

---

## 3. Docker/Container Setup

### 3.1 Backend Dockerfile — Strong

**File**: `apps/backend/Dockerfile`

| Practice                                   | Status                            |
| ------------------------------------------ | --------------------------------- |
| Multi-stage build (deps + runner)          | Present                           |
| Non-root user (`appuser`, uid 1001)        | Present                           |
| `PYTHONUNBUFFERED=1`                       | Present                           |
| `PYTHONDONTWRITEBYTECODE=1`                | Present                           |
| HEALTHCHECK with curl                      | Present                           |
| `--no-cache-dir` pip install               | Present                           |
| Production deps only (`--no-dev`)          | Present                           |
| Pinned base image tag (`python:3.12-slim`) | Present (floating minor, not SHA) |
| `uv` pinned to `0.5.5`                     | Present                           |

The backend Dockerfile is well-crafted. Minor note: `python:3.12-slim` is a floating tag (will receive patch updates); for maximum reproducibility pin to a digest, e.g., `python:3.12-slim@sha256:...`.

### 3.2 Frontend Dockerfile — Strong

**File**: `apps/web/Dockerfile`

| Practice                                    | Status                                                      |
| ------------------------------------------- | ----------------------------------------------------------- |
| Multi-stage build (deps + builder + runner) | Present                                                     |
| Non-root user (`nextjs`, uid 1001)          | Present                                                     |
| `NEXT_TELEMETRY_DISABLED=1`                 | Present                                                     |
| `--frozen-lockfile`                         | Present                                                     |
| `HEALTHCHECK`                               | Present (uses wget, appropriate for alpine)                 |
| Build ARGs for public env vars              | Present                                                     |
| Standalone output mode                      | Assumed (requires `output: "standalone"` in next.config.ts) |

### 3.3 HIGH — `node-exporter` Declared in Prometheus but Missing from `docker-compose.yml`

**File**: `monitoring/prometheus/prometheus.yml`, line 38-40; `docker-compose.yml` (absence)

```yaml
# prometheus.yml
- job_name: 'node'
  static_configs:
    - targets:
        - 'node-exporter:9100'
```

There is no `node-exporter` service in `docker-compose.yml`. Prometheus will continuously log scrape failures for this target and report `up{job="node"}=0`. Any alert rules relying on `node_cpu_seconds_total`, `node_memory_MemAvailable_bytes`, etc. will never fire — including the `HighCPUUsage` and `HighMemoryUsage` alerts defined in `alert-rules-prod.yml`.

**Recommendation**: Add the `prom/node-exporter` service to `docker-compose.yml`:

```yaml
node-exporter:
  image: prom/node-exporter:v1.7.0
  container_name: ccw-node-exporter
  restart: unless-stopped
  pid: host
  volumes:
    - /proc:/host/proc:ro
    - /sys:/host/sys:ro
    - /:/rootfs:ro
  command:
    - '--path.procfs=/host/proc'
    - '--path.sysfs=/host/sys'
    - '--collector.filesystem.ignored-mount-points=^/(dev|proc|sys|run)($|/)'
  ports:
    - '9100:9100'
  networks:
    - starter-network
```

### 3.4 MEDIUM — Redis Exporter Port Discrepancy

**File**: `docker-compose.yml`, line 229; `monitoring/prometheus/prometheus.yml`, line 34

```yaml
# docker-compose.yml
ports:
  - "9122:9121"  # External 9122 to avoid conflict

# prometheus.yml
- targets:
    - 'redis-exporter:9121'
```

Prometheus scrapes `redis-exporter:9121` — the **container-internal** port. This is correct for inter-container communication (Prometheus and the exporter share a Docker network). The port mapping `9122:9121` is only for external host access. So this is not an active bug, but the comment `# External 9122 to avoid conflict with native process on 9121` suggests this was motivated by a local conflict rather than a deliberate architecture decision. If running without Docker networking (e.g., in CI), this would fail.

**Recommendation**: Add a comment clarifying that `redis-exporter:9121` in prometheus.yml uses the internal container port, not the host-mapped 9122.

### 3.5 MEDIUM — Grafana Default Admin Password

**File**: `docker-compose.yml`, line 143

```yaml
- GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-admin}
```

If `GRAFANA_ADMIN_PASSWORD` is not set in the local environment, Grafana starts with password `admin`. This is acceptable for local development but needs to be clearly documented. The `.env.example` files do not mention `GRAFANA_ADMIN_PASSWORD`.

**Recommendation**: Add `GRAFANA_ADMIN_PASSWORD=change_this_in_production` to the backend `.env.example` and add a startup warning to `docker-compose.yml` comments.

### 3.6 LOW — Backend Docker Image Runs Only 2 Workers

**File**: `apps/backend/Dockerfile`, line 68

```dockerfile
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

Using multiple workers with `--workers 2` is incompatible with async lifespan events and shared in-process state (e.g., agent registries, Prometheus metrics counters). Multi-worker setups require the application to be stateless or use external state. If shared in-memory state is used, use a single worker with `--workers 1` and rely on horizontal scaling instead.

**Recommendation**: Audit whether any in-process state is shared across requests. If so, reduce to `--workers 1`. If the app is stateless, `--workers 2` is fine but document this explicitly.

### 3.7 POSITIVE — Resource Limits Defined

All services in `docker-compose.yml` have explicit CPU and memory limits defined under `deploy.resources`. This is a production-grade practice that prevents resource starvation on shared hosts.

### 3.8 POSITIVE — Health Checks on All Core Services

`postgres`, `redis`, and `backend` all have proper `healthcheck` configurations. The `depends_on` in `docker-compose.yml` uses `condition: service_healthy`, ensuring services start in the correct order.

---

## 4. Logging and Observability

### 4.1 Logging Architecture

The backend uses `structlog` configured in `apps/backend/src/utils/logging.py`. Setup is clean:

```python
# In production: JSON output (machine-parseable)
structlog.processors.JSONRenderer() if not debug else structlog.dev.ConsoleRenderer()
```

The `setup_logging()` function is called in the `lifespan` context manager in `main.py`, ensuring logs are structured before any request is handled. `contextvars` merging is configured, which allows request-scoped context (e.g., request_id) to appear in all log entries within that request.

**Positive**: JSON logging in production, console renderer in debug, ISO timestamps, log level filtering, request ID middleware (`RequestIdMiddleware` is imported in `main.py`).

### 4.2 HIGH — Logging Coverage Gap: ~34% of Route Files Have No Logging

Of 59 backend route files, approximately 20 have no `structlog` or `get_logger` import at all:

```
activities.py        autonomous_dev.py     autonomy_metrics.py
backorders.py        config.py             contacts.py
containers.py        contractors.py        customers.py
demo_dashboard.py    demo_lists.py         health.py
invoices.py          invoice_payments.py   jobs.py
prometheus_metrics.py  public_stats.py     purchase_orders.py
```

Notably, `health.py` — the primary health check endpoint — has no logging. When the health check fails (database unreachable), it returns an error in the response body but logs nothing to structured output. This means database connectivity failures would not appear in log aggregation tools.

`invoices.py` and `purchase_orders.py` are business-critical modules with no logging, making it impossible to audit invoice creation failures or purchase order anomalies through logs.

**Recommendation**: Add `logger = structlog.get_logger(__name__)` and logging at INFO level for all state-changing operations (create, update, delete) and at WARNING/ERROR for exception paths. Prioritize: `health.py`, `invoices.py`, `purchase_orders.py`, `customers.py`, `contacts.py`.

Example for `health.py`:

```python
import structlog
logger = structlog.get_logger(__name__)

@router.get("/health")
async def health_check(db: ...) -> dict:
    try:
        await db.execute(text("SELECT 1"))
        logger.info("health_check.database_ok")
    except Exception as db_error:
        logger.error("health_check.database_failed", error=str(db_error))
        ...
```

### 4.3 MEDIUM — No Log Correlation (Request ID) in Route Handlers

`RequestIdMiddleware` is registered in `main.py`, which presumably adds a request ID to the response headers. However, none of the route handlers examined bind the request ID to the structlog context using `structlog.contextvars.bind_contextvars(request_id=...)`. This means logs from the same request cannot be correlated across log lines in a log aggregation tool.

**Recommendation**: In `RequestIdMiddleware`, add:

```python
structlog.contextvars.bind_contextvars(request_id=request_id)
```

This ensures all logs within a request automatically include the request ID.

### 4.4 MEDIUM — Logging Configuration Does Not Support Log Level via Environment

**File**: `apps/backend/src/utils/logging.py`, line 12

```python
log_level = logging.DEBUG if debug else logging.INFO
```

Log level is binary: DEBUG or INFO. There is no way to set WARNING or ERROR via environment variable without code changes. For a production service, operators need the ability to adjust verbosity (e.g., temporarily set DEBUG without redeploying).

**Recommendation**: Read `LOG_LEVEL` from settings:

```python
log_level = getattr(logging, settings.log_level.upper(), logging.INFO)
```

### 4.5 LOW — Frontend Has No Structured Logging

The frontend Next.js application has `LOG_LEVEL=info` in `.env.example` but there is no structured logging library configured. `console.log` statements in React components (called out by the agent PR checks workflow as a warning) are the only logging mechanism. For server-side Next.js API routes, `console.error` goes to Vercel's function logs but with no structure.

**Recommendation**: Integrate `pino` for server-side Next.js logging with JSON output format.

---

## 5. Health Endpoints

### 5.1 Endpoint Inventory

**File**: `apps/backend/src/api/routes/health.py`

| Endpoint                   | Function                                            |
| -------------------------- | --------------------------------------------------- |
| `GET /api/health`          | Checks API + database; returns degraded if DB fails |
| `GET /api/health/database` | Database-only check with 503 on failure             |
| `GET /api/health/routes`   | Confirms routing is working (trivial)               |
| `GET /api/ready`           | Kubernetes-style readiness check (DB dependency)    |

All four endpoints are properly registered and functional.

### 5.2 MEDIUM — Health Check Does Not Check Redis

The `/api/health` endpoint checks the database but not Redis. Redis is used for caching in the application. A Redis outage would cause silent cache misses (acceptable) but also may affect rate limiting (via `slowapi`) and session data. The health check returning "healthy" while Redis is down is misleading.

**Recommendation**: Add a Redis ping to the health check:

```python
from redis.asyncio import Redis
# Check redis
try:
    await redis_client.ping()
    checks["redis"] = "healthy"
except Exception:
    checks["redis"] = "unhealthy"
```

### 5.3 MEDIUM — Health Check Version is Hardcoded

**File**: `apps/backend/src/api/routes/health.py`, line 46

```python
checks["version"] = "1.0.0"
```

The version is hardcoded as `"1.0.0"`. In production, the `/api/health` endpoint should return the actual deployed version (git SHA or semantic version) so operators can confirm which version is running. This is critical during blue-green deployments.

**Recommendation**: Read version from a `VERSION` environment variable or embed the git SHA at build time:

```dockerfile
ARG GIT_SHA
ENV APP_VERSION=$GIT_SHA
```

### 5.4 LOW — No `/api/health` Liveness vs Readiness Distinction

The `/api/health` endpoint checks the database, making it a de facto readiness probe (fails if DB is unavailable). However, for Kubernetes/ECS deployment patterns, liveness and readiness are separate concepts:

- **Liveness**: Is the process alive? (Should never hit the DB)
- **Readiness**: Is the process ready to serve traffic? (Can check DB)

There is a `/api/ready` endpoint, but `/api/health` also checks the DB. If used as a liveness probe, a transient DB outage would cause container restarts — a cascading failure.

**Recommendation**: Add a `/api/live` endpoint that returns 200 immediately without any I/O:

```python
@router.get("/live")
async def liveness_check() -> dict:
    return {"status": "alive"}
```

And document which endpoint to use for liveness vs readiness in deployment configs.

### 5.5 POSITIVE — Prometheus Metrics Endpoint

`GET /metrics` (no `/api` prefix) is properly implemented using `prometheus_client.generate_latest()` with the correct `CONTENT_TYPE_LATEST` media type. Prometheus can scrape this directly.

### 5.6 POSITIVE — Alerting Rules Are Comprehensive

`monitoring/prometheus/alert-rules-prod.yml` contains well-structured alert rules covering:

- API p95 latency > 500ms (5m sustained)
- Error rate > 5% (5m sustained)
- CPU > 80% (10m sustained)
- Memory > 85% (10m sustained)
- PostgreSQL down (1m)
- Redis down (1m)
- Container memory > 80%/95% limits
- Container restart loops
- OOM kills

Inhibition rules correctly suppress warning alerts when critical alerts are firing, preventing alert storms.

---

## 6. Deployment Configuration

### 6.1 Vercel (Frontend)

The frontend deploys to Vercel. The CI workflow posts preview URLs to PRs. The `apps/web/Dockerfile` exists for Docker-based deployment, but production uses Vercel's native build pipeline (no Docker).

No `vercel.json` exists at the web app root (only in worktrees), so Vercel uses auto-detection. This is functional but means Vercel configuration (headers, rewrites, function regions) cannot be version-controlled.

**Recommendation**: Add a `vercel.json` to `apps/web/` with security headers (CSP, HSTS, X-Frame-Options), cache headers for static assets, and function region configuration.

### 6.2 Backend Deployment Model

The deployment workflows SSH into a server and run `docker compose`. This is a valid approach for a small team, but it has implications:

- **Single point of failure**: One server. No load balancing.
- **Deployment requires SSH secrets**: `PRODUCTION_SSH_KEY`, `PRODUCTION_SSH_HOST`, `PRODUCTION_SSH_USER` must all be configured in GitHub Secrets.
- **Migration runs inside the container**: `docker compose exec -T backend alembic upgrade head` runs after container start, which means a brief window where the new code runs against the old schema.

### 6.3 HIGH — Required GitHub Secrets Not Documented

The deploy workflows reference secrets that must be pre-configured in GitHub:

| Secret                | Used In                                                 |
| --------------------- | ------------------------------------------------------- |
| `PRODUCTION_SSH_KEY`  | deploy-production.yml, rollback.yml                     |
| `PRODUCTION_SSH_HOST` | deploy-production.yml, rollback.yml                     |
| `PRODUCTION_SSH_USER` | deploy-production.yml, rollback.yml                     |
| `STAGING_SSH_KEY`     | deploy-staging.yml, rollback.yml                        |
| `STAGING_SSH_HOST`    | deploy-staging.yml, rollback.yml                        |
| `STAGING_SSH_USER`    | deploy-staging.yml, rollback.yml                        |
| `PRODUCTION_API_URL`  | deploy-production.yml                                   |
| `STAGING_API_URL`     | deploy-staging.yml                                      |
| `SLACK_WEBHOOK_URL`   | deploy-staging.yml, deploy-production.yml, rollback.yml |
| `SNYK_TOKEN`          | security.yml                                            |

None of these are documented in a secrets inventory. If a team member needs to rotate or recreate these secrets, there is no reference for what values are expected.

**Recommendation**: Create a `docs/operations/SECRETS-INVENTORY.md` file listing each required secret, its purpose, format, and rotation schedule. Do not store actual values — only metadata.

### 6.4 MEDIUM — Staging Deploy Runs Tests Again (Redundant)

**File**: `.github/workflows/deploy-staging.yml`, job `test`

The staging deploy workflow re-runs the full test suite before building Docker images. This is redundant because staging only deploys after the CI workflow completes successfully (enforced by the `guard` job). Running tests a second time adds 5-10 minutes of pipeline time without additional confidence.

**Recommendation**: Remove the `test` job from `deploy-staging.yml`. The CI gate already ensures tests passed before staging deploys.

### 6.5 LOW — `smoke-tests.sh` Script Referenced but Not Committed

**File**: `.github/workflows/deploy-staging.yml`, line 353

```yaml
run: |
  chmod +x deployment/scripts/smoke-tests.sh
  ./deployment/scripts/smoke-tests.sh ${{ env.STAGING_URL }}
```

The smoke test script is referenced at `deployment/scripts/smoke-tests.sh` but this path does not exist in the repository. The `smoke-tests` job would fail immediately on any staging deployment.

**Recommendation**: Either commit the script or replace with inline curl commands (as done in the production smoke tests job).

### 6.6 LOW — Grafana Dashboard URLs Hardcoded to Localhost

**File**: `monitoring/alertmanager/config.yml`, lines 121-124

```html
<li>Check Grafana dashboards: <a href="http://localhost:3001">http://localhost:3001</a></li>
<li>
  Check Prometheus alerts: <a href="http://localhost:9090/alerts">http://localhost:9090/alerts</a>
</li>
```

Alert emails reference `http://localhost:3001` for Grafana. In production, these would be pointing to the wrong host. When an on-call engineer receives a critical alert at 3am, these links lead nowhere.

**Recommendation**: Parameterize with environment variables: `GRAFANA_URL` and `PROMETHEUS_URL`, configured per deployment environment.

---

## Summary of Issues by Priority

### Critical (Fix Immediately)

| ID   | Issue                                                      | File            | Impact                           |
| ---- | ---------------------------------------------------------- | --------------- | -------------------------------- |
| C-01 | Backend tests and migrations are `continue-on-error: true` | `ci.yml:95,106` | Broken code merges with green CI |
| C-02 | 15% coverage threshold is effectively no gate              | `ci.yml:107`    | No quality assurance on backend  |

### High (Fix This Sprint)

| ID   | Issue                                                          | File                       | Impact                                          |
| ---- | -------------------------------------------------------------- | -------------------------- | ----------------------------------------------- |
| H-01 | mypy backend type checking commented out in CI                 | `ci.yml:86-89`             | No backend type safety                          |
| H-02 | Third-party actions on floating `@master`                      | `security.yml:56,106,181`  | Supply-chain attack vector                      |
| H-03 | `NEXT_PUBLIC_` vars in backend .env.example                    | `backend/.env.example:4-5` | Namespace confusion, potential security issue   |
| H-04 | ~34% of route files have no logging                            | multiple routes            | No audit trail for business-critical operations |
| H-05 | `node-exporter` in Prometheus config but not in docker-compose | `docker-compose.yml`       | CPU/memory alerts never fire                    |
| H-06 | Required GitHub Secrets not documented                         | various deploy workflows   | Rotation/recovery impossible                    |

### Medium (Next Sprint)

| ID   | Issue                                                       | File                      | Impact                                   |
| ---- | ----------------------------------------------------------- | ------------------------- | ---------------------------------------- |
| M-01 | No Redis health check in `/api/health`                      | `health.py`               | Health check misleads on Redis outage    |
| M-02 | Version hardcoded as `"1.0.0"` in health endpoint           | `health.py:46`            | Cannot confirm deployed version          |
| M-03 | No request ID binding to structlog context                  | `main.py`                 | Log correlation impossible               |
| M-04 | Log level not configurable via env var                      | `utils/logging.py`        | Cannot adjust verbosity without redeploy |
| M-05 | `uv` version unpinned in CI (`'latest'`)                    | `ci.yml:63,354`           | CI/prod dependency drift                 |
| M-06 | Staging deploy re-runs full test suite                      | `deploy-staging.yml`      | Wasted 5-10 min per deploy               |
| M-07 | Grafana default password `admin` when env not set           | `docker-compose.yml:143`  | Security if Grafana exposed              |
| M-08 | Actual Supabase project ref committed in production example | `.env.production.example` | Infrastructure exposure                  |

### Low (Backlog)

| ID   | Issue                                                       | File                        | Impact                              |
| ---- | ----------------------------------------------------------- | --------------------------- | ----------------------------------- |
| L-01 | Hardcoded `sleep` timers in deploy workflows                | deploy-\*.yml               | Fragile timing                      |
| L-02 | Inline rollback doesn't pull correct Docker image           | `deploy-production.yml:366` | May run wrong image after rollback  |
| L-03 | No `vercel.json` for security headers                       | `apps/web/`                 | Missing HSTS, CSP headers           |
| L-04 | `smoke-tests.sh` script missing                             | `deploy-staging.yml:353`    | Staging smoke tests always fail     |
| L-05 | No liveness-only endpoint (`/api/live`)                     | `health.py`                 | DB check in liveness causes cascade |
| L-06 | Alertmanager emails use localhost URLs                      | `alertmanager/config.yml`   | Links unusable in production alerts |
| L-07 | `DATABASE_URL` missing from backend `.env.example`          | `backend/.env.example`      | New developer confusion             |
| L-08 | No frontend structured logging                              | `apps/web/`                 | No structured server-side logs      |
| L-09 | Backend runs 2 workers (may conflict with in-process state) | `Dockerfile:68`             | Potential state corruption          |
| L-10 | PR preview URL pattern is guessed, not fetched              | `ci.yml:233`                | Stale/wrong preview links in PRs    |

---

## Metrics Dashboard

```
CI/CD PIPELINE
==============
Workflow files:          6
Jobs (total):           ~35
Non-blocking gates:      2  (CRITICAL — backend tests + migration)
Coverage threshold:     15% (CRITICAL — industry standard: 70-80%)
mypy enabled in CI:     No  (HIGH — commented out)
Actions on @master:      3  (HIGH — supply chain risk)
uv version pinned:      No  (CI uses 'latest', Dockerfile uses '0.5.5')
Hardcoded sleep cmds:    9  (across 3 workflow files)

ENVIRONMENT CONFIGURATION
=========================
.env.example files:       3  (backend, backend-production, frontend)
Total env vars documented: ~95
NEXT_PUBLIC_ vars in backend config: 4  (HIGH — namespace confusion)
DATABASE_URL in backend example: No  (LOW — missing key variable)
Secrets documented:       No  (HIGH — no secrets inventory)

DOCKER/CONTAINER
================
Multi-stage Dockerfiles:   2  (backend + frontend)
Non-root users:            2  (both Dockerfiles)
Health checks in compose:  3  (postgres, redis, backend)
Resource limits:           All services defined
node-exporter in compose:  No  (HIGH — Prometheus scrape target missing)
Grafana default password:  Yes (MEDIUM — 'admin' when env not set)

LOGGING
=======
Logging framework:        structlog (correct choice)
JSON in production:       Yes
Request ID middleware:    Registered (not bound to log context)
Routes with logging:     ~39/59  (66%)
Routes without logging:  ~20/59  (34% — HIGH)
Frontend structured logs: No

HEALTH ENDPOINTS
================
/api/health:      Exists (DB check, no Redis check)
/api/health/database: Exists
/api/health/routes:   Exists
/api/ready:       Exists (readiness)
/api/live:        Missing (liveness-only)
/metrics:         Exists (Prometheus)
Version in health: Hardcoded "1.0.0"

MONITORING
==========
Prometheus:       Configured (7 scrape jobs, 1 broken — node-exporter)
Grafana:          8 dashboards provisioned
Alertmanager:     Configured (email + optional Slack)
Alert rules:      ~15 rules (CPU, memory, DB, Redis, containers, API)
Slack alerts:     Commented out (optional, requires SLACK_WEBHOOK_URL)
Alert email URLs: Hardcoded to localhost (LOW)
```

---

## Verification Checklist

Before marking this audit resolved, verify:

1. **C-01/C-02**: Remove `continue-on-error` from ci.yml backend test job. Confirm CI fails on test failure. Raise coverage threshold.
2. **H-01**: Uncomment mypy in ci.yml. Confirm it runs and does not block until errors are fixed.
3. **H-02**: Pin Snyk and Trivy actions to specific commit SHAs. Confirm security.yml still runs.
4. **H-03**: Remove `NEXT_PUBLIC_` vars from `apps/backend/.env.example`. Confirm backend settings model reads correct var names.
5. **H-04**: Add `logger = structlog.get_logger(__name__)` to the 20 route files that lack it. Confirm structured log output in development.
6. **H-05**: Add `node-exporter` service to `docker-compose.yml`. Confirm Prometheus shows `up{job="node"}=1`.
7. **H-06**: Create `docs/operations/SECRETS-INVENTORY.md`. Confirm all deploy workflow secrets are listed.
8. **M-04**: Verify the smoke test script exists at `deployment/scripts/smoke-tests.sh` or replace with inline checks.

---

**Audit completed**: 2026-03-24
