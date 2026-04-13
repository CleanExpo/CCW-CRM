"""
Test for ISS-005: Fix 30 Internal Server Errors
Systematically test endpoints to identify unhandled exceptions
"""
from uuid import uuid4

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_nonexistent_quote_should_not_500(client: AsyncClient):
    """Getting non-existent resource should return 404, not 500"""
    fake_id = uuid4()
    response = await client.get(f"/api/quotes/{fake_id}")

    assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
    assert response.status_code != 500, "Should not return 500 for missing resource"


@pytest.mark.asyncio
async def test_get_nonexistent_order_should_not_500(client: AsyncClient):
    """Getting non-existent order should return 404, not 500"""
    fake_id = uuid4()
    response = await client.get(f"/api/orders/{fake_id}")

    assert response.status_code in [404, 422], f"Expected 404/422, got {response.status_code}"
    assert response.status_code != 500


@pytest.mark.asyncio
async def test_get_nonexistent_customer_should_not_500(client: AsyncClient):
    """Getting non-existent customer should return 404, not 500"""
    fake_id = uuid4()
    response = await client.get(f"/api/customers/{fake_id}")

    assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    assert response.status_code != 500


@pytest.mark.asyncio
async def test_get_nonexistent_product_should_not_500(client: AsyncClient):
    """Getting non-existent product should return 404, not 500"""
    fake_id = uuid4()
    response = await client.get(f"/api/products/{fake_id}")

    assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    assert response.status_code != 500


@pytest.mark.asyncio
async def test_update_nonexistent_quote_should_not_500(client: AsyncClient):
    """Updating non-existent resource should return 404, not 500"""
    fake_id = uuid4()
    response = await client.put(f"/api/quotes/{fake_id}", json={"status": "sent"})

    assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    assert response.status_code != 500


@pytest.mark.asyncio
async def test_delete_nonexistent_quote_should_not_500(client: AsyncClient):
    """Deleting non-existent resource should return 404, not 500"""
    fake_id = uuid4()
    response = await client.delete(f"/api/quotes/{fake_id}")

    assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    assert response.status_code != 500


@pytest.mark.asyncio
async def test_quote_with_nonexistent_product_should_not_500(client: AsyncClient):
    """Quote with invalid product should return 400/422, not 500"""
    customers = (await client.get("/api/customers?page_size=1")).json()["items"]

    if not customers:
        pytest.skip("Need customers")

    payload = {
        "customer_id": customers[0]["id"],
        "status": "draft",
        "valid_until": "2026-12-31",
        "items": [
            {
                "product_id": str(uuid4()),  # Non-existent
                "quantity": 1
            }
        ]
    }

    response = await client.post("/api/quotes", json=payload)

    assert response.status_code in [400, 404, 422], f"Expected 400/404/422, got {response.status_code}"
    assert response.status_code != 500, "Should not return 500 for business logic error"


@pytest.mark.asyncio
async def test_malformed_json_should_not_500(client: AsyncClient):
    """Malformed JSON should return 422, not 500"""
    response = await client.post(
        "/api/quotes",
        content="{invalid json",
        headers={"Content-Type": "application/json"}
    )

    # FastAPI returns 422 for malformed JSON
    assert response.status_code == 422, f"Expected 422, got {response.status_code}"
    assert response.status_code != 500


@pytest.mark.asyncio
async def test_missing_required_fields_should_not_500(client: AsyncClient):
    """Missing required fields should return 422, not 500"""
    response = await client.post("/api/quotes", json={})

    assert response.status_code == 422, f"Expected 422, got {response.status_code}"
    assert response.status_code != 500


@pytest.mark.asyncio
async def test_invalid_uuid_format_should_not_500(client: AsyncClient):
    """Invalid UUID format should return 422, not 500"""
    response = await client.get("/api/quotes/not-a-uuid")

    assert response.status_code == 422, f"Expected 422, got {response.status_code}"
    assert response.status_code != 500


@pytest.mark.asyncio
async def test_list_endpoints_dont_500_on_invalid_params(client: AsyncClient):
    """List endpoints should handle invalid query params gracefully"""

    # Invalid page number
    response = await client.get("/api/quotes?page=-1")
    assert response.status_code != 500, f"Invalid page returned {response.status_code}"

    # Invalid page size
    response = await client.get("/api/quotes?page_size=0")
    assert response.status_code != 500, f"Invalid page_size returned {response.status_code}"

    # Extremely large page size
    response = await client.get("/api/quotes?page_size=999999")
    assert response.status_code != 500, f"Large page_size returned {response.status_code}"


@pytest.mark.asyncio
async def test_concurrent_delete_should_not_500(client: AsyncClient):
    """Deleting already-deleted resource should return 404, not 500"""
    # Create a quote
    customers = (await client.get("/api/customers?page_size=1")).json()["items"]
    products = (await client.get("/api/products?page_size=1")).json()["items"]

    if not customers or not products:
        pytest.skip("Need customers and products")

    payload = {
        "customer_id": customers[0]["id"],
        "status": "draft",
        "valid_until": "2026-12-31",
        "items": [{"product_id": products[0]["id"], "quantity": 1}]
    }

    create_response = await client.post("/api/quotes", json=payload)
    if create_response.status_code != 201:
        pytest.skip("Cannot create quote")

    quote_id = create_response.json()["id"]

    # Delete it
    delete_response1 = await client.delete(f"/api/quotes/{quote_id}")
    assert delete_response1.status_code == 204

    # Try to delete again
    delete_response2 = await client.delete(f"/api/quotes/{quote_id}")
    assert delete_response2.status_code == 404, f"Second delete should return 404, got {delete_response2.status_code}"
    assert delete_response2.status_code != 500


@pytest.mark.asyncio
async def test_update_after_delete_should_not_500(client: AsyncClient):
    """Updating deleted resource should return 404, not 500"""
    # Create and delete a quote
    customers = (await client.get("/api/customers?page_size=1")).json()["items"]
    products = (await client.get("/api/products?page_size=1")).json()["items"]

    if not customers or not products:
        pytest.skip("Need customers and products")

    payload = {
        "customer_id": customers[0]["id"],
        "status": "draft",
        "valid_until": "2026-12-31",
        "items": [{"product_id": products[0]["id"], "quantity": 1}]
    }

    create_response = await client.post("/api/quotes", json=payload)
    if create_response.status_code != 201:
        pytest.skip("Cannot create quote")

    quote_id = create_response.json()["id"]

    # Delete it
    await client.delete(f"/api/quotes/{quote_id}")

    # Try to update
    update_response = await client.put(f"/api/quotes/{quote_id}", json={"status": "sent"})
    assert update_response.status_code == 404, f"Update after delete should return 404, got {update_response.status_code}"
    assert update_response.status_code != 500


@pytest.mark.asyncio
async def test_extremely_long_strings_should_not_500(client: AsyncClient):
    """Extremely long strings should be handled gracefully"""
    customers = (await client.get("/api/customers?page_size=1")).json()["items"]

    if not customers:
        pytest.skip("Need customers")

    payload = {
        "customer_id": customers[0]["id"],
        "status": "draft",
        "valid_until": "2026-12-31",
        "notes": "A" * 100000,  # Very long notes
        "items": []
    }

    response = await client.post("/api/quotes", json=payload)

    # Should be rejected with 422 (validation) or succeed, but not 500
    assert response.status_code != 500, f"Long string caused {response.status_code}"
