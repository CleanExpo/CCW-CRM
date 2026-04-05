"""Integration tests for billing endpoints (Phase 2 Batch 2A).

Tests for:
- GAP-010: POST /api/billing/payment-methods
- GAP-011: GET /api/billing/payment-methods/enum
- GAP-012: POST /api/billing/dunning/send-letter
- GAP-013: GET /api/billing/subscription-health
- GAP-014: POST /api/billing/retry-failed-payment
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from sqlalchemy import select

from src.db.demo_models import Customer
from src.db.models.invoicing import Invoice


class TestPaymentMethodEnum:
    """Tests for GAP-011: GET /api/billing/payment-methods/enum."""

    @pytest.mark.asyncio
    async def test_get_payment_method_enum_success(self, client):
        """Should return list of payment method types."""
        response = await client.get("/api/billing/payment-methods/enum")

        assert response.status_code == 200
        data = response.json()

        assert "types" in data
        assert isinstance(data["types"], list)
        assert len(data["types"]) == 5

        # Verify expected types exist
        types_values = [t["value"] for t in data["types"]]
        assert "credit_card" in types_values
        assert "bank_account" in types_values
        assert "paypal" in types_values
        assert "stripe" in types_values
        assert "square" in types_values

        # Verify structure
        for payment_type in data["types"]:
            assert "value" in payment_type
            assert "label" in payment_type
            assert isinstance(payment_type["value"], str)
            assert isinstance(payment_type["label"], str)


class TestCreatePaymentMethod:
    """Tests for GAP-010: POST /api/billing/payment-methods."""

    @pytest.mark.asyncio
    async def test_create_credit_card_payment_method(self, client, db_session):
        """Should create credit card payment method for customer."""
        # Create test customer
        customer = Customer(
            id=uuid4(),
            customer_number="TEST001",
            company_name="Test Company",
            contact_name="John Doe",
            email="john@test.com",
        )
        db_session.add(customer)
        await db_session.commit()

        # Create payment method
        payload = {
            "customer_id": str(customer.id),
            "type": "credit_card",
            "is_default": True,
            "card_number_last4": "4242",
            "card_brand": "visa",
            "expiry_month": 12,
            "expiry_year": 2025,
        }

        response = await client.post("/api/billing/payment-methods", json=payload)

        assert response.status_code == 200
        data = response.json()

        assert data["customer_id"] == str(customer.id)
        assert data["type"] == "credit_card"
        assert data["is_default"] is True
        assert data["is_verified"] is False
        assert "Visa •••• 4242" in data["display_name"]
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_create_bank_account_payment_method(self, client, db_session):
        """Should create bank account payment method for customer."""
        # Create test customer
        customer = Customer(
            id=uuid4(),
            customer_number="TEST002",
            company_name="Test Company 2",
            contact_name="Jane Doe",
            email="jane@test.com",
        )
        db_session.add(customer)
        await db_session.commit()

        # Create payment method
        payload = {
            "customer_id": str(customer.id),
            "type": "bank_account",
            "is_default": False,
            "account_number_last4": "1234",
            "routing_number": "123456789",
            "account_holder_name": "Jane Doe",
        }

        response = await client.post("/api/billing/payment-methods", json=payload)

        assert response.status_code == 200
        data = response.json()

        assert data["customer_id"] == str(customer.id)
        assert data["type"] == "bank_account"
        assert data["is_default"] is False
        assert "Bank Account •••• 1234" in data["display_name"]

    @pytest.mark.asyncio
    async def test_create_payment_method_customer_not_found(self, client):
        """Should return 404 if customer doesn't exist."""
        fake_customer_id = str(uuid4())

        payload = {
            "customer_id": fake_customer_id,
            "type": "credit_card",
            "is_default": True,
            "card_number_last4": "4242",
            "card_brand": "visa",
        }

        response = await client.post("/api/billing/payment-methods", json=payload)

        assert response.status_code == 404
        assert "Customer not found" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_create_payment_method_paypal(self, client, db_session):
        """Should create PayPal payment method with generic display name."""
        # Create test customer
        customer = Customer(
            id=uuid4(),
            customer_number="TEST003",
            company_name="Test Company 3",
            contact_name="Bob Smith",
            email="bob@test.com",
        )
        db_session.add(customer)
        await db_session.commit()

        # Create payment method
        payload = {
            "customer_id": str(customer.id),
            "type": "paypal",
            "is_default": False,
        }

        response = await client.post("/api/billing/payment-methods", json=payload)

        assert response.status_code == 200
        data = response.json()

        assert data["type"] == "paypal"
        assert data["display_name"] == "Paypal"


