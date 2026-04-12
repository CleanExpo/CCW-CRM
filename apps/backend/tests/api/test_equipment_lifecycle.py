"""
Equipment Lifecycle API Tests — Sprint 2

Covers:
  GET  /api/equipment/units
  POST /api/equipment/units
  GET  /api/equipment/units/{serial}
  GET  /api/equipment/warranty-alerts
  GET  /api/equipment/stats

Uses the project's standard AsyncClient + auth_headers fixture pattern.
All tests are safe on a clean or partially-seeded DB — they never assume
data exists and handle empty results gracefully.
"""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


def _unique_serial() -> str:
    """Generate a unique serial number so tests never conflict."""
    return f"SN-PYTEST-{uuid.uuid4().hex[:8].upper()}"


# ---------------------------------------------------------------------------
# GET /api/equipment/units
# ---------------------------------------------------------------------------


class TestListEquipmentUnits:
    @pytest.mark.asyncio
    async def test_list_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/equipment/units", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_list_is_list(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/equipment/units", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_list_customer_filter_accepted(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        fake = str(uuid.uuid4())
        resp = await client.get(
            f"/api/equipment/units?customer_id={fake}", headers=auth_headers
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_list_active_only_filter(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/equipment/units?active_only=true", headers=auth_headers
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_list_inactive_filter(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/equipment/units?active_only=false", headers=auth_headers
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_list_item_shape_when_populated(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/equipment/units", headers=auth_headers)
        assert resp.status_code == 200
        items = resp.json()
        if items:
            unit = items[0]
            for field in ("id", "serial_number", "is_active", "created_at"):
                assert field in unit, f"Missing field: {field}"


# ---------------------------------------------------------------------------
# POST /api/equipment/units
# ---------------------------------------------------------------------------


class TestCreateEquipmentUnit:
    @pytest.mark.asyncio
    async def test_create_minimal_payload(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/equipment/units",
            json={"serial_number": _unique_serial()},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 201)

    @pytest.mark.asyncio
    async def test_create_full_payload_with_warranty_months(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/equipment/units",
            json={
                "serial_number": _unique_serial(),
                "warranty_months": 24,
                "notes": "Test unit — 24 month warranty",
            },
            headers=auth_headers,
        )
        assert resp.status_code in (200, 201)

    @pytest.mark.asyncio
    async def test_create_warranty_expiry_auto_calculated(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """When warranty_months provided, warranty_expiry must be populated."""
        resp = await client.post(
            "/api/equipment/units",
            json={"serial_number": _unique_serial(), "warranty_months": 12},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data.get("warranty_expiry") is not None

    @pytest.mark.asyncio
    async def test_create_response_has_id(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/equipment/units",
            json={"serial_number": _unique_serial()},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert "id" in data
        assert "serial_number" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_create_duplicate_serial_returns_409(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """serial_number has UNIQUE constraint — duplicate must return 409."""
        serial = _unique_serial()
        await client.post(
            "/api/equipment/units",
            json={"serial_number": serial},
            headers=auth_headers,
        )
        resp = await client.post(
            "/api/equipment/units",
            json={"serial_number": serial},
            headers=auth_headers,
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_create_missing_serial_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/equipment/units", json={}, headers=auth_headers
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_invalid_uuid_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/equipment/units",
            json={"serial_number": "SN-X", "customer_id": "not-a-uuid"},
            headers=auth_headers,
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/equipment/units/{serial}
# ---------------------------------------------------------------------------


class TestGetEquipmentBySerial:
    @pytest.mark.asyncio
    async def test_get_nonexistent_serial_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/equipment/units/SERIAL-DOES-NOT-EXIST-PYTEST",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_existing_serial_returns_unit(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        serial = _unique_serial()
        await client.post(
            "/api/equipment/units",
            json={"serial_number": serial},
            headers=auth_headers,
        )
        resp = await client.get(
            f"/api/equipment/units/{serial}", headers=auth_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["serial_number"] == serial

    @pytest.mark.asyncio
    async def test_get_response_has_required_fields(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        serial = _unique_serial()
        create_resp = await client.post(
            "/api/equipment/units",
            json={"serial_number": serial},
            headers=auth_headers,
        )
        assert create_resp.status_code in (200, 201)
        get_resp = await client.get(
            f"/api/equipment/units/{serial}", headers=auth_headers
        )
        assert get_resp.status_code == 200
        data = get_resp.json()
        for field in ("id", "serial_number", "is_active", "created_at", "updated_at"):
            assert field in data, f"Missing field: {field}"


# ---------------------------------------------------------------------------
# GET /api/equipment/warranty-alerts
# ---------------------------------------------------------------------------


class TestWarrantyAlerts:
    @pytest.mark.asyncio
    async def test_alerts_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/equipment/warranty-alerts", headers=auth_headers
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_alerts_is_list(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/equipment/warranty-alerts", headers=auth_headers
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_alerts_days_30(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/equipment/warranty-alerts?days=30", headers=auth_headers
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_alerts_days_90(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/equipment/warranty-alerts?days=90", headers=auth_headers
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_alerts_item_shape_when_populated(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/equipment/warranty-alerts?days=365", headers=auth_headers
        )
        assert resp.status_code == 200
        items = resp.json()
        if items:
            for field in ("serial_number", "days_until_expiry"):
                assert field in items[0], f"Missing field: {field}"


# ---------------------------------------------------------------------------
# GET /api/equipment/stats
# ---------------------------------------------------------------------------


class TestEquipmentStats:
    @pytest.mark.asyncio
    async def test_stats_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/equipment/stats", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_stats_has_required_fields(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/equipment/stats", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        for field in ("total_units", "active_units", "expiring_soon", "warranty_alerts"):
            assert field in data, f"Missing field: {field}"

    @pytest.mark.asyncio
    async def test_stats_counts_are_non_negative(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/equipment/stats", headers=auth_headers)
        data = resp.json()
        for field in ("total_units", "active_units", "expiring_soon"):
            assert data[field] >= 0, f"{field} should be non-negative"

    @pytest.mark.asyncio
    async def test_stats_warranty_alerts_is_list(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/equipment/stats", headers=auth_headers)
        data = resp.json()
        assert isinstance(data["warranty_alerts"], list)

    @pytest.mark.asyncio
    async def test_stats_reflect_created_unit(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """After creating a unit, total_units should increase."""
        before = (
            await client.get("/api/equipment/stats", headers=auth_headers)
        ).json()["total_units"]

        await client.post(
            "/api/equipment/units",
            json={"serial_number": _unique_serial()},
            headers=auth_headers,
        )

        after = (
            await client.get("/api/equipment/stats", headers=auth_headers)
        ).json()["total_units"]
        assert after == before + 1
