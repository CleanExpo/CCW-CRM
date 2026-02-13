"""
Test suite for Xero API Mock Framework.

Tests the mock client behavior, failure simulation, and call tracking.
Part of Phase 5 (Autonomous Development Framework) - Week 2 tests.
"""

import asyncio
from datetime import date

import pytest

from src.testing.xero_mock import (
    XeroMockClient,
    XeroMockConfig,
    XeroMockMode,
    create_xero_mock,
)


# ============================================================
# BASIC FUNCTIONALITY TESTS
# ============================================================


class TestXeroMockBasics:
    """Test basic Xero mock functionality."""

    @pytest.mark.asyncio
    async def test_mock_client_initialization(self):
        """Test mock client initializes correctly."""
        client = create_xero_mock()

        assert client.config.mode == XeroMockMode.SUCCESS
        assert len(client.call_history) == 0
        assert client._call_count == 0

    @pytest.mark.asyncio
    async def test_create_contact_success(self, xero_mock):
        """Test creating contact in SUCCESS mode."""
        result = await xero_mock.create_contact(
            name="Test Customer",
            email="test@example.com",
            phone="0400123456",
        )

        assert "ContactID" in result
        assert result["Name"] == "Test Customer"
        assert result["EmailAddress"] == "test@example.com"
        assert result["ContactStatus"] == "ACTIVE"

    @pytest.mark.asyncio
    async def test_get_contact_by_email_success(self, xero_mock):
        """Test getting contact by email in SUCCESS mode."""
        result = await xero_mock.get_contact_by_email("test@example.com")

        # Default returns None (not found)
        assert result is None

    @pytest.mark.asyncio
    async def test_create_invoice_success(self, xero_mock):
        """Test creating invoice in SUCCESS mode."""
        line_items = [
            {"description": "Product 1", "quantity": 2, "unit_amount": 100.00},
            {"description": "Product 2", "quantity": 1, "unit_amount": 50.00},
        ]

        result = await xero_mock.create_invoice(
            contact_id="test-contact",
            invoice_number="INV-1001",
            line_items=line_items,
        )

        assert "InvoiceID" in result
        assert result["InvoiceNumber"] == "INV-1001"
        assert result["Type"] == "ACCREC"
        assert result["SubTotal"] == 250.00
        assert result["TotalTax"] == 25.00
        assert result["Total"] == 275.00

    @pytest.mark.asyncio
    async def test_get_invoices_success(self, xero_mock):
        """Test getting invoices in SUCCESS mode."""
        result = await xero_mock.get_invoices(status="DRAFT")

        assert isinstance(result, list)
        assert len(result) == 3
        assert result[0]["Status"] == "DRAFT"

    @pytest.mark.asyncio
    async def test_create_payment_success(self, xero_mock):
        """Test creating payment in SUCCESS mode."""
        result = await xero_mock.create_payment(
            invoice_id="test-invoice",
            account_id="test-account",
            amount=275.00,
        )

        assert "PaymentID" in result
        assert result["Amount"] == 275.00
        assert result["Status"] == "AUTHORISED"

    @pytest.mark.asyncio
    async def test_get_bank_transactions_success(self, xero_mock):
        """Test getting bank transactions in SUCCESS mode."""
        result = await xero_mock.get_bank_transactions(status="AUTHORISED")

        assert isinstance(result, list)
        assert len(result) == 5
        assert all(tx["Status"] == "AUTHORISED" for tx in result)

    @pytest.mark.asyncio
    async def test_create_bank_transaction_success(self, xero_mock):
        """Test creating bank transaction in SUCCESS mode."""
        line_items = [{"description": "Payment", "quantity": 1, "unit_amount": 500.00}]

        result = await xero_mock.create_bank_transaction(
            transaction_type="SPEND",
            contact_id="test-contact",
            account_id="test-account",
            amount=500.00,
            line_items=line_items,
        )

        assert "BankTransactionID" in result
        assert result["Type"] == "SPEND"
        assert result["Total"] == 500.00


# ============================================================
# FAILURE SIMULATION TESTS
# ============================================================