class TestDunningSendLetter:
    """Tests for GAP-012: POST /api/billing/dunning/send-letter."""

    @pytest.mark.asyncio
    async def test_send_dunning_letter_success(self, client, db_session):
        """Should send dunning letter for overdue invoice."""
        # Create test customer
        customer = Customer(
            id=uuid4(),
            customer_number="TEST004",
            company_name="Test Company 4",
            contact_name="Alice Johnson",
            email="alice@test.com",
        )
        db_session.add(customer)
        await db_session.commit()

        # Create overdue invoice (10 days overdue)
        invoice = Invoice(
            id=uuid4(),
            invoice_number="INV-TEST-001",
            customer_id=customer.id,
            invoice_date=date.today() - timedelta(days=20),
            due_date=date.today() - timedelta(days=10),
            status="sent",
            subtotal=Decimal("1000.00"),
            tax_rate=Decimal("10.00"),
            tax_amount=Decimal("100.00"),
            total=Decimal("1100.00"),
            amount_paid=Decimal("0.00"),
            amount_due=Decimal("1100.00"),
        )
        db_session.add(invoice)
        await db_session.commit()

        # Send dunning letter
        payload = {
            "invoice_id": str(invoice.id),
            "force_send": False,
        }

        response = await client.post("/api/billing/dunning/send-letter", json=payload)

        assert response.status_code == 200
        data = response.json()

        assert data["invoice_id"] == str(invoice.id)
        assert data["level"] == 2  # 10 days = FORMAL_NOTICE
        assert data["letter_sent"] is True
        assert data["email_sent_to"] == "customer@example.com"
        assert "Payment Required" in data["subject"]
        assert len(data["body_preview"]) > 0
        assert data["reason"] == "Sent successfully"

    @pytest.mark.asyncio
    async def test_send_dunning_letter_invoice_not_found(self, client):
        """Should return 404 if invoice doesn't exist."""
        fake_invoice_id = str(uuid4())

        payload = {
            "invoice_id": fake_invoice_id,
            "force_send": False,
        }

        response = await client.post("/api/billing/dunning/send-letter", json=payload)

        assert response.status_code == 404
        assert "Invoice not found" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_send_dunning_letter_invoice_paid(self, client, db_session):
        """Should return 400 if invoice is already paid."""
        # Create test customer
        customer = Customer(
            id=uuid4(),
            customer_number="TEST005",
            company_name="Test Company 5",
            contact_name="Charlie Brown",
            email="charlie@test.com",
        )
        db_session.add(customer)
        await db_session.commit()

        # Create paid invoice
        invoice = Invoice(
            id=uuid4(),
            invoice_number="INV-TEST-002",
            customer_id=customer.id,
            invoice_date=date.today() - timedelta(days=20),
            due_date=date.today() - timedelta(days=10),
            status="paid",
            subtotal=Decimal("1000.00"),
            tax_rate=Decimal("10.00"),
            tax_amount=Decimal("100.00"),
            total=Decimal("1100.00"),
            amount_paid=Decimal("1100.00"),
            amount_due=Decimal("0.00"),
        )
        db_session.add(invoice)
        await db_session.commit()

        # Try to send dunning letter
        payload = {
            "invoice_id": str(invoice.id),
            "force_send": False,
        }

        response = await client.post("/api/billing/dunning/send-letter", json=payload)

        assert response.status_code == 400
        assert "already paid" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_send_dunning_letter_not_yet_due(self, client, db_session):
        """Should return 400 if invoice is not yet overdue."""
        # Create test customer
        customer = Customer(
            id=uuid4(),
            customer_number="TEST006",
            company_name="Test Company 6",
            contact_name="Diana Prince",
            email="diana@test.com",
        )
        db_session.add(customer)
        await db_session.commit()

        # Create invoice due in future
        invoice = Invoice(
            id=uuid4(),
            invoice_number="INV-TEST-003",
            customer_id=customer.id,
            invoice_date=date.today(),
            due_date=date.today() + timedelta(days=30),
            status="sent",
            subtotal=Decimal("1000.00"),
            tax_rate=Decimal("10.00"),
            tax_amount=Decimal("100.00"),
            total=Decimal("1100.00"),
            amount_paid=Decimal("0.00"),
            amount_due=Decimal("1100.00"),
        )
        db_session.add(invoice)
        await db_session.commit()

        # Try to send dunning letter
        payload = {
            "invoice_id": str(invoice.id),
            "force_send": False,
        }

        response = await client.post("/api/billing/dunning/send-letter", json=payload)

        assert response.status_code == 400
        assert "not overdue yet" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_send_dunning_letter_force_send(self, client, db_session):
        """Should send dunning letter even if normally wouldn't send when force_send=True."""
        # Create test customer
        customer = Customer(
            id=uuid4(),
            customer_number="TEST007",
            company_name="Test Company 7",
            contact_name="Eve Adams",
            email="eve@test.com",
        )
        db_session.add(customer)
        await db_session.commit()

        # Create slightly overdue invoice (8 days)
        invoice = Invoice(
            id=uuid4(),
            invoice_number="INV-TEST-004",
            customer_id=customer.id,
            invoice_date=date.today() - timedelta(days=18),
            due_date=date.today() - timedelta(days=8),
            status="sent",
            subtotal=Decimal("1000.00"),
            tax_rate=Decimal("10.00"),
            tax_amount=Decimal("100.00"),
            total=Decimal("1100.00"),
            amount_paid=Decimal("0.00"),
            amount_due=Decimal("1100.00"),
        )
        db_session.add(invoice)
        await db_session.commit()

        # Send with force_send=True
        payload = {
            "invoice_id": str(invoice.id),
            "force_send": True,
        }

        response = await client.post("/api/billing/dunning/send-letter", json=payload)

        assert response.status_code == 200
        data = response.json()

        assert data["level"] == 1  # 8 days = FRIENDLY_REMINDER
        assert data["letter_sent"] is True


