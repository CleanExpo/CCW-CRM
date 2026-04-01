# Shopify API Mock Framework Guide

**Phase 5 - Week 2: Shopify API Mocking for Testing**

This guide explains how to use the Shopify API mock framework for testing autonomous development without hitting the real Shopify API.

---

## Overview

The Shopify mock framework provides:
- **Configurable failure modes** - Simulate rate limits, timeouts, errors
- **Call tracking** - Verify API calls in tests
- **Custom responses** - Control mock data for specific tests
- **Network simulation** - Add latency, delays
- **Realistic data** - Mock responses match real Shopify API format

---

## Quick Start

### Basic Usage

```python
from src.testing.shopify_mock import create_shopify_mock, ShopifyMockMode

# Create mock client
mock_client = create_shopify_mock(mode=ShopifyMockMode.SUCCESS)

# Use like real Shopify client
orders = await mock_client.get_orders(limit=10)
products = await mock_client.get_products()
shop_info = await mock_client.get_shop_info()
```

### Using Pytest Fixtures

```python
import pytest

# Use pre-configured fixtures
@pytest.mark.asyncio
async def test_my_feature(shopify_mock):
    """Test using Shopify mock fixture."""
    result = await shopify_mock.get_orders()
    assert "orders" in result
```

---

## Mock Modes

### SUCCESS Mode (Default)

Returns successful responses for all API calls.

```python
client = create_shopify_mock(mode=ShopifyMockMode.SUCCESS)

# Always succeeds
orders = await client.get_orders()
print(f"Got {len(orders['orders'])} orders")
```

---

### RATE_LIMIT Mode

Simulates Shopify rate limiting (429 error).

```python
client = create_shopify_mock(
    mode=ShopifyMockMode.RATE_LIMIT,
    rate_limit_delay_ms=1000,  # 1 second delay
)

try:
    await client.get_orders()
except Exception as e:
    print(f"Rate limited: {e}")
    # Implement retry logic
```

**Use Cases:**
- Test circuit breaker with rate limits
- Test retry logic
- Test backoff strategies

---

### TIMEOUT Mode

Simulates request timeouts.

```python
client = create_shopify_mock(mode=ShopifyMockMode.TIMEOUT)

try:
    await client.get_orders()
except TimeoutError:
    print("Request timed out")
    # Handle timeout
```

**Use Cases:**
- Test timeout handling
- Test circuit breaker on timeouts
- Test rollback on deployment timeouts

---

### SERVER_ERROR Mode

Simulates server errors (500).

```python
client = create_shopify_mock(mode=ShopifyMockMode.SERVER_ERROR)

try:
    await client.get_orders()
except Exception as e:
    print(f"Server error: {e}")
    # Trigger rollback
```

**Use Cases:**
- Test error handling
- Test rollback mechanisms
- Test circuit breaker activation

---

### INTERMITTENT Mode

Randomly fails/succeeds based on failure rate.

```python
client = create_shopify_mock(
    mode=ShopifyMockMode.INTERMITTENT,
    failure_rate=0.3,  # 30% of calls fail
)

# Some calls succeed, some fail
for i in range(10):
    try:
        await client.get_orders()
        print(f"Call {i}: Success")
    except Exception:
        print(f"Call {i}: Failed")
```

**Use Cases:**
- Test flaky API behavior
- Test retry logic with eventual success
- Test circuit breaker recovery

---

## Call Tracking

Track API calls for verification in tests.

### Enable Tracking

```python
client = create_shopify_mock(call_tracking=True)

# Make some calls
await client.get_orders()
await client.get_products()

# Verify calls
assert client.get_call_count() == 2
assert client.get_call_count("get_orders") == 1
```

### Access Call History

```python
# Get detailed call history
for call in client.call_history:
    print(f"{call.timestamp}: {call.method}")
    print(f"  Args: {call.args}")
    print(f"  Kwargs: {call.kwargs}")
    print(f"  Response: {call.response}")
```

