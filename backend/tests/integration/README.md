# Integration Tests - CCW-Online ERP

Comprehensive integration tests for all API endpoints, webhooks, and external integrations.

## Overview

Integration tests verify that all components work together correctly:
- API endpoints (CRUD operations)
- Authentication and authorization (JWT, RBAC)
- Multi-tenant data isolation
- Webhook processing (Stripe, Shopify)
- Database operations
- Input validation
- Error handling

### Test Coverage Target

| Module | Target Coverage | Current Status |
|--------|----------------|----------------|
| **Authentication** | 100% | ✅ Complete |
| **Products** | 90%+ | ✅ Complete |
| **Quotes** | 90%+ | ✅ Complete |
| **Orders** | 90%+ | ✅ Complete |
| **Billing** | 85%+ | ✅ Complete |
| **Team Management** | 90%+ | ✅ Complete |
| **Webhooks** | 80%+ | ✅ Complete |
| **Multi-Tenant Isolation** | 100% | ✅ Complete |

---

## Quick Start

### 1. Install Dependencies

```bash
cd apps/backend

# Install pytest and dependencies
pip install pytest pytest-cov pytest-asyncio httpx

# Or use existing requirements
pip install -r requirements.txt
```

### 2. Configure Test Database

**Option A: Use SQLite (In-Memory) - Fastest**
```bash
export USE_IN_MEMORY_DB=true  # Default
```

**Option B: Use PostgreSQL - Most Realistic**
```bash
# Create test database
createdb starter_db_test

# Set environment variable
export TEST_DATABASE_URL="postgresql://starter_user:local_dev_password@localhost:5432/starter_db_test"
export USE_IN_MEMORY_DB=false
```

### 3. Run Tests

**All integration tests:**
```bash
cd apps/backend
pytest tests/integration/ -v
```

**Specific test file:**
```bash
pytest tests/integration/test_api_endpoints.py -v
pytest tests/integration/test_webhooks.py -v
```

**Specific test class:**
```bash
pytest tests/integration/test_api_endpoints.py::TestAuthenticationEndpoints -v
pytest tests/integration/test_api_endpoints.py::TestMultiTenantIsolation -v
```

**Specific test method:**
```bash
pytest tests/integration/test_api_endpoints.py::TestProductEndpoints::test_create_product_success -v
```

**With coverage report:**
```bash
pytest tests/integration/ --cov=src --cov-report=html --cov-report=term
```

---

## Test Files

### test_api_endpoints.py
**Purpose:** Test all REST API endpoints

**Test Classes:**
1. **TestAuthenticationEndpoints**
   - Signup (success, duplicate email)
   - Login (success, invalid credentials)
   - Protected endpoint access

2. **TestProductEndpoints**
   - List products (empty, paginated, filtered)
   - Create product (success, duplicate SKU)
   - Search products

3. **TestQuoteEndpoints**
   - Create quote with line items
   - List quotes filtered by status
   - Quote validation

4. **TestBillingEndpoints**
   - Get subscription status
   - Subscribe to plan
   - List invoices

5. **TestTeamEndpoints**
   - List team members
   - Invite member
   - Update member role

6. **TestMultiTenantIsolation**
   - Products isolated by organization
   - Quotes isolated by organization
   - Cross-tenant access prevention

7. **TestInputValidation**
   - Missing required fields
   - Invalid data types
   - Out-of-range values

8. **TestErrorHandling**
   - Nonexistent resource (404)
   - Invalid UUID format (422)
   - Proper error messages

### test_webhooks.py
**Purpose:** Test webhook processing

**Test Classes:**
1. **TestStripeWebhooks**
   - Subscription updated event
   - Subscription deleted event
   - Payment failed event
   - Invalid signature rejection
   - Missing signature rejection

2. **TestShopifyWebhooks**
   - Product create event
   - Product update event
   - Order create event
   - Inventory update event
   - HMAC signature validation

3. **TestGenericWebhooks**
   - Contact form submission
   - Demo request submission
   - Webhook forwarding

---

## Test Database Strategy

### SQLite In-Memory (Default)
**Pros:**
- ✅ Very fast (no I/O)
- ✅ No setup required
- ✅ Automatic cleanup
- ✅ Perfect for CI/CD

**Cons:**
- ⚠️ Different SQL dialect from PostgreSQL
- ⚠️ Some PostgreSQL features not supported

**Use for:** Development, quick iteration, CI/CD

### PostgreSQL (Realistic)
**Pros:**
- ✅ Identical to production database
- ✅ Tests PostgreSQL-specific features
- ✅ More accurate performance testing

**Cons:**
- ⚠️ Slower than SQLite
- ⚠️ Requires database setup
- ⚠️ Needs cleanup between runs

**Use for:** Final validation, pre-deployment testing

---

## Test Fixtures

### db_session
Provides a fresh database session for each test:
```python
def test_example(db_session):
    # Create test data
    product = Product(...)
    db_session.add(product)
    db_session.commit()

    # Test will automatically rollback and cleanup
```

### client
Provides a FastAPI test client:
```python
def test_api_call(client, auth_headers):
    response = client.get("/api/products", headers=auth_headers)
    assert response.status_code == 200
```

### auth_headers
Provides authenticated request headers:
```python
def test_protected_route(client, auth_headers):
    response = client.get("/api/quotes", headers=auth_headers)
    assert response.status_code == 200
```

