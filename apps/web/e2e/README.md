# E2E Testing Guide

This directory contains end-to-end tests for the CCW-Online ERP application using Playwright.

## Test Coverage

### Authentication (5 tests)
- Login with valid credentials
- Login with invalid credentials
- Logout functionality
- Protected route access
- Session persistence

### Products (5 tests)
- View products list
- Search products
- Create new product
- Edit existing product
- Deactivate product

### Customers (4 tests)
- View customers list
- Create new customer
- Edit existing customer
- Search customers

### Orders (7 tests)
- View orders list
- Search and filter orders
- Create new order
- View order details
- Update order status
- Generate invoice
- Pagination

### Quotes (6 tests)
- View quotes list
- Create new quote
- View quote details
- Edit existing quote
- Convert quote to order
- Filter by status

### POS Transactions (5 tests)
- Navigate to POS terminal
- Add products to cart
- Process cash payment
- Process card payment
- View transaction history

### POS Reconciliation (4 tests)
- View reconciliation dashboard
- Filter reconciliation data
- Auto-match transactions
- Export reconciliation data

### Monitoring (2 tests)
- View monitoring dashboard
- Switch between tabs

### Existing Tests
- PRD Generation (8 tests)
- Showroom (2 tests)

**Total: 48 E2E Tests**

## Running Tests

### Prerequisites

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Install Playwright browsers:
   ```bash
   pnpm exec playwright install
   ```

3. Ensure backend is running (or will be auto-started by webServer config):
   ```bash
   cd apps/backend
   uv run uvicorn src.api.main:app --reload
   ```

### Run All Tests

```bash
pnpm test:e2e
```

### Run Tests in Headed Mode (with visible browser)

```bash
pnpm test:e2e:headed
```

### Run Tests in UI Mode (interactive)

```bash
pnpm test:e2e:ui
```

### Run Specific Test File

```bash
pnpm exec playwright test auth.spec.ts
```

### Debug Tests

```bash
pnpm test:e2e:debug
```

### View Test Report

```bash
pnpm test:e2e:report
```

## Test Structure

### Directory Structure

```
e2e/
├── fixtures/
│   └── auth.ts              # Authentication fixture
├── helpers/
│   ├── test-data.ts         # Test data generators
│   └── page-objects.ts      # Page object helpers
├── auth.setup.ts            # Global auth setup
├── auth.spec.ts             # Authentication tests
├── products.spec.ts         # Product management tests
├── customers.spec.ts        # Customer management tests
├── orders.spec.ts           # Order management tests
├── quotes.spec.ts           # Quote management tests
├── pos-transactions.spec.ts # POS transaction tests
├── pos-reconciliation.spec.ts # POS reconciliation tests
├── monitoring.spec.ts       # Monitoring dashboard tests
├── prd-generation.spec.ts   # PRD generation tests
└── showroom.spec.ts         # Showroom tests
```

### Test Patterns

#### Using Authentication Fixture

```typescript
import { test, expect } from "./fixtures/auth";

test("my test", async ({ authenticatedPage: page }) => {
  await page.goto("/dashboard");
  // Test authenticated features
});
```

#### Creating Test Data

```typescript
import { createTestProduct, createTestCustomer } from "./helpers/test-data";

const product = createTestProduct({
  name: "Custom Product Name",
  price: 199.99,
});
```

#### Using Page Object Helpers

```typescript
import { expectSuccessToast, clickButton, fillFieldByLabel } from "./helpers/page-objects";

await fillFieldByLabel(page, /product name/i, "Test Product");
await clickButton(page, /save/i);
await expectSuccessToast(page, /success/i);
```

## Writing New Tests

1. **Create test file** in `e2e/` directory (e.g., `my-feature.spec.ts`)

2. **Import test utilities**:
   ```typescript
   import { test, expect } from "./fixtures/auth";
   import { clickButton, expectSuccessToast } from "./helpers/page-objects";
   ```

3. **Write test**:
   ```typescript
   test.describe("My Feature", () => {
     test("should do something", async ({ authenticatedPage: page }) => {
       await page.goto("/my-feature");
       // ... test steps
       await expect(page.locator("h1")).toContainText(/expected text/i);
     });
   });
   ```

## Debugging Failing Tests

### 1. Run in headed mode
```bash
pnpm test:e2e:headed
```

### 2. Run in debug mode
```bash
pnpm test:e2e:debug
```

### 3. View trace
If a test fails, a trace file is saved. View it with:
```bash
pnpm exec playwright show-trace test-results/<test-name>/trace.zip
```

### 4. View screenshots
Screenshots of failures are saved in `test-results/`

### 5. Common Issues

**Issue: "page.goto: Navigation timeout"**
- Solution: Ensure backend is running. Increase timeout in config if needed.

**Issue: "Locator not found"**
- Solution: Check if selector is correct. Use `page.pause()` to inspect page.

**Issue: "Authentication failed"**
- Solution: Check `.auth/user.json` exists. Delete it and re-run to regenerate.

**Issue: "Flaky tests"**
- Solution: Add explicit waits: `await page.waitForLoadState("networkidle")`

## CI/CD

Tests run automatically on GitHub Actions:
- On push to `main`, `develop`, `ai-updates` branches
- On pull requests to `main`, `develop`

View results in GitHub Actions tab of the repository.

## Best Practices

1. ✅ Use semantic locators (roles, labels) instead of CSS selectors
2. ✅ Wait for elements with `await expect()` rather than hard waits
3. ✅ Use test data generators to avoid conflicts
4. ✅ Keep tests independent - don't rely on test order
5. ✅ Use page object helpers for common actions
6. ✅ Add descriptive test names
7. ✅ Clean up test data if possible
8. ❌ Don't use `page.waitForTimeout()` - use `waitForLoadState` instead
9. ❌ Don't hardcode IDs - generate unique test data
10. ❌ Don't make tests dependent on each other

## Maintenance

- Update test data generators when models change
- Update page object helpers when UI patterns change
- Keep selectors semantic (prefer getByRole, getByLabel over getByTestId)
- Review and update tests when features are modified

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Playwright Test Runner](https://playwright.dev/docs/test-runners)
