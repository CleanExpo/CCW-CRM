"""Tests for POS transaction endpoints."""

from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.fixtures.pos_data import (
    create_location_payload,
    create_pos_transaction_payload,
    create_terminal_payload,
)


@pytest.mark.asyncio
async def test_list_pos_transactions(client: AsyncClient, auth_headers: dict):
    """Test listing POS transactions with pagination."""
    response = await client.get("/api/pos/transactions", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data
    assert isinstance(data["data"], list)


@pytest.mark.asyncio
async def test_list_pos_transactions_pagination(client: AsyncClient, auth_headers: dict):
    """Test POS transaction list pagination."""
    response = await client.get(
        "/api/pos/transactions", params={"page": 1, "page_size": 10}, headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 1
    assert data["page_size"] == 10
    assert len(data["data"]) <= 10


@pytest.mark.asyncio
async def test_list_pos_transactions_with_filters(client: AsyncClient, auth_headers: dict):
    """Test filtering POS transactions by date range and payment method."""
    response = await client.get(
        "/api/pos/transactions",
        params={
            "payment_method": "eftpos",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    # All returned transactions should match the filter (if any)
    for transaction in data["data"]:
        if transaction.get("payment_method"):
            assert transaction["payment_method"] == "eftpos"


@pytest.mark.asyncio
async def test_get_pos_transaction_not_found(client: AsyncClient, auth_headers: dict):
    """Test getting a non-existent POS transaction returns 404."""
    non_existent_id = str(uuid4())
    response = await client.get(
        f"/api/pos/transactions/{non_existent_id}", headers=auth_headers
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_pos_transaction_validation_negative_amount(
    client: AsyncClient, auth_headers: dict, create_test_terminal, create_test_location
):
    """Test creating POS transaction with negative amount fails validation."""
    payload = create_pos_transaction_payload(
        terminal_id=str(create_test_terminal.id),
        location_code=create_test_location.code,
        amount=-50.00,  # Invalid negative amount
    )

    response = await client.post("/api/pos/transactions", json=payload, headers=auth_headers)
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_create_pos_transaction_invalid_payment_method(
    client: AsyncClient, auth_headers: dict, create_test_terminal, create_test_location
):
    """Test creating POS transaction with invalid payment method fails."""
    payload = create_pos_transaction_payload(
        terminal_id=str(create_test_terminal.id),
        location_code=create_test_location.code,
        payment_method="invalid_method",  # Invalid payment method
    )

    response = await client.post("/api/pos/transactions", json=payload, headers=auth_headers)
    assert response.status_code == 422  # Validation error


@pytest.mark.asyncio
async def test_create_pos_transaction_invalid_terminal(
    client: AsyncClient, auth_headers: dict, create_test_location
):
    """Test creating POS transaction with non-existent terminal fails."""
    payload = create_pos_transaction_payload(
        terminal_id=str(uuid4()),  # Non-existent terminal
        location_code=create_test_location.code,
    )

    response = await client.post("/api/pos/transactions", json=payload, headers=auth_headers)
    # Should fail with 404 (terminal not found) or 422 (validation error)
    assert response.status_code in [404, 422, 400]


@pytest.mark.asyncio
async def test_pos_health_check(client: AsyncClient):
    """Test POS health check endpoint (no auth required)."""
    response = await client.get("/api/pos/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "POS"
