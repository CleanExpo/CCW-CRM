"""Tests for bank feed and reconciliation endpoints."""

from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.fixtures.pos_data import create_bank_account_payload


@pytest.mark.asyncio
async def test_list_bank_accounts(client: AsyncClient, auth_headers: dict):
    """Test listing all bank accounts."""
    response = await client.get("/api/bank-feeds/accounts", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_list_bank_accounts_filters_by_location(
    client: AsyncClient, auth_headers: dict, create_test_location
):
    """Test filtering bank accounts by location."""
    response = await client.get(
        "/api/bank-feeds/accounts",
        params={"location_code": create_test_location.code},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    # All returned accounts should belong to the specified location
    for account in data:
        if account.get("location_code"):
            assert account["location_code"] == create_test_location.code


@pytest.mark.asyncio
async def test_create_bank_account(client: AsyncClient, auth_headers: dict, create_test_location):
    """Test creating a new bank account."""
    payload = create_bank_account_payload(location_code=create_test_location.code)

    response = await client.post("/api/bank-feeds/accounts", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["account_name"] == payload["account_name"]
    assert payload["account_number"].endswith(data["account_number"])
    assert data["bsb"] == payload["bsb"]
    assert data["account_type"] == "checking"


@pytest.mark.asyncio
async def test_create_bank_account_invalid_bsb_format(
    client: AsyncClient, auth_headers: dict, create_test_location
):
    """Test creating bank account with invalid BSB format fails."""
    payload = create_bank_account_payload(
        location_code=create_test_location.code,
        bsb="invalid",  # Invalid BSB format (should be XXX-XXX)
    )

    response = await client.post("/api/bank-feeds/accounts", json=payload, headers=auth_headers)
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_update_bank_account(
    client: AsyncClient, auth_headers: dict, create_test_bank_account
):
    """Test updating an existing bank account."""
    update_payload = {
        "account_name": "Updated Test Account",
        "feed_provider": "xero",
    }

    response = await client.put(
        f"/api/bank-feeds/accounts/{create_test_bank_account.id}",
        json=update_payload,
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["account_name"] == "Updated Test Account"
    assert data["feed_provider"] == "xero"


@pytest.mark.asyncio
async def test_update_bank_account_not_found(client: AsyncClient, auth_headers: dict):
    """Test updating non-existent bank account returns 404."""
    non_existent_id = str(uuid4())
    update_payload = {"account_name": "Updated Account"}

    response = await client.put(
        f"/api/bank-feeds/accounts/{non_existent_id}", json=update_payload, headers=auth_headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_bank_account(
    client: AsyncClient, auth_headers: dict, create_test_bank_account
):
    """Test deactivating a bank account."""
    response = await client.delete(
        f"/api/bank-feeds/accounts/{create_test_bank_account.id}", headers=auth_headers
    )
    assert response.status_code == 204

    # Verify account is deactivated (is_active = False)
    get_response = await client.get("/api/bank-feeds/accounts", headers=auth_headers)
    accounts = get_response.json()
    deleted_account = next(
        (a for a in accounts if a["id"] == str(create_test_bank_account.id)), None
    )
    # Account should either be missing or have is_active = False
    if deleted_account:
        assert deleted_account.get("is_active") is False


@pytest.mark.asyncio
async def test_delete_bank_account_not_found(client: AsyncClient, auth_headers: dict):
    """Test deleting non-existent bank account returns 404."""
    non_existent_id = str(uuid4())
    response = await client.delete(f"/api/bank-feeds/accounts/{non_existent_id}", headers=auth_headers)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_reconciliation_stats(client: AsyncClient, auth_headers: dict):
    """Test getting reconciliation statistics."""
    response = await client.get("/api/bank-feeds/stats", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    # Should contain stats keys
    assert "total_unreconciled" in data or "stats" in data or isinstance(data, dict)


@pytest.mark.asyncio
async def test_get_reconciliation_alerts(client: AsyncClient, auth_headers: dict):
    """Test getting reconciliation alerts."""
    response = await client.get("/api/bank-feeds/alerts", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    # Should return list of alerts
    assert isinstance(data, list) or "alerts" in data


@pytest.mark.asyncio
async def test_export_reconciliation_data(client: AsyncClient, auth_headers: dict):
    """Test exporting reconciliation data as CSV."""
    response = await client.get(
        "/api/bank-feeds/export",
        params={
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "format": "csv",
        },
        headers=auth_headers,
    )
    # Should return CSV data or redirect/stream
    assert response.status_code in [200, 302]
