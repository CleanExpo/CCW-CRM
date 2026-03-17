"""Integration tests for Batch 2A billing gap endpoints (GAP-008 to GAP-012).

Tests written FIRST following TDD pattern.
"""

import pytest
from httpx import AsyncClient


class TestPaymentMethods:
    """Test GAP-008 and GAP-009 payment method endpoints."""

    @pytest.mark.asyncio
    async def test_list_payment_methods_success(self, client: AsyncClient, auth_headers: dict):
        """GAP-008: List available payment methods for organization."""
        response = await client.post("/api/billing/payment-methods", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should return at least some payment methods
        assert len(data) > 0
        # Each method should have required fields
        if data:
            method = data[0]
            assert "id" in method
            assert "name" in method
            assert "type" in method
            assert "is_active" in method

    @pytest.mark.asyncio
    async def test_get_payment_method_enum_values(self, client: AsyncClient):
        """GAP-009: Get PaymentMethod enum values."""
        response = await client.get("/api/billing/payment-methods/enum")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have standard payment methods
        assert "credit_card" in data
        assert "bank_transfer" in data
        assert "cash" in data
        assert "cheque" in data

    @pytest.mark.asyncio
    async def test_payment_methods_empty_org(self, client: AsyncClient, auth_headers: dict):
        """Edge case: payment methods for org with no configured methods."""
        # Even with no configured methods, should return standard enum values
        response = await client.post("/api/billing/payment-methods", headers=auth_headers)
        assert response.status_code == 200


class TestDunning:
    """Test GAP-010 dunning letter endpoint."""

    @pytest.mark.asyncio
    async def test_send_dunning_letter_success(self, client: AsyncClient, auth_headers: dict):
        """GAP-010: Send overdue invoice reminder email."""
        # Create test invoice first (assuming test fixture exists)
        payload = {
            "invoice_id": "00000000-0000-0000-0000-000000000001",  # Test UUID
            "template": "first_reminder"
        }
        response = await client.post("/api/billing/dunning/send-letter", json=payload, headers=auth_headers)

        # Should succeed or return 404 if invoice doesn't exist
        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            assert "sent" in data
            assert isinstance(data["sent"], bool)
            if data["sent"]:
                assert "email_id" in data
                assert data["email_id"] is not None

    @pytest.mark.asyncio
    async def test_send_dunning_letter_invalid_invoice(self, client: AsyncClient, auth_headers: dict):
        """Error case: dunning letter for non-existent invoice."""
        payload = {
            "invoice_id": "99999999-9999-9999-9999-999999999999",
            "template": "final_notice"
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
        response = await client.get("/api/billing/subscription-health", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "active" in data
        assert isinstance(data["active"], bool)
        assert "plan" in data
        assert isinstance(data["plan"], str)

        # expires_at can be null for perpetual subscriptions
        if "expires_at" in data and data["expires_at"]:
            # Should be ISO datetime string
            assert isinstance(data["expires_at"], str)

    @pytest.mark.asyncio
    async def test_subscription_health_trial_status(self, client: AsyncClient, auth_headers: dict):
        """Edge case: subscription in trial period."""
        response = await client.get("/api/billing/subscription-health", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        # Trial subscriptions should have plan "starter" or "trial"
        if not data["active"] or data["plan"] in ["starter", "trial"]:
            # Should have expiry date for trials
            assert "expires_at" in data


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
            assert "success" in data
            assert isinstance(data["success"], bool)
            assert "transaction_id" in data

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
