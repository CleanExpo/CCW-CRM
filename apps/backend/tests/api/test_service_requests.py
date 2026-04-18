"""
Warranty period minimum validation tests — ACL statutory requirement (UNI-1826).

Under Australian Consumer Law s.54, consumer goods must carry a minimum
12-month statutory guarantee.  These tests verify that both the equipment
lifecycle and workshop equipment endpoints reject warranty periods shorter
than 12 months with HTTP 422.

Uses TestClient — no real DB required. Tests Pydantic validation only.
"""

import pytest
from fastapi.testclient import TestClient

from src.api.main import app

client = TestClient(app)
# client_quiet suppresses server-side exceptions (DB unavailable in test env).
# Use it when testing requests that pass Pydantic validation and reach the handler.
client_quiet = TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Equipment Lifecycle endpoint: POST /api/equipment/units
# ---------------------------------------------------------------------------


class TestEquipmentUnitWarrantyValidation:
    """warranty_months on EquipmentUnit must be ≥ 12 (ACL minimum)."""

    def test_warranty_months_below_12_rejected(self):
        """warranty_months=6 must return 422 — below ACL minimum."""
        response = client.post(
            "/api/equipment/units",
            json={"serial_number": "TEST-SN-001", "warranty_months": 6},
        )
        assert response.status_code == 422, (
            f"Expected 422 for warranty_months=6, got {response.status_code}"
        )

    def test_warranty_months_zero_rejected(self):
        """warranty_months=0 must return 422."""
        response = client.post(
            "/api/equipment/units",
            json={"serial_number": "TEST-SN-002", "warranty_months": 0},
        )
        assert response.status_code == 422

    def test_warranty_months_11_rejected(self):
        """warranty_months=11 (one month below minimum) must return 422."""
        response = client.post(
            "/api/equipment/units",
            json={"serial_number": "TEST-SN-003", "warranty_months": 11},
        )
        assert response.status_code == 422

    def test_warranty_months_12_passes_validation(self):
        """warranty_months=12 must pass Pydantic validation (DB may 500, not 422)."""
        response = client_quiet.post(
            "/api/equipment/units",
            json={"serial_number": "TEST-SN-004", "warranty_months": 12},
        )
        # 422 = Pydantic rejection — must NOT happen. 500 is DB failure, acceptable in test env.
        assert response.status_code != 422, (
            f"warranty_months=12 should pass validation, not return 422"
        )

    def test_warranty_months_24_passes_validation(self):
        """warranty_months=24 (above minimum) must pass Pydantic validation."""
        response = client_quiet.post(
            "/api/equipment/units",
            json={"serial_number": "TEST-SN-005", "warranty_months": 24},
        )
        assert response.status_code != 422, (
            f"warranty_months=24 should pass validation, not return 422"
        )

    def test_warranty_months_omitted_passes_validation(self):
        """Omitting warranty_months (None) must pass validation — field is optional."""
        response = client_quiet.post(
            "/api/equipment/units",
            json={"serial_number": "TEST-SN-006"},
        )
        assert response.status_code != 422, (
            f"Omitting warranty_months should pass validation"
        )


# ---------------------------------------------------------------------------
# Workshop equipment endpoint: POST /api/workshop/equipment
# ---------------------------------------------------------------------------


class TestWorkshopEquipmentWarrantyValidation:
    """warranty_period_months on workshop Equipment must be ≥ 12 (ACL minimum)."""

    _BASE_PAYLOAD = {
        "customer_id": "00000000-0000-0000-0000-000000000001",
        "serial_number": "WS-SN-001",
        "make": "Karcher",
        "model": "HD 5/15",
        "location": "warehouse",
    }

    def test_warranty_period_months_below_12_rejected(self):
        """warranty_period_months=6 must return 422 — below ACL minimum."""
        payload = {**self._BASE_PAYLOAD, "warranty_period_months": 6}
        response = client.post("/api/workshop/equipment", json=payload)
        assert response.status_code == 422, (
            f"Expected 422 for warranty_period_months=6, got {response.status_code}"
        )

    def test_warranty_period_months_1_rejected(self):
        """warranty_period_months=1 must return 422."""
        payload = {**self._BASE_PAYLOAD, "warranty_period_months": 1}
        response = client.post("/api/workshop/equipment", json=payload)
        assert response.status_code == 422

    def test_warranty_period_months_11_rejected(self):
        """warranty_period_months=11 must return 422."""
        payload = {**self._BASE_PAYLOAD, "warranty_period_months": 11}
        response = client.post("/api/workshop/equipment", json=payload)
        assert response.status_code == 422

    def test_warranty_period_months_12_passes_validation(self):
        """warranty_period_months=12 must pass Pydantic validation."""
        payload = {**self._BASE_PAYLOAD, "warranty_period_months": 12}
        response = client_quiet.post("/api/workshop/equipment", json=payload)
        assert response.status_code != 422, (
            f"warranty_period_months=12 should pass validation"
        )

    def test_warranty_period_months_omitted_passes_validation(self):
        """Omitting warranty_period_months must pass validation — field is optional."""
        response = client_quiet.post("/api/workshop/equipment", json=self._BASE_PAYLOAD)
        assert response.status_code != 422, (
            f"Omitting warranty_period_months should pass validation"
        )

    def test_warranty_period_months_below_12_on_update_rejected(self):
        """PUT /api/workshop/equipment/{id} with warranty_period_months=3 must return 422."""
        response = client.put(
            "/api/workshop/equipment/00000000-0000-0000-0000-000000000001",
            json={"warranty_period_months": 3},
        )
        assert response.status_code == 422, (
            f"Expected 422 for update with warranty_period_months=3, got {response.status_code}"
        )

    def test_warranty_period_months_12_on_update_passes_validation(self):
        """PUT /api/workshop/equipment/{id} with warranty_period_months=12 must pass validation."""
        response = client_quiet.put(
            "/api/workshop/equipment/00000000-0000-0000-0000-000000000001",
            json={"warranty_period_months": 12},
        )
        # Must not be a Pydantic 422 rejection. 404/500 = no DB, which is acceptable.
        assert response.status_code != 422, (
            f"warranty_period_months=12 on update should pass validation"
        )
