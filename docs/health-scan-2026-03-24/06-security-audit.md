# Security Engineer Health Audit

**Audit Date**: 2026-03-24
**Auditor**: Senior Security Engineer (15+ years experience)
**Scope**: Authentication, authorization, CORS, injection prevention, dependency security

---

## Executive Summary

**Overall Security Grade: B+**

The CCW-ERP-CRM codebase demonstrates a mature security posture for an internal ERP system. The development team has implemented defense-in-depth with rate limiting, security headers, HMAC timing-safe comparisons, bcrypt password hashing, and environment-driven secrets management. No hardcoded production credentials or real API keys were found in source files.

However, four issues require remediation before this system is suitable for any external-facing deployment:

1. **HIGH**: The `X-User-Id` header is trusted without cryptographic verification — any HTTP client can impersonate any user ID.
2. **HIGH**: Swagger UI (`/docs`) and OpenAPI schema (`/openapi.json`) are publicly accessible in production with no auth guard.
3. **MEDIUM**: The Prometheus `/metrics` endpoint is entirely unauthenticated and exposes business intelligence (order counts, revenue, agent metrics) publicly.
4. **MEDIUM**: `productionBrowserSourceMaps: true` in `next.config.ts` exposes application logic to end users in production builds.

No CRITICAL (exploitable remote code execution or authentication bypass leading to full admin takeover) issues were identified.

---

## 1. Authentication & JWT

### Findings

**Algorithm**: HS256 (symmetric HMAC-SHA256). Acceptable for internal systems where the signing key never leaves the server. Would recommend HS512 or RS256 for higher-assurance deployments.

**Secret Key Enforcement**: The `validate_production_secrets()` method in `settings.py` (line 450) enforces `len(jwt_secret_key) >= 32` for production and staging environments. The `get_jwt_secret_secure()` method (line 370) falls back to the string `"dev-jwt-secret-not-for-production"` for development. The enforcement is correct but relies on the caller invoking `validate_production_secrets()` at startup — this is not automatically called in `main.py`, meaning a misconfigured production deployment could silently use a weak key.

**Token Expiry**:

- Access tokens: 480 minutes (8 hours) — acceptable for an internal ERP
- Refresh tokens: 30 days — long but common for enterprise internal tools
- Refresh token type-claim check (`payload.get("type") != "refresh"`) is correctly implemented

**Token Revocation**: No token blacklist or JTI (JWT ID) revocation mechanism exists. A stolen access token remains valid for up to 8 hours even after a user logs out or changes their password. Logout simply deletes the client-side cookie; the server-side token is not invalidated. For an internal ERP this is an acceptable risk.

**Cookie Security**:

- `httponly=True` on both `auth_token` and `refresh_token` cookies — correct, prevents XSS token theft
- `samesite="lax"` — adequate CSRF protection for standard navigation flows
- `secure` flag: conditionally set via `settings.should_use_secure_cookies`, which evaluates `True` in production/staging. Correct.
- `domain="localhost"` is hardcoded on both cookies (lines 141, 153). This value is appropriate for local dev but must be overridden in production deployments to the real domain. If this setting reaches production unchanged, it would break cross-subdomain cookie delivery.

**X-User-Id Header Bypass (HIGH)**:

In `auth.py` (lines 96–100):

```python
user_id = request.headers.get("X-User-Id")
if user_id:
    request.state.user_id = user_id
    request.state.auth_type = "user"
    return await call_next(request)
```

Any unauthenticated HTTP client that sends `X-User-Id: <any UUID>` will bypass all JWT/API-key validation and be granted access as that user. The frontend client (`client.ts` line 177) sends this header alongside a valid JWT, but the middleware processes `X-User-Id` as a fallback for requests that already failed JWT validation. This means a malicious actor without a token can set `X-User-Id` to any known user ID and authenticate. This is a **HIGH severity** authentication bypass.

### Recommendations