class TestXeroMockFailures:
    """Test Xero mock failure simulation."""

    @pytest.mark.asyncio
    async def test_rate_limit_error(self, xero_mock_rate_limit):
        """Test rate limit simulation."""
        with pytest.raises(Exception, match="rate limit exceeded"):
            await xero_mock_rate_limit.create_contact(name="Test")

    @pytest.mark.asyncio
    async def test_timeout_error(self, xero_mock_timeout):
        """Test timeout simulation."""
        with pytest.raises(TimeoutError, match="timed out"):
            await xero_mock_timeout.create_invoice(
                contact_id="test",
                invoice_number="INV-001",
                line_items=[],
            )

    @pytest.mark.asyncio
    async def test_server_error(self, xero_mock_server_error):
        """Test server error simulation."""
        with pytest.raises(Exception, match="server error"):
            await xero_mock_server_error.get_invoices()

    @pytest.mark.asyncio
    async def test_unauthorized_error(self, xero_mock_unauthorized):
        """Test unauthorized error simulation."""
        with pytest.raises(Exception, match="authentication failed"):
            await xero_mock_unauthorized.create_contact(name="Test")

    @pytest.mark.asyncio
    async def test_validation_error(self, xero_mock_validation_error):
        """Test validation error simulation."""
        with pytest.raises(Exception, match="validation error"):
            await xero_mock_validation_error.create_invoice(
                contact_id="",
                invoice_number="",
                line_items=[],
            )

    @pytest.mark.asyncio
    async def test_intermittent_failures(self, xero_mock_intermittent):
        """Test intermittent failure mode."""
        success_count = 0
        failure_count = 0

        # Make 20 calls
        for _ in range(20):
            try:
                await xero_mock_intermittent.create_contact(name="Test")
                success_count += 1
            except Exception:
                failure_count += 1

        # Should have both successes and failures
        assert success_count > 0
        assert failure_count > 0


# ============================================================
# CALL TRACKING TESTS
# ============================================================


class TestXeroMockTracking:
    """Test Xero mock call tracking."""

    @pytest.mark.asyncio
    async def test_call_tracking_enabled(self, xero_mock_with_tracking):
        """Test call tracking records calls."""
        await xero_mock_with_tracking.create_contact(name="Test1")
        await xero_mock_with_tracking.create_contact(name="Test2")

        assert len(xero_mock_with_tracking.call_history) == 2
        assert xero_mock_with_tracking.call_history[0].method == "create_contact"
        assert xero_mock_with_tracking.call_history[1].method == "create_contact"

    @pytest.mark.asyncio
    async def test_get_call_count(self, xero_mock_with_tracking):
        """Test getting call count."""
        await xero_mock_with_tracking.create_contact(name="Test")
        await xero_mock_with_tracking.create_invoice(
            contact_id="test", invoice_number="INV-001", line_items=[]
        )
        await xero_mock_with_tracking.create_invoice(
            contact_id="test", invoice_number="INV-002", line_items=[]
        )

        total_count = xero_mock_with_tracking.get_call_count()
        contact_count = xero_mock_with_tracking.get_call_count("create_contact")
        invoice_count = xero_mock_with_tracking.get_call_count("create_invoice")

        assert total_count == 3
        assert contact_count == 1
        assert invoice_count == 2

    @pytest.mark.asyncio
    async def test_clear_call_history(self, xero_mock_with_tracking):
        """Test clearing call history."""
        await xero_mock_with_tracking.create_contact(name="Test")
        assert len(xero_mock_with_tracking.call_history) == 1

        xero_mock_with_tracking.clear_call_history()

        assert len(xero_mock_with_tracking.call_history) == 0
        assert xero_mock_with_tracking._call_count == 0

    @pytest.mark.asyncio
    async def test_call_tracking_records_args(self, xero_mock_with_tracking):
        """Test call tracking records arguments."""
        await xero_mock_with_tracking.create_contact(
            name="Test Customer",
            email="test@example.com",
            phone="0400123456",
        )

        call = xero_mock_with_tracking.call_history[0]
        assert call.kwargs["name"] == "Test Customer"
        assert call.kwargs["email"] == "test@example.com"
        assert call.kwargs["phone"] == "0400123456"

    @pytest.mark.asyncio
    async def test_call_tracking_records_response(self, xero_mock_with_tracking):
        """Test call tracking records response."""
        await xero_mock_with_tracking.create_contact(name="Test")

        call = xero_mock_with_tracking.call_history[0]
        assert call.response is not None
        assert "ContactID" in call.response

    @pytest.mark.asyncio
    async def test_call_tracking_records_errors(self):
        """Test call tracking records errors."""
        client = create_xero_mock(
            mode=XeroMockMode.SERVER_ERROR,
            call_tracking=True,
        )

        try:
            await client.create_contact(name="Test")
        except Exception:
            pass

        call = client.call_history[0]
        assert call.error is not None


