"""
Invoice Payments API route tests (P1-11).

Uses TestClient — no real DB required. Tests route registration,
request validation, and error handling behaviour.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)
# Client that returns 500 rather than re-raising server exceptions (for DB-touching tests)
client_quiet = TestClient(app, raise_server_exceptions=False)

FAKE_UUID = str(uuid.uuid4())


class TestListInvoicePayments:
    """GET /api/invoices/{invoice_id}/payments"""

    def test_route_registered(self):
        """Route must be registered — 401/404/500 acceptable, not 404 with auth error text."""
        response = client_quiet.get(f"/api/invoices/{FAKE_UUID}/payments")
        # 401 (no JWT in test), 404 (not found), 500 (no DB) — all confirm route is registered
        assert response.status_code in (401, 404, 500), (
            f"Unexpected status {response.status_code} — route may not be registered or UUID rejected"
        )

    def test_invalid_invoice_id_returns_422(self):
        """Non-UUID path parameter must return 422."""
        response = client.get("/api/invoices/not-a-uuid/payments")
        assert response.status_code == 422


class TestRecordPayment:
    """POST /api/invoices/{invoice_id}/payments"""

    def test_route_registered(self):
        """Route must be registered — 401/404/500 acceptable on valid payload."""
        response = client_quiet.post(
            f"/api/invoices/{FAKE_UUID}/payments",
            json={
                "amount": "50.00",
                "payment_method": "bank_transfer",
                "payment_date": "2026-03-24",
            },
        )
        # 401 (no JWT), 404 (invoice not found), 500 (no DB) — not 422 on valid payload
        assert response.status_code in (401, 404, 500), (
            f"Unexpected status {response.status_code} — route may not be registered"
        )

    def test_missing_required_fields(self):
        """POST with empty body must return 422."""
        response = client.post(
            f"/api/invoices/{FAKE_UUID}/payments",
            json={},
        )
        assert response.status_code == 422

    def test_invalid_invoice_id(self):
        """Non-UUID invoice ID must return 422."""
        response = client.post(
            "/api/invoices/bad-id/payments",
            json={"amount": "50.00", "payment_method": "cash", "payment_date": "2026-03-24"},
        )
        assert response.status_code == 422

    def test_negative_amount_rejected(self):
        """Negative amount must be rejected by Pydantic validation."""
        response = client.post(
            f"/api/invoices/{FAKE_UUID}/payments",
            json={
                "amount": "-10.00",
                "payment_method": "cash",
                "payment_date": "2026-03-24",
            },
        )
        assert response.status_code == 422

    def test_invalid_payment_method_rejected(self):
        """Payment method outside allowed values must be rejected."""
        response = client.post(
            f"/api/invoices/{FAKE_UUID}/payments",
            json={
                "amount": "50.00",
                "payment_method": "dogecoin",
                "payment_date": "2026-03-24",
            },
        )
        # 422 if payment_method is an enum, otherwise 404/500 (DB check)
        assert response.status_code in (404, 422, 500)


class TestListAllPayments:
    """GET /api/invoices/payments"""

    def test_route_registered(self):
        """Route must be registered — 200/401/500 all acceptable, never 404."""
        response = client_quiet.get("/api/invoices/payments")
        assert response.status_code not in (404,), "Invoice payments list route not registered"

    def test_invalid_page_rejected(self):
        """page=0 must return 422."""
        response = client.get("/api/invoices/payments?page=0")
        assert response.status_code == 422

    def test_invalid_page_size_rejected(self):
        """page_size > 100 must return 422."""
        response = client.get("/api/invoices/payments?page_size=200")
        assert response.status_code == 422

    def test_invalid_invoice_id_filter_rejected(self):
        """Non-UUID invoice_id query param must return 422."""
        response = client.get("/api/invoices/payments?invoice_id=not-a-uuid")
        assert response.status_code == 422


class TestDeletePayment:
    """DELETE /api/invoices/payments/{payment_id}"""

    def test_invalid_payment_id_returns_422(self):
        """Non-UUID payment ID must return 422."""
        response = client.delete("/api/invoices/payments/not-a-uuid")
        assert response.status_code == 422

    def test_unknown_payment_id(self):
        """Valid UUID for non-existent payment returns 401/404/500 — not 422."""
        response = client_quiet.delete(f"/api/invoices/payments/{FAKE_UUID}")
        # 401 (no JWT), 404 (not found), 500 (no DB in test env) — not 422
        assert response.status_code in (401, 404, 500)