class TestSubscriptionHealth:
    """Tests for GAP-013: GET /api/billing/subscription-health."""

    @pytest.mark.asyncio
    async def test_get_subscription_health_success(self, client, db_session):
        """Should return subscription health metrics."""
        # Create test organization (use any UUID for now)
        org_id = str(uuid4())

        response = await client.get(
            f"/api/billing/subscription-health?organization_id={org_id}"
        )

        assert response.status_code == 200
        data = response.json()

        # Verify all required fields present
        assert "total_subscriptions" in data
        assert "active" in data
        assert "past_due" in data
        assert "cancelled" in data
        assert "trial" in data
        assert "mrr" in data
        assert "churn_rate" in data
        assert "health_score" in data

        # Verify types
        assert isinstance(data["total_subscriptions"], int)
        assert isinstance(data["active"], int)
        assert isinstance(data["past_due"], int)
        assert isinstance(data["cancelled"], int)
        assert isinstance(data["trial"], int)
        assert isinstance(data["churn_rate"], float)
        assert isinstance(data["health_score"], int)

        # Verify health score is in valid range
        assert 0 <= data["health_score"] <= 100

        # Verify mock data
        assert data["total_subscriptions"] == 150
        assert data["active"] == 135
        assert data["mrr"] == "12500.00"

    @pytest.mark.asyncio
    async def test_get_subscription_health_missing_org_id(self, client):
        """Should return 422 if organization_id query param missing."""
        response = await client.get("/api/billing/subscription-health")

        assert response.status_code == 422


