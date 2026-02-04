"""
Test for ISS-002: Fix Quote Module 404 Errors
Reproduce and fix issues where quotes are created but cannot be retrieved
"""
import pytest
from httpx import AsyncClient
from uuid import uuid4
import asyncio


@pytest.mark.asyncio
async def test_quote_create_then_retrieve(client: AsyncClient):
    """
    Test that a quote created can immediately be retrieved.

    ISS-002: 300 scenarios failing where quotes are created successfully
    but then return 404 when trying to GET them.
    """
    # Create a customer first
    customer_payload = {
        "customer_number": f"CUST-{uuid4().hex[:8]}",
        "company_name": "Test Company",
        "contact_name": "Test Contact",
        "email": f"test-{uuid4().hex[:8]}@example.com",
        "phone": "555-0100",
    }
    customer_response = await client.post("/api/customers", json=customer_payload)
    assert customer_response.status_code in [201, 200, 422, 401], f"Customer create failed: {customer_response.text}"

    if customer_response.status_code == 201:
        customer_id = customer_response.json()["id"]
    else:
        # Use existing customer for testing
        customers_response = await client.get("/api/customers?page_size=1")
        if customers_response.status_code == 200:
            customers = customers_response.json()["items"]
            if customers:
                customer_id = customers[0]["id"]
            else:
                pytest.skip("No customers available for testing")
        else:
            pytest.skip("Cannot create or fetch customers")

    # Get a product
    products_response = await client.get("/api/products?page_size=1")
    assert products_response.status_code == 200, f"Products fetch failed: {products_response.text}"
    products = products_response.json()["items"]
    assert len(products) > 0, "No products available"
    product_id = products[0]["id"]

    # Create quote
    quote_payload = {
        "customer_id": customer_id,
        "status": "draft",
        "valid_until": "2026-03-01",
        "notes": "Test quote for ISS-002",
        "items": [
            {
                "product_id": product_id,
                "quantity": 1
            }
        ]
    }

    create_response = await client.post("/api/quotes", json=quote_payload)
    assert create_response.status_code == 201, f"Quote create failed: {create_response.status_code} - {create_response.text}"

    created_quote = create_response.json()
    quote_id = created_quote["id"]

    print(f"✅ Created quote {quote_id}")

    # Immediately try to retrieve it
    get_response = await client.get(f"/api/quotes/{quote_id}")

    # THIS SHOULD NOT BE 404!
    assert get_response.status_code == 200, f"Quote {quote_id} created but returned 404 on GET: {get_response.text}"

    retrieved_quote = get_response.json()
    assert retrieved_quote["id"] == quote_id
    print(f"✅ Retrieved quote {quote_id}")


@pytest.mark.asyncio
async def test_quote_persist_after_commit(client: AsyncClient):
    """
    Test that quote persists after transaction commit.
    Check for session/transaction issues.
    """
    # Get existing customer and product
    customers = (await client.get("/api/customers?page_size=1")).json()["items"]
    products = (await client.get("/api/products?page_size=1")).json()["items"]

    if not customers or not products:
        pytest.skip("Need at least one customer and product")

    quote_payload = {
        "customer_id": customers[0]["id"],
        "status": "draft",
        "valid_until": "2026-03-01",
        "items": [{"product_id": products[0]["id"], "quantity": 2}]
    }

    # Create quote
    response = await client.post("/api/quotes", json=quote_payload)
    assert response.status_code == 201
    quote_id = response.json()["id"]

    # Wait a moment to ensure transaction is committed
    await asyncio.sleep(0.1)

    # Try to get it
    get_response = await client.get(f"/api/quotes/{quote_id}")
    assert get_response.status_code == 200, f"Quote disappeared after commit"