### Clear History

```python
client.clear_call_history()
assert client.get_call_count() == 0
```

---

## Custom Responses

Override default responses for specific tests.

### Basic Custom Response

```python
client = create_shopify_mock()

# Define custom response
def custom_shop_info():
    return {
        "shop": {
            "id": 999,
            "name": "Test Shop",
            "email": "test@example.com",
        }
    }

client.set_custom_response("get_shop_info", custom_shop_info)

# Now returns custom data
shop = await client.get_shop_info()
assert shop["shop"]["id"] == 999
```

### Custom Response with Arguments

```python
def custom_get_order(order_id):
    return {
        "order": {
            "id": order_id,
            "status": "cancelled" if order_id > 2000 else "completed",
        }
    }

client.set_custom_response("get_order", custom_get_order)

order1 = await client.get_order(1500)  # status = "completed"
order2 = await client.get_order(2500)  # status = "cancelled"
```

### Custom Response with Keyword Arguments

```python
def custom_get_orders(status="any", limit=50, **kwargs):
    # Generate orders based on parameters
    orders = [
        {"id": i, "status": status}
        for i in range(min(limit, 10))
    ]
    return {"orders": orders}

client.set_custom_response("get_orders", custom_get_orders)

result = await client.get_orders(status="open", limit=5)
assert len(result["orders"]) == 5
```

---

## Network Simulation

Simulate network latency and delays.

### Response Delay

```python
client = create_shopify_mock(
    mode=ShopifyMockMode.SUCCESS,
    response_delay_ms=200,  # 200ms latency
)

import time
start = time.time()
await client.get_orders()
elapsed = time.time() - start

print(f"Request took {elapsed:.3f}s")  # ~0.200s
```

**Use Cases:**
- Test slow network performance
- Test timeout configurations
- Test loading states in UI

---

## Pytest Fixtures

Pre-configured fixtures for common scenarios.

### Available Fixtures

| Fixture | Description |
|---------|-------------|
| `shopify_mock` | Basic SUCCESS mode client |
| `shopify_mock_rate_limit` | Simulates rate limiting |
| `shopify_mock_timeout` | Simulates timeouts |
| `shopify_mock_server_error` | Simulates server errors |
| `shopify_mock_intermittent` | 50% failure rate |
| `shopify_mock_slow` | 100ms network delay |
| `shopify_mock_with_tracking` | Call tracking enabled |

### Usage Example

```python
import pytest

@pytest.mark.asyncio
async def test_with_rate_limit(shopify_mock_rate_limit):
    """Test handling rate limits."""
    with pytest.raises(Exception, match="rate limit"):
        await shopify_mock_rate_limit.get_orders()

@pytest.mark.asyncio
async def test_with_tracking(shopify_mock_with_tracking):
    """Test call tracking."""
    await shopify_mock_with_tracking.get_orders()
    assert shopify_mock_with_tracking.get_call_count() == 1
```

---

## API Methods

All methods match the real Shopify API client interface.

### get_shop_info()

```python
shop = await client.get_shop_info()
# Returns: {"shop": {"id": ..., "name": ..., ...}}
```

### get_orders(status, limit, since_id, created_at_min)

```python
orders = await client.get_orders(
    status="open",
    limit=50,
    since_id=1000,
)
# Returns: {"orders": [{...}, {...}]}
```

### get_order(order_id)

```python
order = await client.get_order(1001)
# Returns: {"order": {"id": 1001, ...}}
```

### get_products(limit, since_id, published_status)

```python
products = await client.get_products(limit=20)
# Returns: {"products": [{...}, {...}]}
```

### get_product(product_id)

```python
product = await client.get_product(5000)
# Returns: {"product": {"id": 5000, ...}}
```

### update_inventory_level(inventory_item_id, location_id, available)

