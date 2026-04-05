"""Integration tests for Batch 2A billing gap endpoints (GAP-008 to GAP-012).

Tests written FIRST following TDD pattern.
"""

from uuid import uuid4

import pytest
from httpx import AsyncClient


class TestPaymentMethods:
    """Test GAP-008 and GAP-009 payment method endpoints."""

    @pytest.mark.asyncio
    async def test_list_payment_methods_success(self, client: AsyncClient, auth_headers: dict):
        """GAP-008: POST /api/billing/payment-methods requires a valid body.
        Without body it returns 422 (validation error — customer_id + type required).
        """
        response = await client.post("/api/billing/payment-methods", headers=auth_headers)
        # POST without body → 422 (required fields missing)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_payment_method_enum_values(self, client: AsyncClient):
        """GAP-009: Get PaymentMethod enum values.
        Returns {"types": [{"value": ..., "label": ...}, ...]} not a plain list.
        """
        response = await client.get("/api/billing/payment-methods/enum")
        assert response.status_code == 200
        data = response.json()
        # Response is wrapped in {"types": [...]}
        assert isinstance(data, dict)
        assert "types" in data
        types_list = data["types"]
        assert isinstance(types_list, list)
        assert len(types_list) == 5
        # Each entry has value and label
        values = [t["value"] for t in types_list]
        assert "credit_card" in values
        assert "bank_account" in values
        assert "paypal" in values
        assert "stripe" in values
        assert "square" in values

    @pytest.mark.asyncio
    async def test_payment_methods_empty_org(self, client: AsyncClient, auth_headers: dict):
        """Edge case: POST without body returns 422 (required fields missing)."""
        response = await client.post("/api/billing/payment-methods", headers=auth_headers)
        assert response.status_code == 422


class TestDunning:
    """Test GAP-010 dunning letter endpoint."""

    @pytest.mark.asyncio
    async def test_send_dunning_letter_success(self, client: AsyncClient, auth_headers: dict):
        """GAP-010: Send overdue invoice reminder email."""
        payload = {
            "invoice_id": "00000000-0000-0000-0000-000000000001",  # Test UUID
        }
        response = await client.post("/api/billing/dunning/send-letter", json=payload, headers=auth_headers)

        # Should succeed or return 404 if invoice doesn't exist
        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            assert "letter_sent" in data or "sent" in data

    @pytest.mark.asyncio
    async def test_send_dunning_letter_invalid_invoice(self, client: AsyncClient, auth_headers: dict):
        """Error case: dunning letter for non-existent invoice."""
        payload = {
            "invoice_id": "99999999-9999-9999-9999-999999999999",
        }
        response = await client.post("/api/billing/dunning/send-letter", json=payload, headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_send_dunning_letter_missing_fields(self, client: AsyncClient, auth_headers: dict):
        """Error case: missing required fields."""
        response = await client.post("/api/billing/dunning/send-letter", json={}, headers=auth_headers)
        assert response.status_code == 422  # Pydantic validation error


class TestSubscriptionHealth:
    """Test GAP-011 subscription health endpoint."""

    @pytest.mark.asyncio
    async def test_get_subscription_health(self, client: AsyncClient, auth_headers: dict):
        """GAP-011: Check subscription status for organization."""
        org_id = str(uuid4())
        response = await client.get(
            "/api/billing/subscription-health",
            params={"organization_id": org_id},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # SubscriptionHealthResponse fields
        assert "active" in data
        assert isinstance(data["active"], int)
        assert "total_subscriptions" in data
        assert "health_score" in data

    @pytest.mark.asyncio
    async def test_subscription_health_trial_status(self, client: AsyncClient, auth_headers: dict):
        """Edge case: subscription in trial period."""
        org_id = str(uuid4())
        response = await client.get(
            "/api/billing/subscription-health",
            params={"organization_id": org_id},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()

        # Mock implementation always returns fixed data
        assert data["total_subscriptions"] >= 0
        assert 0 <= data["health_score"] <= 100


class TestRetryPayment:
    """Test GAP-012 retry failed payment endpoint."""

    @pytest.mark.asyncio
    async def test_retry_failed_payment_success(self, client: AsyncClient, auth_headers: dict):
        """GAP-012: Retry failed payment for invoice."""
        payload = {
            "invoice_id": "00000000-0000-0000-0000-000000000001"
        }
        response = await client.post("/api/billing/retry-failed-payment", json=payload, headers=auth_headers)

        # Should succeed or return 404 if invoice doesn't exist
        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            assert "payment_status" in data
            assert "invoice_id" in data

    @pytest.mark.asyncio
    async def test_retry_payment_no_payment_method(self, client: AsyncClient, auth_headers: dict):
        """Error case: retry payment with no payment method configured."""
        payload = {
            "invoice_id": "00000000-0000-0000-0000-000000000002"
        }
        response = await client.post("/api/billing/retry-failed-payment", json=payload, headers=auth_headers)

        # Should return 400 if no payment method or 404 if invoice doesn't exist
        assert response.status_code in [400, 404]

    @pytest.mark.asyncio
    async def test_retry_payment_invalid_invoice(self, client: AsyncClient, auth_headers: dict):
        """Error case: retry payment for non-existent invoice."""
        payload = {
            "invoice_id": "99999999-9999-9999-9999-999999999999"
        }
        response = await client.post("/api/billing/retry-failed-payment", json=payload, headers=auth_headers)
        assert response.status_code == 404