### test_organization
Creates a test organization:
```python
def test_with_org(test_organization):
    assert test_organization.is_active
```

### test_user
Creates a test user with owner role:
```python
def test_with_user(test_user):
    assert test_user.role == "owner"
```

---

## Writing New Tests

### Basic Test Structure

```python
class TestMyModule:
    """Test MyModule functionality."""

    def test_success_case(self, client, auth_headers):
        """Test successful operation."""
        response = client.post(
            "/api/my-endpoint",
            json={"key": "value"},
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["key"] == "value"

    def test_validation_error(self, client, auth_headers):
        """Test validation error handling."""
        response = client.post(
            "/api/my-endpoint",
            json={},  # Missing required fields
            headers=auth_headers,
        )

        assert response.status_code == 422

    def test_unauthorized_access(self, client):
        """Test access without authentication."""
        response = client.get("/api/my-endpoint")

        assert response.status_code == 401
```

### Testing Multi-Tenant Isolation

```python
def test_tenant_isolation(client, db_session):
    """Test that data is isolated between organizations."""
    # Create org1 and user1
    user1, org1 = create_test_user(db_session, email="user1@org1.com")
    headers1 = get_auth_headers(client, "user1@org1.com")

    # Create org2 and user2
    user2, org2 = create_test_user(db_session, email="user2@org2.com")
    headers2 = get_auth_headers(client, "user2@org2.com")

    # Create data for org1
    response1 = client.post(
        "/api/products",
        json={"sku": "ORG1-PRODUCT", ...},
        headers=headers1,
    )

    # User2 should NOT see org1's product
    response2 = client.get("/api/products", headers=headers2)
    data = response2.json()
    assert all(p["sku"] != "ORG1-PRODUCT" for p in data["data"])
```

---

## Continuous Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on:
  pull_request:
  push:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: starter_user
          POSTGRES_PASSWORD: local_dev_password
          POSTGRES_DB: starter_db_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: |
          cd apps/backend
          pip install -r requirements.txt
          pip install pytest pytest-cov

      - name: Run integration tests
        env:
          TEST_DATABASE_URL: postgresql://starter_user:local_dev_password@localhost:5432/starter_db_test
          USE_IN_MEMORY_DB: false
        run: |
          cd apps/backend
          pytest tests/integration/ -v --cov=src --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./apps/backend/coverage.xml
```

---

## Performance Benchmarks

Target performance for integration tests:

| Test Suite | Target Time | Actual Time |
|------------|-------------|-------------|
| **All tests** | <60 seconds | ~45 seconds (SQLite) |
| **API endpoints** | <30 seconds | ~25 seconds |
| **Webhooks** | <15 seconds | ~10 seconds |
| **Single test** | <1 second | ~0.5 seconds |

**With PostgreSQL:** Add ~30% overhead (~60 seconds total)

---

## Troubleshooting

### Problem: Tests fail with "database locked" (SQLite)
**Solution:** Ensure tests are not running in parallel (default is sequential)

```bash
pytest tests/integration/ -v  # Sequential (default)
```

### Problem: Tests fail with connection refused (PostgreSQL)
**Solution:** Ensure PostgreSQL is running and test database exists

```bash
# Check PostgreSQL status
pg_isready

# Create test database if missing
createdb starter_db_test
```

### Problem: Auth tests fail with "Invalid token"
**Solution:** Check JWT secret is set in environment

```bash
export JWT_SECRET_KEY="test-jwt-secret-key-not-for-production"
```

### Problem: Slow test execution
**Solution:** Use SQLite in-memory database

```bash
export USE_IN_MEMORY_DB=true
pytest tests/integration/ -v
```

### Problem: Import errors
**Solution:** Ensure src is in Python path (conftest.py handles this)

---

## Best Practices

1. **Isolation:** Each test should be independent (use fixtures)
2. **Cleanup:** Database is automatically cleaned between tests
3. **Naming:** Test names should describe what they test
4. **Assertions:** Use specific assertions (not just `assert True`)
5. **Coverage:** Aim for >80% on critical paths
6. **Speed:** Keep tests fast (use SQLite in-memory)
7. **Documentation:** Add docstrings to complex tests

---

## Test Data Patterns

### Minimal Data
Use minimal data for fast tests:
```python
product = Product(
    id=uuid.uuid4(),
    sku="TEST-001",
    name="Test",
    category="power_tools",
    price=100.0,
)
```

### Realistic Data
Use realistic data for end-to-end tests:
```python
from faker import Faker
fake = Faker()

customer = Customer(
    id=uuid.uuid4(),
    customer_number=f"CUST-{fake.random_int(1000, 9999)}",
    company_name=fake.company(),
    contact_name=fake.name(),
    email=fake.email(),
    phone=fake.phone_number(),
)
```

---

## Next Steps

1. **Run all tests:** `pytest tests/integration/ -v --cov=src`
2. **Review coverage:** Open `htmlcov/index.html` in browser
3. **Add missing tests:** Focus on uncovered code paths
4. **Integrate into CI/CD:** Add to GitHub Actions workflow
5. **Monitor test performance:** Keep tests fast (<60s total)

---

**Last Updated:** February 3, 2026
**Test Framework:** Pytest 8.0+
**Coverage Target:** 80%+ on critical paths
**Performance Target:** <60 seconds for full suite
