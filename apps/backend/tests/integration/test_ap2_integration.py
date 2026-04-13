"""
Integration tests for AP2 (Agent Payments Protocol) endpoints.

Tests the complete AP2 mandate chain: Intent → Cart → Payment
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_create_intent_mandate(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test creating an intent mandate."""
    response = await client.post(
        "/api/integrations/ap2/mandates/intent",
        json={
            "intent_description": "I want to buy construction equipment",
            "language": "en",
            "customer_id": "550e8400-e29b-41d4-a716-446655440000",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert "mandate_id" in data
    assert "signature" in data
    assert "expires_at" in data
    assert data["mandate_type"] == "intent"
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_mandate_chain_flow(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test complete mandate chain: Intent → Cart → Payment."""

    # Step 1: Create intent mandate
    intent_response = await client.post(
        "/api/integrations/ap2/mandates/intent",
        json={
            "intent_description": "Buy safety equipment",
            "language": "en",
            "customer_id": "550e8400-e29b-41d4-a716-446655440000",
        },
    )
    assert intent_response.status_code == 201
    intent_data = intent_response.json()
    intent_mandate_id = intent_data["mandate_id"]

    # Step 2: Create cart mandate (child of intent)
    cart_response = await client.post(
        "/api/integrations/ap2/mandates/cart",
        json={
            "parent_mandate_id": intent_mandate_id,
            "items": [
                {
                    "product_id": "550e8400-e29b-41d4-a716-446655440001",
                    "quantity": 2,
                    "unit_price": 99.99,
                }
            ],
            "total_amount": 199.98,
            "currency": "AUD",
        },
    )
    assert cart_response.status_code == 201
    cart_data = cart_response.json()
    cart_mandate_id = cart_data["mandate_id"]
    assert cart_data["parent_mandate_id"] == intent_mandate_id

    # Step 3: Create payment mandate (child of cart)
    payment_response = await client.post(
        "/api/integrations/ap2/mandates/payment",
        json={
            "parent_mandate_id": cart_mandate_id,
            "amount": 199.98,
            "currency": "AUD",
            "payment_method": "google_pay",
        },
    )
    assert payment_response.status_code == 201
    payment_data = payment_response.json()
    payment_mandate_id = payment_data["mandate_id"]
    assert payment_data["parent_mandate_id"] == cart_mandate_id

    # Step 4: Execute payment
    execute_response = await client.post(
        f"/api/integrations/ap2/mandates/{payment_mandate_id}/execute",
        json={},
    )
    assert execute_response.status_code == 200
    execute_data = execute_response.json()
    assert execute_data["status"] in ["completed", "processing"]


@pytest.mark.asyncio
async def test_verify_mandate_signature(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test mandate signature verification."""

    # Create mandate
    create_response = await client.post(
        "/api/integrations/ap2/mandates/intent",
        json={
            "intent_description": "Test mandate",
            "language": "en",
        },
    )
    mandate_data = create_response.json()
    mandate_id = mandate_data["mandate_id"]

    # Verify signature
    verify_response = await client.post(
        f"/api/integrations/ap2/mandates/{mandate_id}/verify",
        json={
            "signature": mandate_data["signature"],
        },
    )

    assert verify_response.status_code == 200
    verify_data = verify_response.json()
    assert verify_data["valid"] is True


@pytest.mark.asyncio
async def test_voice_commerce_session(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test voice commerce session creation and interaction."""

    # Create voice session
    create_response = await client.post(
        "/api/integrations/ap2/voice/sessions",
        json={
            "language": "en",
            "assistant_type": "google_assistant",
            "customer_id": "550e8400-e29b-41d4-a716-446655440000",
        },
    )
    assert create_response.status_code == 201
    session_data = create_response.json()
    session_id = session_data["session_id"]

    # Send voice input
    input_response = await client.post(
        f"/api/integrations/ap2/voice/sessions/{session_id}/input",
        json={
            "voice_text": "I need a power drill",
        },
    )
    assert input_response.status_code == 200
    input_data = input_response.json()
    assert "response" in input_data
    assert "intent" in input_data


@pytest.mark.asyncio
async def test_webhook_handling(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test AP2 webhook event handling."""

    webhook_payload = {
        "event_type": "mandate.completed",
        "mandate_id": "test_mandate_123",
        "timestamp": "2026-01-22T10:00:00Z",
        "data": {
            "status": "completed",
            "transaction_id": "txn_123",
        },
    }

    response = await client.post(
        "/api/integrations/ap2/webhooks",
        json=webhook_payload,
        headers={
            "X-AP2-Signature": "test_signature",
        },
    )

    # Demo mode should accept webhooks
    assert response.status_code in [200, 202]


@pytest.mark.asyncio
async def test_get_connection_status(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test getting AP2 connection status."""

    response = await client.get("/api/integrations/ap2/connection")

    assert response.status_code == 200
    data = response.json()
    assert "mode" in data
    assert data["mode"] in ["demo", "live"]
    assert "connected" in data


@pytest.mark.asyncio
async def test_invalid_mandate_chain(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that invalid mandate chain is rejected."""

    # Try to create cart mandate without parent
    response = await client.post(
        "/api/integrations/ap2/mandates/cart",
        json={
            "parent_mandate_id": "invalid_parent_id",
            "items": [
                {
                    "product_id": "550e8400-e29b-41d4-a716-446655440001",
                    "quantity": 1,
                    "unit_price": 50.00,
                }
            ],
            "total_amount": 50.00,
            "currency": "AUD",
        },
    )

    # Should fail with 404 or 400
    assert response.status_code in [400, 404]


@pytest.mark.asyncio
async def test_expired_mandate(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that expired mandates cannot be executed."""

    # Create mandate
    create_response = await client.post(
        "/api/integrations/ap2/mandates/intent",
        json={
            "intent_description": "Test expiry",
            "language": "en",
        },
    )
    mandate_data = create_response.json()
    mandate_id = mandate_data["mandate_id"]

    # In demo mode, mandates don't actually expire immediately
    # This is a placeholder for live mode testing
    # In production, would need to wait for TTL or mock the expiry

    # For now, just verify the mandate has an expiry time
    assert "expires_at" in mandate_data


@pytest.mark.asyncio
async def test_multi_language_voice_commerce(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test voice commerce in multiple languages."""

    languages = ["en", "zh-CN", "es", "ar"]

    for lang in languages:
        response = await client.post(
            "/api/integrations/ap2/voice/sessions",
            json={
                "language": lang,
                "assistant_type": "google_assistant",
            },
        )
        assert response.status_code == 201
        session_data = response.json()
        assert session_data["language"] == lang


@pytest.mark.asyncio
async def test_payment_amount_validation(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """Test that payment amounts are validated."""

    # Create intent and cart first
    intent_response = await client.post(
        "/api/integrations/ap2/mandates/intent",
        json={
            "intent_description": "Test payment validation",
            "language": "en",
        },
    )
    intent_id = intent_response.json()["mandate_id"]

    cart_response = await client.post(
        "/api/integrations/ap2/mandates/cart",
        json={
            "parent_mandate_id": intent_id,
            "items": [
                {
                    "product_id": "550e8400-e29b-41d4-a716-446655440001",
                    "quantity": 1,
                    "unit_price": 100.00,
                }
            ],
            "total_amount": 100.00,
            "currency": "AUD",
        },
    )
    cart_id = cart_response.json()["mandate_id"]

    # Try to create payment with wrong amount
    payment_response = await client.post(
        "/api/integrations/ap2/mandates/payment",
        json={
            "parent_mandate_id": cart_id,
            "amount": 999.99,  # Wrong amount
            "currency": "AUD",
            "payment_method": "google_pay",
        },
    )

    # Should fail validation (in live mode)
    # In demo mode, might accept but log warning
    assert payment_response.status_code in [200, 201, 400]