- Remove the `X-User-Id` header auth path entirely, or gate it behind a valid JWT (currently the fallback runs when JWT is absent or invalid).
- Add `validate_production_secrets()` call during application startup in `lifespan()` and raise on failure.
- Remove the hardcoded `domain="localhost"` from cookie settings; derive from `settings.cors_origins` or a dedicated `cookie_domain` setting.
- Consider implementing JTI-based token revocation using Redis (which is already in the stack) for the logout flow.

---

## 2. CORS Configuration

### Findings

CORS is configured in `main.py` (lines 392–398):

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

`settings.cors_origins` defaults to six localhost origins. The comment in `settings.py` (line 121) correctly instructs operators to override via `CORS_ORIGINS` environment variable in production. No wildcard `"*"` is hardcoded.

**`allow_credentials=True` with `allow_methods=["*"]` and `allow_headers=["*"]`**: When `allow_credentials` is true, browsers will include cookies on cross-origin requests. The combination of wildcard methods and headers with credentials is permissive but not exploitable when `allow_origins` is a specific list (browsers enforce the same-origin policy on responses with credentials). This is acceptable.

**`allow_methods=["*"]`**: Includes `DELETE`, `PATCH`, `PUT`, and `OPTIONS` globally. No individual route-level restriction. Acceptable for an internal API but slightly over-permissive.

**Production concern**: If `CORS_ORIGINS` is not set in the production environment, the API will accept requests only from `localhost:3000–3005`, effectively blocking all production frontend requests. This would cause a full service outage rather than a security breach, but it represents a deployment risk.

### Recommendations

- Add `CORS_ORIGINS` to production deployment checklist and environment variable validation at startup.
- Consider restricting `allow_methods` to `["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]` (explicit list) rather than `["*"]`.

---

## 3. SQL Injection Prevention

### Findings

No SQL injection vulnerabilities were found. All database queries use SQLAlchemy ORM or parameterized `text()` calls.

**SQLAlchemy text() usage** — all usages were audited:

| File                         | Usage                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `health.py`                  | `text("SELECT 1")` — static literal, no user input                           |
| `orders.py`                  | `text("SELECT generate_order_number()")` — static stored proc call           |
| `pos_transactions.py`        | `text("SELECT generate_pos_transaction_number()")` — static stored proc call |
| `quotes.py`                  | `text("SELECT generate_quote_number()")` — static stored proc call           |
| `translations.py`            | `text(...)` import — no user input interpolated into raw SQL found           |
| `recommendation_service.py`  | `text(...)` import — vector similarity queries                               |
| `semantic_search_service.py` | `text(...)` import — semantic search queries                                 |

No f-string interpolation into `text()` calls was found. Zero occurrences of `text(f"SELECT...{user_input}")` patterns.

**ORM usage**: The vast majority of queries use `select()`, `filter()`, `where()` with bound parameters via SQLAlchemy 2.0, which parameterizes all values automatically.

### Recommendations

- No immediate action required.
- Add a pre-commit or CI lint rule to flag `text(f"` patterns as a preventive measure.

---

## 4. Input Validation

### Findings

**Pydantic v2** is used project-wide. All POST/PUT endpoints examined use Pydantic request models:

- `demo_auth.py`: `LoginRequest`, `ForgotPasswordRequest`, `ResetPasswordRequest`, `ChangePasswordRequest`, `UpdateProfileRequest` — all Pydantic BaseModel subclasses
- `products.py`, `customers.py`, `orders.py`, `quotes.py`, `invoices.py`, `purchase_orders.py`: all use Pydantic request/response schemas
- `email-validator>=2.0.0` is installed and `EmailStr` is used on email fields

**FastAPI validation middleware** (`RequestValidationError` handler in `main.py` line 385) returns structured JSON errors for all validation failures, preventing error message information leakage.

**Shopify schema example values** (lines 255–257 in `shopify_schemas.py`): Placeholder values `"xxxxx"` appear in docstring examples for `api_key`, `api_secret`, and `webhook_secret`. These are documentation examples, not real credentials.

**Potential concern — weak field constraints**: Some Pydantic models use `min_length=1` (e.g., `ShopifyConnectionCreate.api_key`) without format validation. This permits single-character inputs. This is a minor data quality concern rather than a security vulnerability since the field is not used in SQL.

### Recommendations

