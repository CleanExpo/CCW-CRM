"""
Test for ISS-004: Verify race condition fix with concurrent operations
Tests that PostgreSQL SEQUENCE eliminates race conditions at high concurrency
"""
import pytest
import asyncio
from httpx import AsyncClient
from collections import Counter


@pytest.mark.asyncio
async def test_concurrent_quote_creation_no_conflicts(client: AsyncClient):
    """
    Test concurrent quote creation with max_concurrent=10.
    With SEQUENCE fix, should have ZERO conflicts (no 409 errors).

    ISS-004: Previously had 98 race condition failures at max_concurrent=5.
    With sequence-based generation, should handle even max_concurrent=10 with 0 conflicts.
    """
    # Get test data
    customers_response = await client.get("/api/customers?page_size=1")
    products_response = await client.get("/api/products?page_size=1")

    if customers_response.status_code != 200 or products_response.status_code != 200:
        pytest.skip("Need customers and products")

    customers = customers_response.json()["items"]
    products = products_response.json()["items"]

    if not customers or not products:
        pytest.skip("Need at least one customer and product")

    customer_id = customers[0]["id"]
    product_id = products[0]["id"]

    # Prepare payload
    payload = {
        "customer_id": customer_id,
        "status": "draft",
        "valid_until": "2026-12-31",
        "items": [{"product_id": product_id, "quantity": 1}]
    }

    # Create multiple concurrent requests
    num_concurrent = 10

    async def create_quote(index):
        """Create a single quote and return result"""
        try:
            response = await client.post("/api/quotes", json=payload)
            return {
                "index": index,
                "status": response.status_code,
                "quote_number": response.json().get("quote_number") if response.status_code == 201 else None,
                "error": response.text if response.status_code != 201 else None
            }
        except Exception as e:
            return {
                "index": index,
                "status": 0,
                "quote_number": None,
                "error": str(e)
            }

    # Execute concurrent requests
    print(f"\nCreating {num_concurrent} quotes concurrently...")
    tasks = [create_quote(i) for i in range(num_concurrent)]
    results = await asyncio.gather(*tasks)

    # Analyze results
    status_counts = Counter(r["status"] for r in results)
    successful = [r for r in results if r["status"] == 201]
    conflicts = [r for r in results if r["status"] == 409]
    errors = [r for r in results if r["status"] not in [201, 409]]

    # Extract quote numbers
    quote_numbers = [r["quote_number"] for r in successful if r["quote_number"]]

    print(f"\nResults:")
    print(f"  Total requests: {num_concurrent}")
    print(f"  Successful (201): {len(successful)}")
    print(f"  Conflicts (409): {len(conflicts)}")
    print(f"  Other errors: {len(errors)}")
    print(f"  Unique quote numbers: {len(set(quote_numbers))}")

    if conflicts:
        print(f"\nConflict errors:")
        for c in conflicts[:3]:
            print(f"  - {c['error'][:100]}")

    if errors:
        print(f"\nOther errors:")
        for e in errors[:3]:
            print(f"  - Status {e['status']}: {e['error'][:100] if e['error'] else 'Unknown'}")

    # Assertions
    assert len(conflicts) == 0, f"Expected 0 conflicts with SEQUENCE fix, got {len(conflicts)}"
    assert len(successful) == num_concurrent, f"Expected {num_concurrent} successful, got {len(successful)}"
    assert len(quote_numbers) == len(set(quote_numbers)), f"Found duplicate quote numbers: {len(quote_numbers)} total, {len(set(quote_numbers))} unique"

    print(f"\n✅ All {num_concurrent} concurrent requests succeeded with unique quote numbers")


