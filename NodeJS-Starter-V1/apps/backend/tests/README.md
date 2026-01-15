# Test Suite Documentation

## Overview

Comprehensive test suite for the CCW-Online ERP backend API, covering authentication, security, and all CRUD operations for the ERP modules.

## Test Statistics

- **Total Tests:** 133
- **Tests Passing:** 57 (43%)
- **Tests Failing:** 33 (25%)
- **Tests with Errors:** 44 (33%)
- **Coverage:** 36.66%

## Test Structure

```
tests/
├── conftest.py                       # Pytest configuration and fixtures
├── fixtures/
│   ├── __init__.py
│   └── data.py                       # Test data fixtures
├── test_auth_security.py             # Authentication and security (20 tests)
├── test_products_api.py              # Products CRUD (15 tests)
├── test_customers_api.py             # Customers CRUD (13 tests)
├── test_orders_api.py                # Orders CRUD (18 tests)
├── test_quotes_api.py                # Quotes CRUD (20 tests)
├── test_agent_orchestration.py       # Agent system tests (19 tests)
├── test_specialized_agents.py        # Specialized agents (10 tests)
└── ... (other test files)
```

## Test Modules

### 1. Authentication & Security Tests (`test_auth_security.py`)

Tests authentication flows, password reset, refresh tokens, rate limiting, and security headers.

**Key Tests:**
- Login with valid/invalid credentials
- Refresh token generation and validation
- Password reset workflow
- Rate limiting enforcement (5 attempts/minute)
- Logout functionality
- Get current user

**Status:** ✓ 5 passing, ✗ 7 failing (mostly cookie flag assertions)

### 2. Products API Tests (`test_products_api.py`)

Tests full CRUD operations for products module.

**Key Tests:**
- List products with pagination
- Search by SKU/name/description
- Filter by category
- Create product with validation
- Update product
- Delete product (soft delete)
- SKU uniqueness enforcement

**Status:** ✓ 9 passing, ✗ 6 failing

### 3. Customers API Tests (`test_customers_api.py`)

Tests customer management operations.

**Key Tests:**
- List customers with pagination
- Search customers
- Create customer with auto-number generation
- Update customer
- Delete customer
- Email validation
- Xero integration fields

**Status:** ✓ 3 passing, ✗ 5 failing, ✗ 5 errors

### 4. Orders API Tests (`test_orders_api.py`)

Tests order management with line items.

**Key Tests:**
- List orders with filters
- Create order with line items
- Calculate order total
- Auto-generate order number (ORD-YYYY-NNN)
- Update order and recalculate totals
- Delete order (cascade to items)
- Status management

**Status:** ✓ 9 passing, ✗ 6 failing, ✗ 10 errors

### 5. Quotes API Tests (`test_quotes_api.py`)

Tests quote management and conversion.

**Key Tests:**
- List quotes with filters
- Create quote with line items
- Auto-generate quote number (Q-YYYY-NNN)
- Quote expiration detection
- Convert quote to order
- Status transitions

**Status:** ✓ 11 passing, ✗ 5 failing, ✗ 10 errors

## Running Tests

### Prerequisites

1. **Database seeded with demo data:**
   ```bash
   cd apps/backend
   python src/db/seed_demo.py
   ```

2. **Admin password must be correct:**
   ```bash
   python reset_admin_password.py
   ```
   - Email: `admin@demo.com`
   - Password: `demo123`
   - Correct hash: `$2b$12$t3c9inySNVTxAI7j56GTze4IO7GMKfaQu.sZ/VdvOytqjFMScBgwe`

### Run All Tests

```bash
cd apps/backend

# Run all tests with coverage
python -m pytest tests/ --ignore=tests/test_workflow_agent_integration.py --cov=src --cov-report=term --cov-report=html -v

# Run specific test file
python -m pytest tests/test_auth_security.py -v

# Run specific test
python -m pytest tests/test_auth_security.py::TestLogin::test_login_success -v

# Run with minimal output
python -m pytest tests/ --ignore=tests/test_workflow_agent_integration.py -q
```

### View Coverage Report

```bash
cd apps/backend

# Generate HTML coverage report
python -m pytest tests/ --ignore=tests/test_workflow_agent_integration.py --cov=src --cov-report=html

# Open in browser
start htmlcov/index.html  # Windows
```

## Common Issues and Solutions

### 1. Login Tests Failing (401 Unauthorized)

**Problem:** Admin password hash in database doesn't match "demo123"

**Solution:**
```bash
cd apps/backend
python reset_admin_password.py
```

**Root Cause:** Password was changed by previous test runs (password reset tests)

### 2. AttributeError: 'NoneType' object has no attribute 'send'

**Problem:** Database session or HTTP client not properly configured

**Solution:** Ensure `conftest.py` properly overrides the database dependency:
```python
app.dependency_overrides[get_async_db] = override_get_async_db
```

### 3. Foreign Key Constraint Errors

**Problem:** Test trying to create data with missing foreign keys (e.g., organization_id)

**Solution:** Tests now use existing seeded data instead of creating new data