```python
result = await client.update_inventory_level(
    inventory_item_id=1001,
    location_id=2001,
    available=50,
)
# Returns: {"inventory_level": {...}}
```

### create_webhook(topic, address, format)

```python
webhook = await client.create_webhook(
    topic="orders/create",
    address="https://example.com/webhook",
)
# Returns: {"webhook": {"id": ..., ...}}
```

---

## Testing Patterns

### Pattern 1: Test Error Handling

```python
@pytest.mark.asyncio
async def test_handles_shopify_errors():
    """Test error handling for Shopify failures."""
    client = create_shopify_mock(mode=ShopifyMockMode.SERVER_ERROR)

    try:
        await sync_shopify_orders(client)
        pytest.fail("Should have raised exception")
    except Exception as e:
        # Verify error was handled correctly
        assert "server error" in str(e)
```

### Pattern 2: Test Circuit Breaker

```python
@pytest.mark.asyncio
async def test_circuit_breaker_with_shopify():
    """Test circuit breaker opens on Shopify failures."""
    from src.services.circuit_breaker import get_circuit_breaker_manager

    manager = get_circuit_breaker_manager()
    manager.reset_all()

    client = create_shopify_mock(mode=ShopifyMockMode.SERVER_ERROR)

    # Make 5 failing calls
    for _ in range(5):
        try:
            await manager.protect("shopify", client.get_orders)
        except Exception:
            pass

    # Circuit should be open
    breaker = manager.get_breaker("shopify")
    assert breaker.state == CircuitState.OPEN
```

### Pattern 3: Test Rollback on Failure

```python
@pytest.mark.asyncio
async def test_rollback_on_shopify_failure():
    """Test deployment rolls back on Shopify sync failure."""
    from src.services.deployment_service import get_deployment_service

    # Shopify sync will fail
    client = create_shopify_mock(mode=ShopifyMockMode.TIMEOUT)

    deployment_service = get_deployment_service()

    # Deploy with Shopify sync
    result = await deployment_service.deploy_with_shopify_sync(client)

    # Should have triggered rollback
    assert result.status == DeploymentStatus.ROLLED_BACK
    assert result.rollback_id is not None
```

### Pattern 4: Test Retry Logic

```python
@pytest.mark.asyncio
async def test_retry_on_intermittent_failures():
    """Test retry logic with intermittent Shopify failures."""
    client = create_shopify_mock(
        mode=ShopifyMockMode.INTERMITTENT,
        failure_rate=0.5,
    )

    # Retry up to 3 times
    for attempt in range(3):
        try:
            orders = await client.get_orders()
            # Success
            assert "orders" in orders
            break
        except Exception:
            if attempt == 2:
                pytest.fail("All retries failed")
            await asyncio.sleep(0.1)
```

### Pattern 5: Verify API Call Count

```python
@pytest.mark.asyncio
async def test_efficient_shopify_calls(shopify_mock_with_tracking):
    """Test that we're not making excessive API calls."""
    # Run sync operation
    await sync_all_products(shopify_mock_with_tracking)

    # Should only fetch products once
    assert shopify_mock_with_tracking.get_call_count("get_products") == 1

    # Should not fetch individual products (use batch data)
    assert shopify_mock_with_tracking.get_call_count("get_product") == 0
```

---

## Integration with Autonomous Development

### Deployment Testing

```python
@pytest.mark.asyncio
async def test_autonomous_deployment_with_shopify():
    """Test autonomous deployment with Shopify integration."""
    mock_client = create_shopify_mock(call_tracking=True)

    # Simulate deployment
    config = DeploymentConfig(
        environment=DeploymentEnvironment.PRODUCTION,
        commit_hash="abc123",
        branch="main",
        components=["backend", "shopify-sync"],
    )

    deployment_service = get_deployment_service()
    result = await deployment_service.deploy(config, shopify_client=mock_client)

    # Verify Shopify sync happened
    assert mock_client.get_call_count() > 0
    assert result.status == DeploymentStatus.SUCCESSFUL
```

