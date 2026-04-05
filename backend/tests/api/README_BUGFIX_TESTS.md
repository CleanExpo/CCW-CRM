# ERP Bug Fix Tests

This document describes the test suite for the three critical bug fixes in the ERP CRUD operations.

## Bug Fixes Tested

### 1. Order Status Updates Not Persisting (`test_erp_bugfixes.py::TestOrderStatusUpdateBugFix`)

**Problem**: Order status updates were not saving to the database when the frontend sent `subtotal` and `tax` fields that don't exist as columns in the Order model.

**Root Cause**: The backend's `update_order()` function in `orders.py` was attempting to set attributes on the Order model for fields that don't exist (`subtotal` and `tax`), causing SQLAlchemy to fail silently.

**Fix**: Added field validation at `orders.py:177-180` to only set attributes for valid fields:
```python
valid_fields = {"customer_id", "status", "notes", "total", "order_date"}
for field, value in update_data.items():
    if field in valid_fields:
        setattr(order, field, value)
```

**Tests**:
- `test_order_status_update_with_valid_fields()` - Verifies basic status updates work
- `test_order_status_update_with_invalid_fields_filtered()` - Reproduces the original bug scenario where frontend sends invalid fields
- `test_order_status_update_validates_field_names()` - Ensures only whitelisted fields are processed

### 2. Missing Quote DELETE Endpoint (`test_erp_bugfixes.py::TestQuoteDeleteBugFix`)

**Problem**: The DELETE endpoint for quotes (`DELETE /api/quotes/{id}`) was not implemented, returning 405 Method Not Allowed.

**Root Cause**: The endpoint was simply missing from the API routes.

**Fix**: Added DELETE endpoint at `quotes.py:210-228` with cascade deletion of quote items:
```python
@router.delete("/{quote_id}", status_code=204)
async def delete_quote(quote_id: UUID, db: AsyncSession = Depends(get_db)):
    # Implementation with cascade delete
```

**Tests**:
- `test_quote_delete_endpoint_exists()` - Verifies DELETE endpoint is available and returns 204
- `test_quote_delete_cascade_deletes_items()` - Ensures quote items are deleted when quote is deleted
- `test_quote_delete_returns_404_for_nonexistent_quote()` - Verifies proper error handling

### 3. Quote Line Items Not Displaying (`test_erp_bugfixes.py::TestQuoteNumericTypeConversionBugFix`)

**Problem**: Quote edit dialog showed "No items added yet" even when quotes had line items.

**Root Causes**:
1. Frontend expected `quote_items` field but backend returns `items`
2. Backend Decimal values weren't being converted to JavaScript numbers

**Fix**:
- Updated frontend interface at `QuoteForm.tsx:71` to use `items` instead of `quote_items`
- Added type conversion at `QuoteForm.tsx:123-130`:
```typescript
const normalizedItems = (quote.items || []).map(item => ({
  ...item,
  quantity: Number(item.quantity),
  unit_price: Number(item.unit_price),
  line_total: Number(item.line_total),
}));
```

**Tests**:
- `test_quote_api_returns_items_field_not_quote_items()` - Verifies API contract uses correct field name
- `test_quote_api_returns_numeric_values_as_strings()` - Validates Decimal serialization
- `test_quote_list_includes_items_count()` - Ensures list endpoint includes items

### Integration Tests (`test_erp_bugfixes.py::TestBugFixIntegration`)

**Tests**:
- `test_full_order_lifecycle_with_status_updates()` - Tests multiple status transitions to verify Fix #1 works consistently
- `test_quote_to_order_conversion_with_delete()` - Tests quote conversion followed by deletion to verify Fix #2 works after conversion

## Running the Tests

### Run All Bug Fix Tests
```bash
cd apps/backend
pytest tests/api/test_erp_bugfixes.py -v
```

### Run Specific Test Class
```bash
# Test order status bug fix
pytest tests/api/test_erp_bugfixes.py::TestOrderStatusUpdateBugFix -v

# Test quote delete bug fix
pytest tests/api/test_erp_bugfixes.py::TestQuoteDeleteBugFix -v

# Test numeric type conversion
pytest tests/api/test_erp_bugfixes.py::TestQuoteNumericTypeConversionBugFix -v

# Test integration
pytest tests/api/test_erp_bugfixes.py::TestBugFixIntegration -v
```

### Run Specific Test
```bash
pytest tests/api/test_erp_bugfixes.py::TestOrderStatusUpdateBugFix::test_order_status_update_with_invalid_fields_filtered -v
```

### Run with Coverage
```bash
pytest tests/api/test_erp_bugfixes.py --cov=src/api/routes --cov-report=html
```

## Test Database

The tests use an in-memory SQLite database for speed and isolation. Each test gets a fresh database via the `test_db` fixture.

## Expected Results

All tests should pass:
```
tests/api/test_erp_bugfixes.py::TestOrderStatusUpdateBugFix::test_order_status_update_with_valid_fields PASSED
tests/api/test_erp_bugfixes.py::TestOrderStatusUpdateBugFix::test_order_status_update_with_invalid_fields_filtered PASSED
tests/api/test_erp_bugfixes.py::TestOrderStatusUpdateBugFix::test_order_status_update_validates_field_names PASSED
tests/api/test_erp_bugfixes.py::TestQuoteDeleteBugFix::test_quote_delete_endpoint_exists PASSED
tests/api/test_erp_bugfixes.py::TestQuoteDeleteBugFix::test_quote_delete_cascade_deletes_items PASSED
tests/api/test_erp_bugfixes.py::TestQuoteDeleteBugFix::test_quote_delete_returns_404_for_nonexistent_quote PASSED
tests/api/test_erp_bugfixes.py::TestQuoteNumericTypeConversionBugFix::test_quote_api_returns_items_field_not_quote_items PASSED
tests/api/test_erp_bugfixes.py::TestQuoteNumericTypeConversionBugFix::test_quote_api_returns_numeric_values_as_strings PASSED
tests/api/test_erp_bugfixes.py::TestQuoteNumericTypeConversionBugFix::test_quote_list_includes_items_count PASSED
tests/api/test_erp_bugfixes.py::TestBugFixIntegration::test_full_order_lifecycle_with_status_updates PASSED
tests/api/test_erp_bugfixes.py::TestBugFixIntegration::test_quote_to_order_conversion_with_delete PASSED

================================= 11 passed in X.XXs ==================================
```

## Continuous Integration

These tests should be run as part of the CI pipeline before merging any changes to the Orders or Quotes modules.

## Related Files

- **Bug Fix Code**:
  - `apps/backend/src/api/routes/orders.py` (lines 177-180)
  - `apps/backend/src/api/routes/quotes.py` (lines 210-228)
  - `apps/web/app/(dashboard)/quotes/components/QuoteForm.tsx` (lines 71, 123-130)

- **Commit**: `54939c1` - "fix(erp): resolve critical CRUD bugs in quotes and orders modules"

## Notes

- Tests use FastAPI's `TestClient` for synchronous API testing
- Async tests use `pytest-asyncio` with `@pytest.mark.asyncio`
- Database fixtures create fresh test data for each test
- Tests are isolated - no shared state between tests