- No critical action required.
- Consider adding stricter regex validators on external-facing credential fields (Shopify tokens, API keys) to enforce known formats.

---

## 5. Secrets Management

### Findings

**No hardcoded production credentials found** in `apps/backend/src/**/*.py`.

**Development credentials found** (expected and acceptable):

- `"local_dev_password"` as default `database_url` in `settings.py` (line 126) — development default only
- `"demo123"` in `seed_demo.py`, `demo_auth.py`, and utility scripts — intentional demo/local credentials
- `"dev-jwt-secret-not-for-production"` as fallback in `get_jwt_secret_secure()` (line 395) — only returned in non-production environments

**Secrets loading chain** (well-designed):

1. Docker secret file (via `_FILE` env var suffix)
2. Direct environment variable
3. AWS Secrets Manager (production path)
4. Development defaults (non-production only)

**`validate_production_secrets()`** correctly checks JWT key length ≥ 32, database password presence, and Fernet key length for production/staging.

**Utility scripts contain hardcoded dev credentials** in the repository root:

- `apps/backend/apply_indexes.py` (line 13): `postgresql+asyncpg://starter_user:local_dev_password@localhost:5432/starter_db`
- `apps/backend/create_admin.py` (line 13): same pattern, and line 39 contains `pwd_context.hash("demo123")`
- `apps/backend/check_orders.py`, `create_demo_orders_simple.py`, `scripts/seed_ccw_products.py`: same dev DB URL

These files are development utility scripts and do not run in production, but they should ideally use environment variables rather than hardcoded defaults, as they establish a pattern that could be replicated in production code.

**`backend_api_key`** defaults to `""` (empty string). The auth middleware (line 89) only grants access if `token == settings.backend_api_key and settings.backend_api_key` — the second condition prevents empty-string bypass. Correct.

### Recommendations

- Add `validate_production_secrets()` to the application startup sequence with a hard exit on failure in production.
- Migrate utility scripts to use environment variables for DB credentials rather than hardcoded strings.
- Ensure `.env` files are in `.gitignore` (standard practice — verify with `git ls-files .env*`).

---

## 6. Dependency Security

### Findings

All version constraints use `>=` (minimum version, no upper bound). Current stated minimums:

| Package                     | Minimum Version | Known CVEs at minimums                                                                                                 | Notes                                                                                                                |
| --------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `fastapi`                   | `>=0.115.0`     | None at 0.115.x                                                                                                        | Current stable is 0.115.x — up to date                                                                               |
| `sqlalchemy`                | `>=2.0.0`       | None in 2.0.x+                                                                                                         | SQLAlchemy 2.x is actively maintained                                                                                |
| `pydantic`                  | `>=2.9.0`       | None at 2.9.x                                                                                                          | Current stable is 2.9.x — up to date                                                                                 |
| `python-jose[cryptography]` | `>=3.3.0`       | **CVE-2024-33664, CVE-2024-33663**                                                                                     | python-jose has known JWT algorithm confusion vulnerabilities. Migrating to `joserfc` or `python-jwt` is recommended |
| `passlib[bcrypt]`           | `>=1.7.0`       | passlib is unmaintained since 2023. The `bcrypt` backend functions correctly but the package has no active maintainer. |
| `cryptography`              | Transitive dep  | Ensure `>=42.0.0` to avoid `CVE-2023-49083` and related issues                                                         |
| `stripe`                    | `>=7.0.0`       | None in 7.x+                                                                                                           | Up to date                                                                                                           |
| `httpx`                     | `>=0.27.0`      | None at 0.27.x                                                                                                         | Up to date                                                                                                           |
| `uvicorn[standard]`         | `>=0.32.0`      | None at 0.32.x                                                                                                         | Up to date                                                                                                           |

**`python-jose` vulnerability note**: CVE-2024-33664 and CVE-2024-33663 involve algorithm confusion attacks where an attacker can force the library to accept `None` as the algorithm. The codebase correctly specifies `algorithms=["HS256"]` in every `jwt.decode()` call (reviewed in `auth/jwt.py` lines 73 and 134), which mitigates the algorithm confusion attack even on vulnerable versions of python-jose. The risk is **reduced but not eliminated** — migration to an actively maintained library is still recommended.

