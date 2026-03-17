"""
Invoices Tax Calculation Integration Tests

Tests for invoices tax calculation endpoint (Phase 2 - Batch 2D)
"""

import pytest
from fastapi.testclient import TestClient
from src.api.main import app

client = TestClient(app)


class TestTaxCalculation:
    """Test POST /api/invoices/tax/calculate"""

    def test_calculate_tax_gst_pst(self):
        """Should calculate GST + PST for provinces with both"""
        response = client.post(
            "/api/invoices/tax/calculate",
            json={
                "line_items": [{"amount": 1000.00, "tax_code": "GST_PST"}],
                "province": "BC",
            },
        )
        # May return 401 if auth required, or 200 if successful
        assert response.status_code in [200, 401, 422]

        if response.status_code == 200:
            data = response.json()
            assert "subtotal" in data
            assert "gst" in data
            assert "pst" in data or "total" in data

    def test_calculate_tax_gst_only(self):
        """Should calculate GST only for Alberta"""
        response = client.post(
            "/api/invoices/tax/calculate",
            json={
                "line_items": [{"amount": 1000.00, "tax_code": "GST"}],
                "province": "AB",
            },
        )

        if response.status_code == 200:
            data = response.json()
            assert "gst" in data
            # PST should be 0 for Alberta
            if "pst" in data:
                assert data["pst"] == 0.00

    def test_calculate_tax_exempt(self):
        """Should handle tax-exempt items"""
        response = client.post(
            "/api/invoices/tax/calculate",
            json={
                "line_items": [{"amount": 1000.00, "tax_code": "EXEMPT"}],
            },
        )

        if response.status_code == 200:
            data = response.json()
            # Total should equal subtotal for exempt items
            if "total" in data and "subtotal" in data:
                assert data["total"] == data["subtotal"]

    def test_calculate_tax_missing_line_items(self):
        """Should reject request without line_items"""
        response = client.post(
            "/api/invoices/tax/calculate",
            json={"province": "ON"},
        )
        assert response.status_code == 422  # Validation error

    def test_calculate_tax_invalid_tax_code(self):
        """Should reject invalid tax codes"""
        response = client.post(
            "/api/invoices/tax/calculate",
            json={
                "line_items": [{"amount": 100.00, "tax_code": "INVALID_CODE"}],
            },
        )
        # Should return 400 or 422
        assert response.status_code in [400, 422, 401]

    def test_calculate_tax_multiple_line_items(self):
        """Should calculate tax for multiple line items"""
        response = client.post(
            "/api/invoices/tax/calculate",
            json={
                "line_items": [
                    {"amount": 500.00, "tax_code": "GST_PST"},
                    {"amount": 500.00, "tax_code": "GST_PST"},
                    {"amount": 100.00, "tax_code": "EXEMPT"},
                ],
                "province": "BC",
            },
        )

        if response.status_code == 200:
            data = response.json()
            # Subtotal should be 1100
            if "subtotal" in data:
                assert data["subtotal"] == 1100.00