@pytest.mark.asyncio
async def test_quote_not_cascade_deleted(client: AsyncClient):
    """
    Test that quote isn't accidentally deleted by cascade.
    Check if deleting quote items cascades to quote itself (it shouldn't).
    """
    # Get existing customer and product
    customers = (await client.get("/api/customers?page_size=1")).json()["items"]
    products = (await client.get("/api/products?page_size=1")).json()["items"]

    if not customers or not products:
        pytest.skip("Need at least one customer and product")

    # Create quote with items
    quote_payload = {
        "customer_id": customers[0]["id"],
        "status": "draft",
        "valid_until": "2026-03-01",
        "items": [{"product_id": products[0]["id"], "quantity": 1}]
    }

    response = await client.post("/api/quotes", json=quote_payload)
    assert response.status_code == 201
    quote_id = response.json()["id"]
    original_quote = response.json()

    # Update quote to remove all items (simulating item deletion)
    update_payload = {
        "status": "draft",
        "items": []  # Remove all items
    }

    update_response = await client.put(f"/api/quotes/{quote_id}", json=update_payload)
    assert update_response.status_code == 200

    # Quote should still exist, just with no items
    get_response = await client.get(f"/api/quotes/{quote_id}")
    assert get_response.status_code == 200, f"Quote was deleted when items were removed"
    assert len(get_response.json()["items"]) == 0


@pytest.mark.asyncio
async def test_concurrent_quote_operations(client: AsyncClient):
    """
    Test for race conditions with concurrent operations.
    ISS-002 mentions potential race conditions.
    """
    # Get existing customer and product
    customers = (await client.get("/api/customers?page_size=1")).json()["items"]
    products = (await client.get("/api/products?page_size=1")).json()["items"]

    if not customers or not products:
        pytest.skip("Need at least one customer and product")

    quote_payload = {
        "customer_id": customers[0]["id"],
        "status": "draft",
        "valid_until": "2026-03-01",
        "items": [{"product_id": products[0]["id"], "quantity": 1}]
    }

    # Create quote
    response = await client.post("/api/quotes", json=quote_payload)
    assert response.status_code == 201
    quote_id = response.json()["id"]

    # Try multiple concurrent GET requests
    tasks = [client.get(f"/api/quotes/{quote_id}") for _ in range(5)]
    responses = await asyncio.gather(*tasks, return_exceptions=True)

    # All should succeed
    for i, resp in enumerate(responses):
        if isinstance(resp, Exception):
            pytest.fail(f"Request {i} raised exception: {resp}")
        assert resp.status_code == 200, f"Request {i} got {resp.status_code}"


@pytest.mark.asyncio
async def test_quote_list_includes_new_quotes(client: AsyncClient):
    """
    Test that newly created quotes appear in list endpoint.
    Verify quote is actually in database, not just returned from creation.
    """
    # Get initial count
    initial_response = await client.get("/api/quotes")
    assert initial_response.status_code == 200
    initial_total = initial_response.json()["total"]

    # Create a quote
    customers = (await client.get("/api/customers?page_size=1")).json()["items"]
    products = (await client.get("/api/products?page_size=1")).json()["items"]

    if not customers or not products:
        pytest.skip("Need at least one customer and product")

    quote_payload = {
        "customer_id": customers[0]["id"],
        "status": "draft",
        "valid_until": "2026-03-01",
        "items": [{"product_id": products[0]["id"], "quantity": 1}]
    }

    create_response = await client.post("/api/quotes", json=quote_payload)
    assert create_response.status_code == 201
    created_quote_id = create_response.json()["id"]

    # Get updated list
    final_response = await client.get("/api/quotes")
    assert final_response.status_code == 200
    final_total = final_response.json()["total"]

    # Should have one more quote
    assert final_total == initial_total + 1, f"Quote count didn't increase: was {initial_total}, now {final_total}"

    # Quote should be in the list
    quote_ids = [q["id"] for q in final_response.json()["items"]]
    assert created_quote_id in quote_ids, f"Newly created quote {created_quote_id} not in list"