**`passlib` maintenance status**: The passlib package has not been updated since 2023 and has no active maintainer. The bcrypt wrapper works correctly, but any future bcrypt API changes could break compatibility silently. Direct use of the `bcrypt` package (already in the dependency tree as a transitive dep) should be considered as a replacement.

### Recommendations

- **Medium priority**: Replace `python-jose` with `joserfc>=0.9.0` or pin to a patched fork. The current `algorithms=["HS256"]` mitigation reduces exploit likelihood but does not eliminate the CVE.
- **Low priority**: Evaluate replacing `passlib[bcrypt]` with direct `bcrypt` package usage, given passlib's maintenance status.
- Add `pip-audit` or `safety` to the CI pipeline to catch CVEs on each dependency update.
- Pin a minimum version for `cryptography` (e.g., `cryptography>=42.0.0`) explicitly in `pyproject.toml`.

---

## 7. Rate Limiting

### Findings

Rate limiting is implemented via `slowapi` with the following configuration:

```
Default global limit: 60 requests/minute per key
LOGIN:           5/minute
REGISTER:        3/hour
PASSWORD_RESET:  3/hour
CHANGE_PASSWORD: 5/hour
REFRESH:         10/minute
READ:            100/minute
WRITE:           30/minute
DELETE:          10/minute
PUBLIC:          20/minute
```

**Auth endpoints are rate-limited**: `demo_auth.py` applies `@limiter.limit(RateLimits.LOGIN)` on the login endpoint (line 78), password reset (line 312), refresh (line 220), and change password (line 479). This is correct and sufficient to prevent brute-force attacks.

**Rate limit key function** (`rate_limit.py` lines 15–38): Keys authenticated requests by `user_id` and anonymous requests by IP address. This prevents authenticated users from being affected by IP-based rate limit abuse by other users sharing the same NAT/proxy IP.

**Redis backend**: When `cache_enabled=True`, limits are stored in Redis, enabling shared state across multiple API instances. Falls back to `"memory://"` when Redis is unavailable — this means rate limits are per-process (not shared) if Redis goes down, reducing protection under failure conditions.

**Gap — most non-auth routes have no explicit `@limiter.limit()` decorator**: Only `demo_auth.py` and `marketplace.py` use the rate limit decorator. All other routes rely solely on the default 60/min global limit set in the `Limiter` constructor. This global default applies, but granular per-endpoint limits (tighter limits on destructive DELETE operations, looser limits on health checks) are not enforced on individual routes.

**`rate_limit_enabled` flag**: Can be set to `False` via environment variable, disabling all rate limiting. This should be validated to never be `False` in production.

### Recommendations

- Add rate limit validation to the production startup check.
- Apply explicit `@limiter.limit(RateLimits.DELETE)` and `@limiter.limit(RateLimits.WRITE)` decorators to at least the highest-value destructive endpoints (customer delete, order cancel, invoice void).
- Document the Redis-down fallback behavior so operators are aware rate limits become per-process under Redis failure.

---

## 8. Security Headers

### Findings

**Backend (`security_headers.py`)**: Applies on all API responses:

| Header                      | Value                                                                    | Assessment                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`   | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'...` | `unsafe-inline` and `unsafe-eval` in `script-src` significantly weaken XSS protection. Acceptable for a backend API that returns JSON (no HTML rendering), but should not be present on frontend. |
| `X-Frame-Options`           | `DENY`                                                                   | Correct — prevents clickjacking                                                                                                                                                                   |
| `X-Content-Type-Options`    | `nosniff`                                                                | Correct                                                                                                                                                                                           |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                                        | Correct                                                                                                                                                                                           |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=()`                               | Correct                                                                                                                                                                                           |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload`                           | Correct — production only, includes preload                                                                                                                                                       |

**Frontend (`next.config.ts`)**: Applies via `async headers()`:

