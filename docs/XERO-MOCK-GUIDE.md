# Xero API Mock Framework Guide

**Phase 5 - Week 2: Xero API Mocking for Testing**

Brief guide for using the Xero API mock framework. See SHOPIFY-MOCK-GUIDE.md for detailed patterns.

## Quick Start

```python
from src.testing.xero_mock import create_xero_mock, XeroMockMode

# Create mock client
mock_client = create_xero_mock(mode=XeroMockMode.SUCCESS)

# Use like real Xero client
contact = await mock_client.create_contact(name="Test Customer", email="test@example.com")
invoice = await mock_client.create_invoice(contact_id=contact["ContactID"], invoice_number="INV-001", line_items=[])
payment = await mock_client.create_payment(invoice_id=invoice["InvoiceID"], account_id="test-account", amount=100.00)
```

## Mock Modes

- **SUCCESS**: Always succeeds (default)
- **RATE_LIMIT**: Simulates 429 errors
- **TIMEOUT**: Simulates request timeouts
- **SERVER_ERROR**: Simulates 500 errors
- **UNAUTHORIZED**: Simulates 401 errors
- **VALIDATION_ERROR**: Simulates 400 errors
- **INTERMITTENT**: Random failures (configurable rate)

## API Methods

- `create_contact(name, email, phone, address)` - Create contact
- `get_contact_by_email(email)` - Lookup contact by email
- `create_invoice(contact_id, invoice_number, line_items, due_date, reference)` - Create invoice
- `get_invoices(status, modified_since)` - Get invoices
- `create_payment(invoice_id, account_id, amount, payment_date)` - Create payment
- `get_bank_transactions(status, modified_since)` - Get bank transactions
- `create_bank_transaction(transaction_type, contact_id, account_id, amount, line_items)` - Create bank transaction

## Pytest Fixtures

```python
@pytest.mark.asyncio
async def test_my_feature(xero_mock):
    """Test using Xero mock fixture."""
    contact = await xero_mock.create_contact(name="Test")
    assert contact["ContactID"] is not None
```

Available fixtures: `xero_mock`, `xero_mock_rate_limit`, `xero_mock_timeout`, `xero_mock_server_error`, `xero_mock_unauthorized`, `xero_mock_validation_error`, `xero_mock_intermittent`, `xero_mock_with_tracking`

## Testing Patterns

### Test Error Handling

```python
client = create_xero_mock(mode=XeroMockMode.SERVER_ERROR)
with pytest.raises(Exception):
    await client.create_invoice(...)
```

### Test Circuit Breaker

```python
manager = get_circuit_breaker_manager()
client = create_xero_mock(mode=XeroMockMode.TIMEOUT)

for _ in range(5):
    try:
        await manager.protect("xero-api", client.create_contact, name="Test")
    except Exception:
        pass

breaker = manager.get_breaker("xero-api")
assert breaker.state == CircuitState.OPEN
```

### Call Tracking

```python
client = create_xero_mock(call_tracking=True)
await client.create_contact(name="Test")
await client.create_invoice(...)

assert client.get_call_count() == 2
assert client.get_call_count("create_contact") == 1
```

### Custom Responses

```python
def custom_contact(**kwargs):
    return {"ContactID": "custom-id", "Name": kwargs["name"]}

client.set_custom_response("create_contact", custom_contact)
result = await client.create_contact(name="Test")
assert result["ContactID"] == "custom-id"
```

## Integration with Autonomous Development

```python
# Test deployment with Xero sync
client = create_xero_mock(call_tracking=True)
deployment_service = get_deployment_service()

result = await deployment_service.deploy_with_xero_sync(client)

assert client.get_call_count() > 0
assert result.status == DeploymentStatus.SUCCESSFUL
```

---

**Last Updated**: February 4, 2026
**Version**: 1.0
