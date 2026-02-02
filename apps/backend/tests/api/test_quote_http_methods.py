"""
Test for ISS-001: Fix Quote Module 405 Errors
Tests all HTTP methods on quote endpoints to identify 405 errors
"""
import pytest
from httpx import AsyncClient
from uuid import uuid4


@pytest.mark.asyncio
async def test_quote_list_get_allowed(client: AsyncClient):
    """GET /api/quotes should return 200, not 405"""
    response = await client.get("/api/quotes")
    assert response.status_code in [200, 401], f"Expected 200/401, got {response.status_code}: {response.text}"


@pytest.mark.asyncio
async def test_quote_list_post_allowed(client: AsyncClient):
    """POST /api/quotes should return 201 or 422, not 405"""
    payload = {
        "customer_id": str(uuid4()),
        "status": "draft",
        "items": []
    }
    response = await client.post("/api/quotes", json=payload)
    # Should be 201 (success), 422 (validation), or 401 (auth), but NOT 405
    assert response.status_code != 405, f"Got 405 Method Not Allowed: {response.text}"


@pytest.mark.asyncio
async def test_quote_detail_get_allowed(client: AsyncClient):
    """GET /api/quotes/{id} should return 200/404, not 405"""
    quote_id = uuid4()
    response = await client.get(f"/api/quotes/{quote_id}")
    assert response.status_code != 405, f"Got 405 on GET {quote_id}: {response.text}"


@pytest.mark.asyncio
async def test_quote_detail_put_allowed(client: AsyncClient):
    """PUT /api/quotes/{id} should return 200/404/422, not 405"""
    quote_id = uuid4()
    payload = {"status": "sent"}
    response = await client.put(f"/api/quotes/{quote_id}", json=payload)
    assert response.status_code != 405, f"Got 405 on PUT {quote_id}: {response.text}"


@pytest.mark.asyncio
async def test_quote_detail_delete_allowed(client: AsyncClient):
    """DELETE /api/quotes/{id} should return 204/404, not 405"""
    quote_id = uuid4()
    response = await client.delete(f"/api/quotes/{quote_id}")
    assert response.status_code != 405, f"Got 405 on DELETE {quote_id}: {response.text}"


@pytest.mark.asyncio
async def test_quote_generate_post_allowed(client: AsyncClient):
    """POST /api/quotes/generate should work, not 405"""
    response = await client.post("/api/quotes/generate", params={"requirements": "test"})
    assert response.status_code != 405, f"Got 405 on generate: {response.text}"


@pytest.mark.asyncio
async def test_quote_convert_post_allowed(client: AsyncClient):
    """POST /api/quotes/{id}/convert-to-order should work, not 405"""
    quote_id = uuid4()
    response = await client.post(f"/api/quotes/{quote_id}/convert-to-order")
    assert response.status_code != 405, f"Got 405 on convert: {response.text}"


@pytest.mark.asyncio
async def test_disallowed_methods_return_405(client: AsyncClient):
    """Verify 405 is returned for truly unsupported methods"""
    quote_id = uuid4()

    # PATCH is not supported - should return 405
    response = await client.patch(f"/api/quotes/{quote_id}", json={"status": "sent"})
    assert response.status_code == 405, f"PATCH should return 405, got {response.status_code}"

    # OPTIONS should work (CORS)
    response = await client.options("/api/quotes")
    assert response.status_code in [200, 204], f"OPTIONS should work for CORS"