class TestRetryFailedPayment:
    """Tests for GAP-014: POST /api/billing/retry-failed-payment."""

    @pytest.mark.asyncio
    async def test_retry_failed_payment_success(self, client, db_session):
        """Should retry payment and return success."""
        # Create test customer
        customer = Customer(
            id=uuid4(),
            customer_number="TEST008",
            company_name="Test Company 8",
            contact_name="Frank Castle",
            email="frank@test.com",
        )
        db_session.add(customer)
        await db_session.commit()

        # Create unpaid invoice
        invoice = Invoice(
            id=uuid4(),
            invoice_number="INV-TEST-005",
            customer_id=customer.id,
            invoice_date=date.today() - timedelta(days=10),
            due_date=date.today() - timedelta(days=5),
            status="sent",
            subtotal=Decimal("1000.00"),
            tax_rate=Decimal("10.00"),
            tax_amount=Decimal("100.00"),
            total=Decimal("1100.00"),
            amount_paid=Decimal("0.00"),
            amount_due=Decimal("1100.00"),
        )
        db_session.add(invoice)
        await db_session.commit()

        # Retry payment (mock has 90% success rate, but we can't control randomness)
        # Test at least returns proper structure
        payload = {
            "invoice_id": str(invoice.id),
            "payment_method_id": None,
        }

        response = await client.post("/api/billing/retry-failed-payment", json=payload)

        assert response.status_code == 200
        data = response.json()

        assert data["invoice_id"] == str(invoice.id)
        assert data["payment_status"] in ["paid", "failed"]

        if data["payment_status"] == "paid":
            assert data["transaction_id"] is not None
            assert data["error_message"] is None
        else:
            assert data["transaction_id"] is None
            assert data["error_message"] is not None

    @pytest.mark.asyncio
    async def test_retry_failed_payment_invoice_not_found(self, client):
        """Should return 404 if invoice doesn't exist."""
        fake_invoice_id = str(uuid4())

        payload = {
            "invoice_id": fake_invoice_id,
            "payment_method_id": None,
        }

        response = await client.post("/api/billing/retry-failed-payment", json=payload)

        assert response.status_code == 404
        assert "Invoice not found" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_retry_failed_payment_already_paid(self, client, db_session):
        """Should return 400 if invoice is already paid."""
        # Create test customer
        customer = Customer(
            id=uuid4(),
            customer_number="TEST009",
            company_name="Test Company 9",
            contact_name="Grace Hopper",
            email="grace@test.com",
        )
        db_session.add(customer)
        await db_session.commit()

        # Create paid invoice
        invoice = Invoice(
            id=uuid4(),
            invoice_number="INV-TEST-006",
            customer_id=customer.id,
            invoice_date=date.today() - timedelta(days=10),
            due_date=date.today() - timedelta(days=5),
            status="paid",
            subtotal=Decimal("1000.00"),
            tax_rate=Decimal("10.00"),
            tax_amount=Decimal("100.00"),
            total=Decimal("1100.00"),
            amount_paid=Decimal("1100.00"),
            amount_due=Decimal("0.00"),
        )
        db_session.add(invoice)
        await db_session.commit()

        # Try to retry payment
        payload = {
            "invoice_id": str(invoice.id),
            "payment_method_id": None,
        }

        response = await client.post("/api/billing/retry-failed-payment", json=payload)

        assert response.status_code == 400
        assert "already paid" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_retry_failed_payment_with_payment_method(self, client, db_session):
        """Should accept optional payment_method_id parameter."""
        # Create test customer
        customer = Customer(
            id=uuid4(),
            customer_number="TEST010",
            company_name="Test Company 10",
            contact_name="Henry Ford",
            email="henry@test.com",
        )
        db_session.add(customer)
        await db_session.commit()

        # Create unpaid invoice
        invoice = Invoice(
            id=uuid4(),
            invoice_number="INV-TEST-007",
            customer_id=customer.id,
            invoice_date=date.today() - timedelta(days=10),
            due_date=date.today() - timedelta(days=5),
            status="sent",
            subtotal=Decimal("1000.00"),
            tax_rate=Decimal("10.00"),
            tax_amount=Decimal("100.00"),
            total=Decimal("1100.00"),
            amount_paid=Decimal("0.00"),
            amount_due=Decimal("1100.00"),
        )
        db_session.add(invoice)
        await db_session.commit()

        # Retry payment with specific payment method
        payment_method_id = str(uuid4())
        payload = {
            "invoice_id": str(invoice.id),
            "payment_method_id": payment_method_id,
        }

        response = await client.post("/api/billing/retry-failed-payment", json=payload)

        assert response.status_code == 200
        data = response.json()

        assert data["invoice_id"] == str(invoice.id)
        assert data["payment_status"] in ["paid", "failed"]