@pytest.mark.asyncio
async def test_concurrent_order_creation_no_conflicts(client: AsyncClient):
    """
    Test concurrent order creation.
    With SEQUENCE fix, should have ZERO conflicts.
    """
    # Get test data
    customers_response = await client.get("/api/customers?page_size=1")
    products_response = await client.get("/api/products?page_size=1")

    if customers_response.status_code != 200 or products_response.status_code != 200:
        pytest.skip("Need customers and products")

    customers = customers_response.json()["items"]
    products = products_response.json()["items"]

    if not customers or not products:
        pytest.skip("Need at least one customer and product")

    customer_id = customers[0]["id"]
    product_id = products[0]["id"]

    # Prepare payload
    payload = {
        "customer_id": customer_id,
        "status": "confirmed",
        "items": [{"product_id": product_id, "quantity": 1}]
    }

    # Create multiple concurrent requests
    num_concurrent = 10

    async def create_order(index):
        """Create a single order and return result"""
        try:
            response = await client.post("/api/orders", json=payload)
            return {
                "index": index,
                "status": response.status_code,
                "order_number": response.json().get("order_number") if response.status_code == 201 else None,
                "error": response.text if response.status_code != 201 else None
            }
        except Exception as e:
            return {
                "index": index,
                "status": 0,
                "order_number": None,
                "error": str(e)
            }

    # Execute concurrent requests
    print(f"\nCreating {num_concurrent} orders concurrently...")
    tasks = [create_order(i) for i in range(num_concurrent)]
    results = await asyncio.gather(*tasks)

    # Analyze results
    status_counts = Counter(r["status"] for r in results)
    successful = [r for r in results if r["status"] == 201]
    conflicts = [r for r in results if r["status"] == 409]

    # Extract order numbers
    order_numbers = [r["order_number"] for r in successful if r["order_number"]]

    print(f"\nResults:")
    print(f"  Successful (201): {len(successful)}")
    print(f"  Conflicts (409): {len(conflicts)}")
    print(f"  Unique order numbers: {len(set(order_numbers))}")

    # Assertions
    assert len(conflicts) == 0, f"Expected 0 conflicts with SEQUENCE fix, got {len(conflicts)}"
    assert len(successful) == num_concurrent, f"Expected {num_concurrent} successful, got {len(successful)}"
    assert len(order_numbers) == len(set(order_numbers)), "Found duplicate order numbers"

    print(f"\n✅ All {num_concurrent} concurrent requests succeeded with unique order numbers")


@pytest.mark.asyncio
async def test_extreme_concurrency_50_requests(client: AsyncClient):
    """
    Stress test: 50 concurrent quote creations.
    This would have caused massive failures with timestamp-based generation.
    With SEQUENCE, should still be 0 conflicts.
    """
    # Get test data
    customers_response = await client.get("/api/customers?page_size=1")
    products_response = await client.get("/api/products?page_size=1")

    if customers_response.status_code != 200 or products_response.status_code != 200:
        pytest.skip("Need customers and products")

    customers = customers_response.json()["items"]
    products = products_response.json()["items"]

    if not customers or not products:
        pytest.skip("Need at least one customer and product")

    customer_id = customers[0]["id"]
    product_id = products[0]["id"]

    payload = {
        "customer_id": customer_id,
        "status": "draft",
        "valid_until": "2026-12-31",
        "items": [{"product_id": product_id, "quantity": 1}]
    }

    num_concurrent = 50

    async def create_quote(index):
        try:
            response = await client.post("/api/quotes", json=payload)
            return response.status_code, response.json().get("quote_number") if response.status_code == 201 else None
        except Exception as e:
            return 0, None

    print(f"\nStress test: Creating {num_concurrent} quotes concurrently...")
    tasks = [create_quote(i) for i in range(num_concurrent)]
    results = await asyncio.gather(*tasks)

    statuses, quote_numbers = zip(*results)
    successful = sum(1 for s in statuses if s == 201)
    conflicts = sum(1 for s in statuses if s == 409)
    valid_numbers = [n for n in quote_numbers if n]

    print(f"Results:")
    print(f"  Successful: {successful}/{num_concurrent}")
    print(f"  Conflicts: {conflicts}")
    print(f"  Unique numbers: {len(set(valid_numbers))}/{len(valid_numbers)}")

    # With SEQUENCE, we expect 0 conflicts even at high concurrency
    assert conflicts == 0, f"SEQUENCE should eliminate all conflicts, got {conflicts}"
    assert len(valid_numbers) == len(set(valid_numbers)), "Found duplicate quote numbers"

    print(f"\n✅ STRESS TEST PASSED: {num_concurrent} concurrent requests, 0 conflicts")