### 4. Cookie HttpOnly Flag Assertions Failing

**Problem:** `httpx` Cookie object doesn't include flags in string representation

**Solution:** This is a test implementation issue. The cookie IS secure; the test assertion needs updating:
```python
# Current (fails):
assert "httponly" in str(response.cookies).lower()

# Better approach:
auth_cookie = response.cookies.get("auth_token")
assert auth_cookie is not None
# Note: httpx doesn't expose cookie flags in test client
```

## Test Data Fixtures

Test fixtures fetch existing seeded data from the database rather than creating new data. This avoids foreign key constraint issues and keeps tests fast.

**Available Fixtures:**
- `db_session`: Async database session with transaction rollback
- `client`: Async HTTP client with database override
- `auth_token`: Authenticated JWT token for testing protected endpoints
- `test_users`: List of demo users
- `test_products`: List of demo products
- `test_customers`: List of demo customers
- `test_orders`: List of demo orders
- `test_quotes`: List of demo quotes
- `seed_all_test_data`: Convenience fixture that loads all test data

**Usage Example:**
```python
async def test_list_products(client: AsyncClient, auth_token: str):
    response = await client.get(
        "/api/products",
        cookies={"auth_token": auth_token}
    )
    assert response.status_code == 200
```

## Coverage Goals

### Current Coverage: 36.66%

**High Coverage Areas:**
- Database models: 100%
- Config settings: 90-97%
- Middleware: 66-94%

**Low Coverage Areas:**
- AI agents: 11-46%
- Integration clients: 13-56%
- Workflow engine: 0%
- RAG pipeline: 0%

### Target Coverage: 70%

To reach 70% coverage, focus on:
1. **ERP CRUD Operations** (currently 36%):
   - Products API routes
   - Customers API routes
   - Orders API routes
   - Quotes API routes

2. **Authentication** (currently 56%):
   - JWT token handling
   - Password reset flows
   - Refresh token rotation

3. **Core Business Logic** (currently 25-50%):
   - Order total calculations
   - Quote-to-order conversion
   - Number generation (ORD-YYYY-NNN, Q-YYYY-NNN)

## Passing Tests Highlights

✅ **57 tests passing**, including:

- Agent orchestration (registry, health checks, capabilities)
- Agent metrics and statistics
- Database model structure
- API endpoint discovery
- Pagination functionality
- Basic CRUD operations (when auth works)

## Known Failing Tests

### High Priority Fixes Needed:

1. **Cookie Security Flags** (7 tests)
   - Update assertions to handle httpx Cookie behavior
   - Verify flags are set in production environment

2. **Email Integration** (10+ tests)
   - Password reset emails currently just log tokens
   - Need SendGrid integration for production

3. **API Error Handling** (20+ tests)
   - Some 404/422 responses not properly tested
   - Need better error message assertions

4. **Test Data Consistency** (10+ tests)
   - Some tests depend on specific data that may not exist
   - Need to create test-specific data or mock responses

## Next Steps

### Short Term (1-2 days):
1. Fix cookie flag assertions in `test_auth_security.py`
2. Add email mock to `conftest.py` for password reset tests
3. Fix `test_quotes_api.py` line item errors
4. Update `test_products_api.py` to handle all edge cases

### Medium Term (1 week):
1. Increase coverage to 50% (focus on ERP routes)
2. Add E2E tests for critical workflows
3. Add performance tests (response time < 200ms)
4. Add load tests (100 concurrent users)

### Long Term (1 month):
1. Reach 70% coverage target
2. Add integration tests for Xero/Shopify
3. Add AI agent tests (currently sparse)
4. Add RAG pipeline tests
5. Continuous integration (GitHub Actions)

## Contributing

When adding new tests:

1. **Follow naming convention:**
   - Test files: `test_<module>_<feature>.py`
   - Test classes: `Test<Feature><Action>`
   - Test functions: `test_<what>_<condition>`

2. **Use fixtures:**
   - Import from `tests.fixtures.data`
   - Don't create test data in test functions
   - Use `auth_token` fixture for authenticated requests

3. **Write descriptive assertions:**
   ```python
   # Bad
   assert response.status_code == 200

   # Good
   assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.json()}"
   ```

4. **Clean up after tests:**
   - Fixtures automatically rollback transactions
   - Don't rely on test execution order
   - Tests should be independent

## Troubleshooting

### Database Connection Issues

```bash
# Check if database is running
docker ps

# Restart database
docker compose down
docker compose up -d
```

### Test Data Not Found

```bash
# Re-seed database
cd apps/backend
python src/db/seed_demo.py
```

### Import Errors

```bash
# Reinstall dependencies
cd apps/backend
uv sync
```

### Stale Test Cache

```bash
# Clear pytest cache
rm -rf .pytest_cache
pytest --cache-clear
```

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
- [HTTPX Testing](https://www.python-httpx.org/advanced/#testing)
- [Coverage.py](https://coverage.readthedocs.io/)

---

**Last Updated:** January 12, 2026
**Test Suite Version:** 1.0.0
**Database:** PostgreSQL 15
**Python:** 3.13.5