| Header                      | Value                                                | Assessment                                                                                                                                            |
| --------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy`   | `script-src 'self' 'unsafe-inline' 'unsafe-eval'...` | **MEDIUM**: `unsafe-inline` and `unsafe-eval` in the frontend CSP negate most XSS protection. A nonce-based or hash-based approach should be adopted. |
| `X-Frame-Options`           | `DENY`                                               | Correct                                                                                                                                               |
| `X-Content-Type-Options`    | `nosniff`                                            | Correct                                                                                                                                               |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                    | Correct                                                                                                                                               |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=()`           | Correct                                                                                                                                               |
| `Strict-Transport-Security` | **Missing**                                          | **MEDIUM**: HSTS is absent from `next.config.ts`. The backend adds it for production, but the Next.js frontend does not.                              |

**`productionBrowserSourceMaps: true` (HIGH for production)**:

`next.config.ts` line 13 enables production browser source maps. This exposes the full TypeScript source code to anyone opening browser developer tools on the production site. This reveals:

- Internal component structure and logic
- API endpoint paths and request/response shapes
- Potentially sensitive business logic (pricing calculations, discount rules, workflow conditions)

The comment says "Sentry needs these" — Sentry can use _server-side_ source maps without exposing them to browsers. The `hideSourceMaps: true` option in the Sentry config (line 108) is intended to hide maps from client bundles, but `productionBrowserSourceMaps: true` overrides this for the browser bundle.

**Swagger UI publicly accessible**:

`main.py` line 288 sets `docs_url="/docs"` with no environment-based conditional. The `/docs` and `/openapi.json` paths are listed in `AuthMiddleware.PUBLIC_PATHS` (line 27: `"/docs"`, `"/openapi.json"`), meaning they are accessible without authentication in production. This exposes the full API schema, all endpoint paths, request/response shapes, and authentication requirements to unauthenticated users.

**Prometheus `/metrics` endpoint publicly accessible**:

The `/metrics` endpoint is in `PUBLIC_PATHS` (line 23 of `auth.py`) and has no authentication in `prometheus_metrics.py`. The metrics expose business intelligence including order counts, revenue figures, AI agent performance, integration sync rates, and infrastructure health. An external actor can scrape this endpoint continuously to monitor business activity.

### Recommendations