# ============================================================
# CUSTOM RESPONSE TESTS
# ============================================================


class TestXeroMockCustomResponses:
    """Test custom response configuration."""

    @pytest.mark.asyncio
    async def test_set_custom_response(self, xero_mock):
        """Test setting custom response for a method."""

        def custom_contact(**kwargs):
            return {
                "ContactID": "custom-id",
                "Name": kwargs.get("name"),
                "Custom": True,
            }

        xero_mock.set_custom_response("create_contact", custom_contact)

        result = await xero_mock.create_contact(name="Custom Name")

        assert result["ContactID"] == "custom-id"
        assert result["Custom"] is True

    @pytest.mark.asyncio
    async def test_custom_response_for_lookup(self, xero_mock):
        """Test custom response that returns existing contact."""

        def custom_lookup(email):
            if email == "existing@example.com":
                return {"ContactID": "found-id", "EmailAddress": email}
            return None

        xero_mock.set_custom_response("get_contact_by_email", custom_lookup)

        # Should find existing
        result1 = await xero_mock.get_contact_by_email("existing@example.com")
        assert result1 is not None
        assert result1["ContactID"] == "found-id"

        # Should not find new
        result2 = await xero_mock.get_contact_by_email("new@example.com")
        assert result2 is None


# ============================================================
# INTEGRATION TESTS
# ============================================================


class TestXeroMockIntegration:
    """Integration tests for Xero mock with circuit breakers."""

    @pytest.mark.asyncio
    async def test_mock_with_circuit_breaker(self):
        """Test Xero mock with circuit breaker protection."""
        from src.services.circuit_breaker import CircuitBreakerManager, CircuitState

        manager = CircuitBreakerManager()
        manager.reset_all()

        # Create client that always fails
        client = create_xero_mock(mode=XeroMockMode.SERVER_ERROR)

        # Make 5 calls through circuit breaker
        failures = 0
        for _ in range(5):
            try:
                await manager.protect(
                    "xero-api",
                    client.create_contact,
                    name="Test",
                )
            except Exception:
                failures += 1

        # All calls should have failed
        assert failures == 5

        # Circuit should be open
        breaker = manager.get_breaker("xero-api")
        assert breaker.state == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_mock_with_retry_logic(self):
        """Test Xero mock with retry logic."""
        client = create_xero_mock(
            mode=XeroMockMode.INTERMITTENT,
            failure_rate=0.3,  # 30% failure rate
        )

        # Retry up to 10 times
        max_retries = 10
        success = False
        for attempt in range(max_retries):
            try:
                result = await client.create_invoice(
                    contact_id="test",
                    invoice_number="INV-001",
                    line_items=[],
                )
                # Success
                assert "InvoiceID" in result
                success = True
                break
            except Exception:
                await asyncio.sleep(0.01)

        # Should eventually succeed
        assert success, "Should have succeeded within retries"

    @pytest.mark.asyncio
    async def test_invoice_workflow(self, xero_mock_with_tracking):
        """Test complete invoice workflow."""
        # Step 1: Create contact
        contact = await xero_mock_with_tracking.create_contact(
            name="Test Customer",
            email="test@example.com",
        )

        # Step 2: Create invoice
        invoice = await xero_mock_with_tracking.create_invoice(
            contact_id=contact["ContactID"],
            invoice_number="INV-1001",
            line_items=[
                {"description": "Product", "quantity": 1, "unit_amount": 100.00}
            ],
        )

        # Step 3: Create payment
        payment = await xero_mock_with_tracking.create_payment(
            invoice_id=invoice["InvoiceID"],
            account_id="test-account",
            amount=invoice["Total"],
        )

        # Verify all operations tracked
        assert xero_mock_with_tracking.get_call_count() == 3
        assert xero_mock_with_tracking.get_call_count("create_contact") == 1
        assert xero_mock_with_tracking.get_call_count("create_invoice") == 1
        assert xero_mock_with_tracking.get_call_count("create_payment") == 1
