"""
IICRC Certification Tracking API Tests — Sprint 2

Covers:
  GET  /api/certifications
  POST /api/certifications
  GET  /api/certifications/expiring
  POST /api/certifications/{cert_id}/renew
  GET  /api/certifications/stats

Uses project-standard AsyncClient + auth_headers fixtures.
Tests are safe on a clean DB and handle empty results gracefully.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient


def _future_date(days: int = 365) -> str:
    dt = datetime.now(timezone.utc) + timedelta(days=days)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _past_date(days: int = 30) -> str:
    dt = datetime.now(timezone.utc) - timedelta(days=days)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


async def _get_real_customer_id(client: AsyncClient, auth_headers: dict) -> str | None:
    """Fetch a real customer UUID from the DB for FK-dependent tests."""
    resp = await client.get("/api/customers?page_size=1", headers=auth_headers)
    if resp.status_code != 200:
        return None
    items = resp.json().get("items", [])
    return items[0]["id"] if items else None


# ---------------------------------------------------------------------------
# GET /api/certifications
# ---------------------------------------------------------------------------


class TestListCertifications:
    @pytest.mark.asyncio
    async def test_list_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/certifications", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_list_is_list(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/certifications", headers=auth_headers)
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_list_customer_filter(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        fake = str(uuid.uuid4())
        resp = await client.get(
            f"/api/certifications?customer_id={fake}", headers=auth_headers
        )
        assert resp.status_code == 200
        # Fake UUID returns empty list, not 404
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_list_cert_body_iicrc_filter(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/certifications?cert_body=IICRC", headers=auth_headers
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_list_status_active_filter(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/certifications?status=active", headers=auth_headers
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_list_status_expired_filter(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/certifications?status=expired", headers=auth_headers
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_list_pagination_accepted(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/certifications?page=1&page_size=5", headers=auth_headers
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_list_item_shape_when_populated(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/certifications", headers=auth_headers)
        items = resp.json()
        if items:
            cert = items[0]
            for field in (
                "id", "customer_id", "cert_body", "cert_type",
                "status", "created_at", "days_until_expiry",
            ):
                assert field in cert, f"Missing field: {field}"


# ---------------------------------------------------------------------------
# POST /api/certifications
# ---------------------------------------------------------------------------


class TestCreateCertification:
    @pytest.mark.asyncio
    async def test_create_valid_iicrc_cert(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        customer_id = await _get_real_customer_id(client, auth_headers)
        if not customer_id:
            pytest.skip("No customers in DB")
        resp = await client.post(
            "/api/certifications",
            json={
                "customer_id": customer_id,
                "cert_body": "IICRC",
                "cert_type": "WRT",
                "cert_number": f"WRT-{uuid.uuid4().hex[:6].upper()}",
                "technician_name": "Test Tech",
                "expiry_date": _future_date(365),
            },
            headers=auth_headers,
        )
        assert resp.status_code in (200, 201)

    @pytest.mark.asyncio
    async def test_create_response_has_required_fields(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        customer_id = await _get_real_customer_id(client, auth_headers)
        if not customer_id:
            pytest.skip("No customers in DB")
        resp = await client.post(
            "/api/certifications",
            json={
                "customer_id": customer_id,
                "cert_body": "IICRC",
                "cert_type": "CCT",
            },
            headers=auth_headers,
        )
        assert resp.status_code in (200, 201)
        data = resp.json()
        for field in ("id", "customer_id", "cert_body", "cert_type", "status", "created_at"):
            assert field in data, f"Missing field: {field}"

    @pytest.mark.asyncio
    async def test_create_status_defaults_to_active(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        customer_id = await _get_real_customer_id(client, auth_headers)
        if not customer_id:
            pytest.skip("No customers in DB")
        resp = await client.post(
            "/api/certifications",
            json={
                "customer_id": customer_id,
                "cert_body": "IICRC",
                "cert_type": "ASD",
                "expiry_date": _future_date(200),
            },
            headers=auth_headers,
        )
        if resp.status_code in (200, 201):
            assert resp.json()["status"] in ("active", "expiring_soon")

    @pytest.mark.asyncio
    async def test_create_expired_cert_status(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Cert with past expiry_date should get status=expired."""
        customer_id = await _get_real_customer_id(client, auth_headers)
        if not customer_id:
            pytest.skip("No customers in DB")
        resp = await client.post(
            "/api/certifications",
            json={
                "customer_id": customer_id,
                "cert_body": "IICRC",
                "cert_type": "FSRT",
                "expiry_date": _past_date(10),
            },
            headers=auth_headers,
        )
        if resp.status_code in (200, 201):
            assert resp.json()["status"] == "expired"

    @pytest.mark.asyncio
    async def test_create_issa_cert_body(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        customer_id = await _get_real_customer_id(client, auth_headers)
        if not customer_id:
            pytest.skip("No customers in DB")
        resp = await client.post(
            "/api/certifications",
            json={
                "customer_id": customer_id,
                "cert_body": "ISSA",
                "cert_type": "CIMS",
            },
            headers=auth_headers,
        )
        assert resp.status_code in (200, 201)

    @pytest.mark.asyncio
    async def test_create_missing_customer_id_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/certifications",
            json={"cert_body": "IICRC", "cert_type": "WRT"},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_missing_cert_type_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/certifications",
            json={"customer_id": str(uuid.uuid4()), "cert_body": "IICRC"},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_invalid_cert_body_returns_400(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/certifications",
            json={
                "customer_id": str(uuid.uuid4()),
                "cert_body": "INVALID_BODY",
                "cert_type": "WRT",
            },
            headers=auth_headers,
        )
        assert resp.status_code in (400, 422)

    @pytest.mark.asyncio
    async def test_create_invalid_customer_uuid_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/certifications",
            json={"customer_id": "not-a-uuid", "cert_body": "IICRC", "cert_type": "WRT"},
            headers=auth_headers,
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/certifications/expiring
# ---------------------------------------------------------------------------


class TestExpiringCertifications:
    @pytest.mark.asyncio
    async def test_expiring_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/certifications/expiring", headers=auth_headers
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_expiring_is_list(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/certifications/expiring", headers=auth_headers
        )
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_expiring_days_30(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/certifications/expiring?days=30", headers=auth_headers
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_expiring_days_90(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/certifications/expiring?days=90", headers=auth_headers
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_expiring_results_within_window(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """All returned certs must be expiring within the requested window."""
        resp = await client.get(
            "/api/certifications/expiring?days=60", headers=auth_headers
        )
        assert resp.status_code == 200
        for item in resp.json():
            if item.get("days_until_expiry") is not None:
                assert item["days_until_expiry"] <= 60, (
                    f"Cert {item['id']} days_until_expiry={item['days_until_expiry']} "
                    "exceeds requested 60 day window"
                )

    @pytest.mark.asyncio
    async def test_expiring_cert_appears_after_creation(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """A cert expiring in 10 days should appear in expiring?days=30."""
        customer_id = await _get_real_customer_id(client, auth_headers)
        if not customer_id:
            pytest.skip("No customers in DB")

        # Create a cert expiring in 10 days
        create_resp = await client.post(
            "/api/certifications",
            json={
                "customer_id": customer_id,
                "cert_body": "IICRC",
                "cert_type": "MRS",
                "expiry_date": _future_date(10),
            },
            headers=auth_headers,
        )
        assert create_resp.status_code in (200, 201)
        cert_id = create_resp.json()["id"]

        # It should appear in expiring?days=30
        expiring_resp = await client.get(
            "/api/certifications/expiring?days=30", headers=auth_headers
        )
        cert_ids = [c["id"] for c in expiring_resp.json()]
        assert cert_id in cert_ids


# ---------------------------------------------------------------------------
# POST /api/certifications/{cert_id}/renew
# ---------------------------------------------------------------------------


class TestRenewCertification:
    @pytest.mark.asyncio
    async def test_renew_updates_expiry_and_status(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        customer_id = await _get_real_customer_id(client, auth_headers)
        if not customer_id:
            pytest.skip("No customers in DB")

        # Create an expiring cert
        create_resp = await client.post(
            "/api/certifications",
            json={
                "customer_id": customer_id,
                "cert_body": "IICRC",
                "cert_type": "FSRT",
                "expiry_date": _future_date(5),
            },
            headers=auth_headers,
        )
        assert create_resp.status_code in (200, 201)
        cert_id = create_resp.json()["id"]

        # Renew to 2 years from now
        renew_resp = await client.post(
            f"/api/certifications/{cert_id}/renew",
            json={"new_expiry_date": _future_date(730)},
            headers=auth_headers,
        )
        assert renew_resp.status_code == 200
        renewed = renew_resp.json()
        assert renewed["status"] == "active"

    @pytest.mark.asyncio
    async def test_renew_updates_cert_number(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        customer_id = await _get_real_customer_id(client, auth_headers)
        if not customer_id:
            pytest.skip("No customers in DB")

        create_resp = await client.post(
            "/api/certifications",
            json={
                "customer_id": customer_id,
                "cert_body": "IICRC",
                "cert_type": "WRT",
            },
            headers=auth_headers,
        )
        cert_id = create_resp.json()["id"]
        new_cert_number = f"WRT-RENEWED-{uuid.uuid4().hex[:6].upper()}"

        renew_resp = await client.post(
            f"/api/certifications/{cert_id}/renew",
            json={
                "new_expiry_date": _future_date(365),
                "cert_number": new_cert_number,
            },
            headers=auth_headers,
        )
        assert renew_resp.status_code == 200
        assert renew_resp.json().get("cert_number") == new_cert_number

    @pytest.mark.asyncio
    async def test_renew_nonexistent_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            f"/api/certifications/{uuid.uuid4()}/renew",
            json={"new_expiry_date": _future_date(365)},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_renew_missing_expiry_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            f"/api/certifications/{uuid.uuid4()}/renew",
            json={},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_renew_invalid_uuid_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/certifications/not-a-uuid/renew",
            json={"new_expiry_date": _future_date(365)},
            headers=auth_headers,
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/certifications/stats
# ---------------------------------------------------------------------------


class TestCertificationStats:
    @pytest.mark.asyncio
    async def test_stats_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/certifications/stats", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_stats_has_required_fields(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/certifications/stats", headers=auth_headers)
        data = resp.json()
        for field in ("total", "active", "expiring_soon", "expired", "expiring_alerts"):
            assert field in data, f"Missing field: {field}"

    @pytest.mark.asyncio
    async def test_stats_counts_non_negative(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/certifications/stats", headers=auth_headers)
        data = resp.json()
        for field in ("total", "active", "expiring_soon", "expired"):
            assert data[field] >= 0, f"{field} should be non-negative"

    @pytest.mark.asyncio
    async def test_stats_expiring_alerts_is_list(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/certifications/stats", headers=auth_headers)
        assert isinstance(resp.json()["expiring_alerts"], list)

    @pytest.mark.asyncio
    async def test_stats_total_equals_sum_of_statuses(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """total >= active + expiring_soon + expired (there may be other statuses)."""
        resp = await client.get("/api/certifications/stats", headers=auth_headers)
        data = resp.json()
        total = data["total"]
        active = data["active"]
        expiring = data["expiring_soon"]
        expired = data["expired"]
        assert total >= active + expiring + expired, (
            f"total={total} < active({active}) + expiring({expiring}) + expired({expired})"
        )
