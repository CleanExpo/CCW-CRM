"""Tests for POS terminal endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.fixtures.pos_data import create_terminal_payload


@pytest.mark.asyncio
async def test_list_terminals(client: AsyncClient, auth_headers: dict):
    """Test listing all POS terminals."""
    response = await client.get("/api/pos/terminals", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_list_terminals_filters_by_location(
    client: AsyncClient, auth_headers: dict, create_test_location
):
    """Test filtering terminals by location."""
    response = await client.get(
        "/api/pos/terminals",
        params={"location_code": create_test_location.code},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    # All returned terminals should belong to the specified location
    for terminal in data:
        if terminal.get("location_code"):
            assert terminal["location_code"] == create_test_location.code


@pytest.mark.asyncio
async def test_create_terminal(client: AsyncClient, auth_headers: dict, create_test_location):
    """Test creating a new POS terminal."""
    payload = create_terminal_payload(location_code=create_test_location.code)

    response = await client.post("/api/pos/terminals", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["terminal_id"] == payload["terminal_id"]
    assert data["location_code"] == create_test_location.code
    assert data["terminal_type"] == "physical"


@pytest.mark.asyncio
async def test_create_terminal_duplicate_terminal_id(
    client: AsyncClient, auth_headers: dict, create_test_location, create_test_terminal
):
    """Test creating terminal with duplicate terminal_id fails."""
    payload = create_terminal_payload(
        location_code=create_test_location.code,
        terminal_id=create_test_terminal.terminal_id,  # Duplicate
    )

    response = await client.post("/api/pos/terminals", json=payload, headers=auth_headers)
    assert response.status_code in [409, 400, 422]  # Conflict or validation error


@pytest.mark.asyncio
async def test_update_terminal(
    client: AsyncClient, auth_headers: dict, create_test_terminal, create_test_location
):
    """Test updating an existing POS terminal."""
    update_payload = {
        "terminal_type": "virtual",
        "merchant_id": "NEW-MERCHANT-123",
    }

    response = await client.put(
        f"/api/pos/terminals/{create_test_terminal.id}",
        json=update_payload,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["terminal_type"] == "virtual"
    assert data["merchant_id"] == "NEW-MERCHANT-123"


@pytest.mark.asyncio
async def test_update_terminal_not_found(client: AsyncClient, auth_headers: dict):
    """Test updating non-existent terminal returns 404."""
    non_existent_id = str(uuid4())
    update_payload = {"terminal_type": "virtual"}

    response = await client.put(
        f"/api/pos/terminals/{non_existent_id}", json=update_payload, headers=auth_headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_terminal(client: AsyncClient, auth_headers: dict, create_test_terminal):
    """Test soft-deleting a POS terminal."""
    response = await client.delete(
        f"/api/pos/terminals/{create_test_terminal.id}", headers=auth_headers
    )
    assert response.status_code == 204

    # Verify terminal is soft-deleted (is_active = False)
    get_response = await client.get("/api/pos/terminals", headers=auth_headers)
    terminals = get_response.json()
    deleted_terminal = next(
        (t for t in terminals if t["id"] == str(create_test_terminal.id)), None
    )
    # Terminal should either be missing or have is_active = False
    if deleted_terminal:
        assert deleted_terminal.get("is_active") is False


@pytest.mark.asyncio
async def test_delete_terminal_not_found(client: AsyncClient, auth_headers: dict):
    """Test deleting non-existent terminal returns 404."""
    non_existent_id = str(uuid4())
    response = await client.delete(f"/api/pos/terminals/{non_existent_id}", headers=auth_headers)
    assert response.status_code == 404