1. **Source maps**: Set `productionBrowserSourceMaps: false` in `next.config.ts`. Sentry integration should use server-side upload only.
2. **Swagger UI**: Conditionally disable in production: `docs_url="/docs" if not settings.is_production else None`.
3. **Prometheus metrics**: Add IP allowlist or token-based auth on `/metrics`. At minimum, remove it from `PUBLIC_PATHS` and protect it with a dedicated scraper API key.
4. **Frontend HSTS**: Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` to the `/:path*` headers block in `next.config.ts`.
5. **CSP hardening**: Replace `unsafe-inline`/`unsafe-eval` with nonce-based CSP using Next.js middleware. This is a larger refactor but is the correct long-term approach for XSS prevention.

---

## Summary of Issues by Priority

### HIGH

| ID  | Issue                                                                         | Location                                         | Impact                                                                   |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| H1  | `X-User-Id` header accepted without JWT verification — authentication bypass  | `apps/backend/src/api/middleware/auth.py:96–100` | Any unauthenticated client can impersonate any known user ID             |
| H2  | `productionBrowserSourceMaps: true` exposes full TypeScript source to browser | `apps/web/next.config.ts:13`                     | Application logic, API paths, and business rules are visible in devtools |

### MEDIUM

| ID  | Issue                                                               | Location                                             | Impact                                                                      |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------- |
| M1  | Swagger UI (`/docs`, `/openapi.json`) unauthenticated in production | `apps/backend/src/api/main.py:288` + `auth.py:26–27` | Full API schema exposed to unauthenticated actors                           |
| M2  | Prometheus `/metrics` endpoint unauthenticated                      | `apps/backend/src/api/routes/prometheus_metrics.py`  | Business metrics (revenue, orders, AI performance) publicly readable        |
| M3  | Frontend CSP uses `unsafe-inline` and `unsafe-eval`                 | `apps/web/next.config.ts:63–64`                      | XSS mitigation significantly weakened                                       |
| M4  | HSTS missing from Next.js frontend headers                          | `apps/web/next.config.ts`                            | Browser can be downgraded to HTTP on first visit                            |
| M5  | `python-jose` has CVE-2024-33664/33663 (algorithm confusion)        | `apps/backend/pyproject.toml`                        | Mitigated by explicit `algorithms=["HS256"]` but library should be replaced |
| M6  | `passlib` is unmaintained since 2023                                | `apps/backend/pyproject.toml`                        | No active security patches for the password hashing wrapper                 |
| M7  | `validate_production_secrets()` not called at startup               | `apps/backend/src/api/main.py`                       | Misconfigured production secrets fail silently                              |

### LOW

| ID  | Issue                                                                     | Location                                           | Impact                                                                              |
| --- | ------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| L1  | No JWT token revocation mechanism                                         | `apps/backend/src/auth/jwt.py`                     | Stolen tokens valid for up to 8 hours after logout                                  |
| L2  | `domain="localhost"` hardcoded in cookie `set_cookie()` calls             | `apps/backend/src/api/routes/demo_auth.py:141,153` | Must be overridden in production or cookies will not be scoped to production domain |
| L3  | Dev utility scripts have hardcoded DB credentials                         | Multiple files in `apps/backend/` root             | Dev credentials in codebase; not a production risk but sets a poor pattern          |
| L4  | Rate limits not applied to individual high-value destructive routes       | Various route files                                | Only global 60/min limit protects bulk-delete and order-cancel operations           |
| L5  | No `pip-audit` / `safety` in CI pipeline                                  | `.github/workflows/ci.yml`                         | Dependency CVEs not automatically detected                                          |
| L6  | `rate_limit_enabled` can be disabled via env var with no production guard | `apps/backend/src/config/settings.py:196`          | Rate limiting can be disabled in production accidentally                            |

### INFORMATIONAL

| ID  | Issue                                                   | Notes                                                                           |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| I1  | HS256 used instead of RS256                             | Acceptable for internal system; RS256 preferred for external/federated identity |
| I2  | `allow_methods=["*"]` and `allow_headers=["*"]` in CORS | Permissive but safe when `allow_origins` is a specific list                     |
| I3  | Refresh tokens are 30 days with no rotation mechanism   | Long-lived but stored HttpOnly; acceptable for internal ERP                     |

---

## Metrics Dashboard

| Category             | Score  | Issues Found | Critical | High  | Medium | Low   |
| -------------------- | ------ | ------------ | -------- | ----- | ------ | ----- |
| Authentication & JWT | B      | 4            | 0        | 1     | 0      | 3     |
| CORS Configuration   | A-     | 1            | 0        | 0     | 1      | 0     |
| SQL Injection        | A+     | 0            | 0        | 0     | 0      | 0     |
| Input Validation     | A      | 0            | 0        | 0     | 0      | 0     |
| Secrets Management   | A-     | 1            | 0        | 0     | 1      | 1     |
| Dependency Security  | B+     | 2            | 0        | 0     | 2      | 1     |
| Rate Limiting        | B+     | 2            | 0        | 0     | 0      | 2     |
| Security Headers     | B      | 5            | 0        | 1     | 4      | 0     |
| **TOTAL**            | **B+** | **15**       | **0**    | **2** | **8**  | **7** |

| Metric                           | Value                                           |
| -------------------------------- | ----------------------------------------------- |
| HMAC timing-safe comparisons     | 11 of 11 usages correct (`hmac.compare_digest`) |
| Hardcoded production credentials | 0 found                                         |
| SQL injection vectors            | 0 found                                         |
| Pydantic validation coverage     | All POST/PUT endpoints covered                  |
| Auth endpoints rate-limited      | Yes (5/min login, 3/hr reset)                   |
| HttpOnly on auth cookies         | Yes                                             |
| Secure flag on auth cookies      | Yes (production/staging)                        |
| HSTS (backend)                   | Yes (production)                                |
| HSTS (frontend)                  | No — missing                                    |
| Swagger UI auth-gated            | No — publicly accessible                        |

---

**Audit completed**: 2026-03-24