### Circuit Breaker Testing

```python
@pytest.mark.asyncio
async def test_shopify_circuit_breaker_prevents_cascading_failures():
    """Test circuit breaker protects system from Shopify failures."""
    manager = get_circuit_breaker_manager()
    manager.reset_all()

    # Shopify is failing
    failing_client = create_shopify_mock(mode=ShopifyMockMode.TIMEOUT)

    # Make several calls - circuit should open
    failures = 0
    for _ in range(10):
        try:
            await manager.protect("shopify-api", failing_client.get_orders)
        except Exception:
            failures += 1

    # Circuit should be open after threshold
    breaker = manager.get_breaker("shopify-api")
    assert breaker.state == CircuitState.OPEN

    # Further calls should fail fast (not actually call Shopify)
    assert failing_client.get_call_count() < 10  # Stopped calling after circuit opened
```

---

## Best Practices

### 1. Use Appropriate Mode for Test

```python
# Testing happy path
client = create_shopify_mock(mode=ShopifyMockMode.SUCCESS)

# Testing error handling
client = create_shopify_mock(mode=ShopifyMockMode.SERVER_ERROR)

# Testing circuit breaker
client = create_shopify_mock(mode=ShopifyMockMode.RATE_LIMIT)

# Testing retry logic
client = create_shopify_mock(mode=ShopifyMockMode.INTERMITTENT)
```

### 2. Enable Tracking for Verification

```python
# Always enable tracking when you need to verify calls
client = create_shopify_mock(call_tracking=True)

await my_shopify_operation(client)

# Verify expected calls
assert client.get_call_count("get_orders") == 1
assert client.get_call_count("update_inventory_level") == 5
```

### 3. Use Custom Responses for Edge Cases

```python
# Test with empty results
def empty_orders(**kwargs):
    return {"orders": []}

client.set_custom_response("get_orders", empty_orders)

# Test with large datasets
def many_products(limit=50, **kwargs):
    return {"products": [{"id": i} for i in range(1000)]}

client.set_custom_response("get_products", many_products)
```

### 4. Clean Up Between Tests

```python
@pytest.fixture
def clean_shopify_mock():
    """Shopify mock that resets between tests."""
    client = create_shopify_mock(call_tracking=True)
    yield client
    client.clear_call_history()
```

### 5. Test Failure Recovery

```python
@pytest.mark.asyncio
async def test_recovers_from_shopify_failure():
    """Test system recovers after Shopify becomes available."""
    # Start with failures
    client = create_shopify_mock(mode=ShopifyMockMode.SERVER_ERROR)

    # Fail several times
    for _ in range(3):
        with pytest.raises(Exception):
            await sync_operation(client)

    # Shopify recovers
    client.config.mode = ShopifyMockMode.SUCCESS

    # Should succeed now
    result = await sync_operation(client)
    assert result is not None
```

---

## Troubleshooting

### Mock Not Behaving as Expected

**Check mode configuration:**
```python
print(f"Current mode: {client.config.mode}")
print(f"Failure rate: {client.config.failure_rate}")
```

### Calls Not Being Tracked

**Ensure tracking is enabled:**
```python
client = create_shopify_mock(call_tracking=True)
assert client.config.call_tracking is True
```

### Custom Response Not Used

**Verify method name matches:**
```python
# Correct
client.set_custom_response("get_orders", custom_func)

# Incorrect - method name typo
client.set_custom_response("get_order", custom_func)  # Wrong!
```

---

## Support

For issues or questions:
1. Check mock mode configuration
2. Verify call tracking is enabled
3. Review custom response setup
4. Check test logs for errors
5. Create issue in project repository

---

**Last Updated**: February 4, 2026
**Author**: Phase 5 Autonomous Development Team
**Version**: 1.0
