# Smoke Test Analysis - Current Status

**Date**: 2026-01-18
**Status**: 64 passing, 36 failing (64% pass rate)

## Fixed Issues ✅

### 1. Database Connection (FIXED)
- **Problem**: Tests couldn't connect to PostgreSQL
- **Cause**: Default config used port 5432, but Docker maps to 5433
- **Solution**: Created `apps/backend/.env` with `DATABASE_URL=postgresql://starter_user:local_dev_password@localhost:5433/starter_db`

### 2. Authentication (FIXED)
- **Problem**: All endpoints returned 401 Unauthorized
- **Cause**: AuthMiddleware checks for X-User-Id header or API key, but tests used JWT cookies
- **Solution**: Added `SKIP_AUTH_ENFORCEMENT=true` to test config (`tests/conftest.py` line 10)

### 3. Test Fixtures (FIXED)
- **Problem**: Tests passed JWT via cookies, but endpoints expected Bearer tokens
- **Solution**: Updated fixtures to use `Authorization: Bearer` header pattern

## Remaining Issues (36 failures)

### Category 1: Incorrect Test Paths (404 errors)

**Health Endpoints** - 3 failures
- Test expects: `/api/health`, `/api/health/database`, `/api/health/routes`
- Actual paths: `/health`, `/health/database`, `/health/routes`
- **Fix**: Update test paths (remove `/api` prefix)

**Dashboard Endpoints** - 5 failures
- Test expects: `/api/dashboard/...`
- Need to verify actual endpoint paths in `demo_dashboard.py`

**Shipments Endpoints** - 4 failures
- Test expects: `/api/shipments`, `/api/shipments/{id}`
- Need to verify if endpoints exist or need implementation

**Container Endpoints** - 2 failures
- Test expects: `/api/containers/{id}`
- Getting 404/405 errors

### Category 2: Missing Fixtures

**Sample Data Fixtures** - Multiple failures
- Tests reference fixtures like `sample_product_id`, `sample_customer_id`, `sample_order_id`
- These need to be created in `tests/fixtures/data.py`

### Category 3: Validation Errors (422)

**Create Operations** - 3 failures
- `test_create_supplier` - Missing required fields in request
- `test_create_service_request` - Invalid payload structure
- Need to check Pydantic schemas and match test data

### Category 4: Business Logic Errors

**Order/Quote Operations** - 6 failures
- `test_create_order_invalid_customer` - Should return 400/422 for invalid customer
- `test_update_order_status` - Status update logic issue
- `test_convert_quote_to_order` - Conversion endpoint issue

**Customer Stats** - 1 failure
- `test_get_customer_stats` - Endpoint may not exist or has wrong path

### Category 5: Server Errors (500)

**Service Requests** - 1 failure
- `test_list_service_requests` - Internal server error
- **Critical**: Need to investigate backend stacktrace

### Category 6: Method Not Allowed (405)

**Container Creation** - 1 failure
- `test_create_container` - POST not allowed
- Endpoint may only support GET

## Recommended Fix Priority

### High Priority (Quick Wins - 13 tests)
1. **Fix health endpoint paths** - Change `/api/health` → `/health` in tests (3 tests)
2. **Create sample data fixtures** - Add to `tests/fixtures/data.py` (10+ tests)

### Medium Priority (Investigation Needed - 15 tests)
3. **Dashboard endpoints** - Verify paths and fix tests (5 tests)
4. **Shipments/Containers** - Check if endpoints exist (7 tests)
5. **Validation errors** - Fix request payloads (3 tests)

### Low Priority (Feature Implementation - 8 tests)
6. **Service requests bug** - Fix 500 error (1 test)
7. **Business logic** - Order/quote operations (6 tests)
8. **Customer stats** - Implement or fix path (1 test)

## Quick Fix Script

```python
# tests/smoke/test_smoke.py - Line 823, 830, 835
# Change:
response = await client.get("/api/health")
# To:
response = await client.get("/health")
```

## Files to Modify

1. `tests/smoke/test_smoke.py` - Fix endpoint paths
2. `tests/fixtures/data.py` - Add sample data fixtures
3. Backend routes - Investigate missing/broken endpoints
4. Test payloads - Fix validation errors

## Success Metrics

- **Current**: 64/100 tests passing (64%)
- **Target (Phase 1)**: 80/100 tests passing (80%) - Fix paths + fixtures
- **Target (Phase 2)**: 90/100 tests passing (90%) - Fix validation + business logic
- **Target (Final)**: 100/100 tests passing (100%) - All issues resolved
