"""Tests for translation service endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_active_languages(client: AsyncClient, auth_headers: dict):
    """Test getting list of active languages."""
    response = await client.get("/api/translations/languages", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    # Should contain at least English
    assert any(lang.get("code") == "en" for lang in data), "English should be included"


@pytest.mark.asyncio
async def test_get_translation_coverage(client: AsyncClient, auth_headers: dict):
    """Test getting translation coverage statistics."""
    response = await client.get("/api/translations/coverage", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    # Should contain coverage stats
    assert isinstance(data, dict) or isinstance(data, list)


@pytest.mark.asyncio
async def test_list_products_with_translations(client: AsyncClient, auth_headers: dict):
    """Test listing products with their translations."""
    response = await client.get("/api/translations/products", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    # Should return product list
    assert isinstance(data, list) or "data" in data


@pytest.mark.asyncio
async def test_list_products_with_translations_filters(client: AsyncClient, auth_headers: dict):
    """Test filtering products by language and translation status."""
    response = await client.get(
        "/api/translations/products",
        params={"language_code": "es", "untranslated_only": True},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list) or "data" in data


@pytest.mark.asyncio
async def test_batch_translate_products(client: AsyncClient, auth_headers: dict):
    """Test batch translating products."""
    payload = {
        "product_ids": [],  # Empty list for test (would need real product IDs)
        "target_languages": ["es", "fr"],
    }

    response = await client.post(
        "/api/translations/products/batch",
        json=payload,
        headers=auth_headers,
    )
    # Should accept request even with empty list
    assert response.status_code in [200, 202, 400]  # 202 = Accepted (async job)


@pytest.mark.asyncio
async def test_get_product_translation_not_found(client: AsyncClient, auth_headers: dict):
    """Test getting translation for non-existent product returns 404."""
    non_existent_id = str(uuid4())
    response = await client.get(
        f"/api/translations/products/{non_existent_id}/es",
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_product_translation_invalid_language(client: AsyncClient, auth_headers: dict):
    """Test getting translation with invalid language code fails."""
    product_id = str(uuid4())
    response = await client.get(
        f"/api/translations/products/{product_id}/invalid_lang",
        headers=auth_headers,
    )
    assert response.status_code in [400, 404, 422]  # Validation or not found


@pytest.mark.asyncio
async def test_update_product_translation_not_found(client: AsyncClient, auth_headers: dict):
    """Test updating translation for non-existent product returns 404."""
    non_existent_id = str(uuid4())
    payload = {
        "name": "Producto Traducido",
        "description": "Descripción en español",
    }

    response = await client.put(
        f"/api/translations/products/{non_existent_id}/es",
        json=payload,
        headers=auth_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_translate_single_product_not_found(client: AsyncClient, auth_headers: dict):
    """Test translating non-existent product returns 404."""
    non_existent_id = str(uuid4())
    response = await client.post(
        f"/api/translations/products/{non_existent_id}/translate/es",
        headers=auth_headers,
    )
    assert response.status_code == 404
