"""
Customer Trade Pricing Tiers API Tests — Sprint 2

Covers:
  GET  /api/pricing/tiers
  POST /api/pricing/tiers
  PUT  /api/pricing/customers/{customer_id}/pricing-tier
  GET  /api/pricing/calculate
  GET  /api/pricing/customers/{customer_id}/tier

Migration 00f seeds Bronze/Silver/Gold/Platinum tiers.
Tests needing real FK data skip gracefully when no data is present.
"""
from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

EXPECTED_TIERS = {
    "Bronze": 5.0,
    "Silver": 10.0,
    "Gold": 15.0,
    "Platinum": 20.0,
}


async def _get_real_customer_id(client: AsyncClient, auth_headers: dict) -> str | None:
    resp = await client.get("/api/customers?page_size=1", headers=auth_headers)
    if resp.status_code != 200:
        return None
    items = resp.json().get("items", [])
    return items[0]["id"] if items else None


async def _get_real_product_id(client: AsyncClient, auth_headers: dict) -> str | None:
    resp = await client.get("/api/products?page_size=1", headers=auth_headers)
    if resp.status_code != 200:
        return None
    items = resp.json().get("items", resp.json() if isinstance(resp.json(), list) else [])
    return items[0]["id"] if items else None


async def _get_tier_id_by_name(
    client: AsyncClient, auth_headers: dict, name: str
) -> str | None:
    resp = await client.get("/api/pricing/tiers", headers=auth_headers)
    if resp.status_code != 200:
        return None
    tiers = {t["name"]: t["id"] for t in resp.json()}
    return tiers.get(name)


# ---------------------------------------------------------------------------
# GET /api/pricing/tiers
# ---------------------------------------------------------------------------


class TestListPricingTiers:
    @pytest.mark.asyncio
    async def test_list_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/pricing/tiers", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_list_is_list(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/pricing/tiers", headers=auth_headers)
        assert isinstance(resp.json(), list)

    @pytest.mark.asyncio
    async def test_seeded_tiers_present(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Migration 00f seeds Bronze/Silver/Gold/Platinum — all must be present."""
        resp = await client.get("/api/pricing/tiers", headers=auth_headers)
        assert resp.status_code == 200
        tiers = resp.json()
        if not tiers:
            pytest.skip("No tiers seeded — migration may not have run")
        names = {t["name"] for t in tiers}
        for expected in EXPECTED_TIERS:
            assert expected in names, f"Seeded tier '{expected}' missing"

    @pytest.mark.asyncio
    async def test_seeded_tier_discount_percentages(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Each seeded tier must have the correct discount_pct."""
        resp = await client.get("/api/pricing/tiers", headers=auth_headers)
        tiers_by_name = {t["name"]: t for t in resp.json()}
        for name, expected_pct in EXPECTED_TIERS.items():
            if name not in tiers_by_name:
                continue
            actual = float(tiers_by_name[name]["discount_pct"])
            assert actual == expected_pct, (
                f"Tier '{name}': expected {expected_pct}%, got {actual}%"
            )

    @pytest.mark.asyncio
    async def test_tier_shape(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/pricing/tiers", headers=auth_headers)
        tiers = resp.json()
        if tiers:
            for field in ("id", "name", "discount_pct", "created_at"):
                assert field in tiers[0], f"Missing field: {field}"

    @pytest.mark.asyncio
    async def test_ordered_by_discount(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Tiers are ordered ascending by discount_pct."""
        resp = await client.get("/api/pricing/tiers", headers=auth_headers)
        tiers = resp.json()
        if len(tiers) >= 2:
            discounts = [float(t["discount_pct"]) for t in tiers]
            assert discounts == sorted(discounts), (
                f"Tiers not sorted by discount_pct: {discounts}"
            )


# ---------------------------------------------------------------------------
# POST /api/pricing/tiers
# ---------------------------------------------------------------------------


class TestCreatePricingTier:
    @pytest.mark.asyncio
    async def test_create_valid_tier(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        unique_name = f"Pytest-{uuid.uuid4().hex[:6].upper()}"
        resp = await client.post(
            "/api/pricing/tiers",
            json={"name": unique_name, "discount_pct": "12.50"},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 201)

    @pytest.mark.asyncio
    async def test_create_response_has_required_fields(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        unique_name = f"Pytest-{uuid.uuid4().hex[:6].upper()}"
        resp = await client.post(
            "/api/pricing/tiers",
            json={
                "name": unique_name,
                "discount_pct": "8.00",
                "description": "Test tier",
            },
            headers=auth_headers,
        )
        assert resp.status_code in (200, 201)
        data = resp.json()
        for field in ("id", "name", "discount_pct", "created_at"):
            assert field in data, f"Missing field: {field}"

    @pytest.mark.asyncio
    async def test_create_duplicate_name_returns_409(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        unique_name = f"Pytest-{uuid.uuid4().hex[:6].upper()}"
        await client.post(
            "/api/pricing/tiers",
            json={"name": unique_name, "discount_pct": "5.00"},
            headers=auth_headers,
        )
        resp = await client.post(
            "/api/pricing/tiers",
            json={"name": unique_name, "discount_pct": "6.00"},
            headers=auth_headers,
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_create_missing_name_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/pricing/tiers",
            json={"discount_pct": "10.00"},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_missing_discount_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/pricing/tiers",
            json={"name": "No Discount"},
            headers=auth_headers,
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# PUT /api/pricing/customers/{customer_id}/pricing-tier
# ---------------------------------------------------------------------------


class TestAssignPricingTier:
    @pytest.mark.asyncio
    async def test_assign_tier_to_real_customer(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        customer_id = await _get_real_customer_id(client, auth_headers)
        tier_id = await _get_tier_id_by_name(client, auth_headers, "Silver")
        if not customer_id or not tier_id:
            pytest.skip("No customers or tiers in DB")

        resp = await client.put(
            f"/api/pricing/customers/{customer_id}/pricing-tier",
            json={"tier_id": tier_id},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 201)

    @pytest.mark.asyncio
    async def test_assign_response_has_tier_name(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        customer_id = await _get_real_customer_id(client, auth_headers)
        tier_id = await _get_tier_id_by_name(client, auth_headers, "Gold")
        if not customer_id or not tier_id:
            pytest.skip("No customers or tiers in DB")

        resp = await client.put(
            f"/api/pricing/customers/{customer_id}/pricing-tier",
            json={"tier_id": tier_id},
            headers=auth_headers,
        )
        if resp.status_code in (200, 201):
            data = resp.json()
            assert data["tier_name"] == "Gold"
            assert float(data["discount_pct"]) == 15.0

    @pytest.mark.asyncio
    async def test_assign_upserts_existing_assignment(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Assigning a different tier updates the existing assignment."""
        customer_id = await _get_real_customer_id(client, auth_headers)
        bronze_id = await _get_tier_id_by_name(client, auth_headers, "Bronze")
        platinum_id = await _get_tier_id_by_name(client, auth_headers, "Platinum")
        if not customer_id or not bronze_id or not platinum_id:
            pytest.skip("No customers or tiers in DB")

        await client.put(
            f"/api/pricing/customers/{customer_id}/pricing-tier",
            json={"tier_id": bronze_id},
            headers=auth_headers,
        )
        resp = await client.put(
            f"/api/pricing/customers/{customer_id}/pricing-tier",
            json={"tier_id": platinum_id},
            headers=auth_headers,
        )
        assert resp.status_code in (200, 201)
        data = resp.json()
        assert data["tier_name"] == "Platinum"

    @pytest.mark.asyncio
    async def test_assign_fake_customer_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        tier_id = await _get_tier_id_by_name(client, auth_headers, "Bronze")
        if not tier_id:
            pytest.skip("No tiers in DB")
        resp = await client.put(
            f"/api/pricing/customers/{uuid.uuid4()}/pricing-tier",
            json={"tier_id": tier_id},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_assign_missing_tier_id_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.put(
            f"/api/pricing/customers/{uuid.uuid4()}/pricing-tier",
            json={},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_assign_invalid_uuid_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.put(
            "/api/pricing/customers/not-a-uuid/pricing-tier",
            json={"tier_id": str(uuid.uuid4())},
            headers=auth_headers,
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/pricing/calculate
# ---------------------------------------------------------------------------


class TestCalculatePrice:
    @pytest.mark.asyncio
    async def test_calculate_with_tier_applies_discount(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        customer_id = await _get_real_customer_id(client, auth_headers)
        product_id = await _get_real_product_id(client, auth_headers)
        tier_id = await _get_tier_id_by_name(client, auth_headers, "Gold")
        if not customer_id or not product_id or not tier_id:
            pytest.skip("No customers/products/tiers in DB")

        # Assign Gold tier (15% off) to customer
        await client.put(
            f"/api/pricing/customers/{customer_id}/pricing-tier",
            json={"tier_id": tier_id},
            headers=auth_headers,
        )

        resp = await client.get(
            f"/api/pricing/calculate?customer_id={customer_id}"
            f"&product_id={product_id}&qty=1",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert float(data["discount_pct"]) == 15.0
        assert float(data["discounted_unit_price"]) < float(data["list_price"])

    @pytest.mark.asyncio
    async def test_calculate_response_shape(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        customer_id = await _get_real_customer_id(client, auth_headers)
        product_id = await _get_real_product_id(client, auth_headers)
        if not customer_id or not product_id:
            pytest.skip("No customers/products in DB")

        resp = await client.get(
            f"/api/pricing/calculate?customer_id={customer_id}"
            f"&product_id={product_id}&qty=3",
            headers=auth_headers,
        )
        if resp.status_code == 200:
            data = resp.json()
            for field in (
                "customer_id", "product_id", "quantity", "list_price",
                "discount_pct", "discounted_unit_price", "line_total", "savings",
            ):
                assert field in data, f"Missing field: {field}"

    @pytest.mark.asyncio
    async def test_calculate_qty_multiplier(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        customer_id = await _get_real_customer_id(client, auth_headers)
        product_id = await _get_real_product_id(client, auth_headers)
        if not customer_id or not product_id:
            pytest.skip("No customers/products in DB")

        resp1 = await client.get(
            f"/api/pricing/calculate?customer_id={customer_id}"
            f"&product_id={product_id}&qty=1",
            headers=auth_headers,
        )
        resp5 = await client.get(
            f"/api/pricing/calculate?customer_id={customer_id}"
            f"&product_id={product_id}&qty=5",
            headers=auth_headers,
        )
        if resp1.status_code == 200 and resp5.status_code == 200:
            total1 = float(resp1.json()["line_total"])
            total5 = float(resp5.json()["line_total"])
            assert abs(total5 - (total1 * 5)) < 0.01, "line_total should scale with qty"

    @pytest.mark.asyncio
    async def test_calculate_missing_customer_id_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            f"/api/pricing/calculate?product_id={uuid.uuid4()}&qty=1",
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_calculate_missing_product_id_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            f"/api/pricing/calculate?customer_id={uuid.uuid4()}&qty=1",
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_calculate_fake_customer_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            f"/api/pricing/calculate?customer_id={uuid.uuid4()}"
            f"&product_id={uuid.uuid4()}&qty=1",
            headers=auth_headers,
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/pricing/customers/{customer_id}/tier
# ---------------------------------------------------------------------------


class TestGetCustomerTier:
    @pytest.mark.asyncio
    async def test_get_tier_after_assignment(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        customer_id = await _get_real_customer_id(client, auth_headers)
        tier_id = await _get_tier_id_by_name(client, auth_headers, "Silver")
        if not customer_id or not tier_id:
            pytest.skip("No customers or tiers in DB")

        await client.put(
            f"/api/pricing/customers/{customer_id}/pricing-tier",
            json={"tier_id": tier_id},
            headers=auth_headers,
        )

        resp = await client.get(
            f"/api/pricing/customers/{customer_id}/tier", headers=auth_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["tier_name"] == "Silver"
        assert float(data["discount_pct"]) == 10.0

    @pytest.mark.asyncio
    async def test_get_tier_no_assignment_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Customer without a tier assignment should return 404."""
        resp = await client.get(
            f"/api/pricing/customers/{uuid.uuid4()}/tier", headers=auth_headers
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_tier_invalid_uuid_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/pricing/customers/not-a-uuid/tier", headers=auth_headers
        )
        assert resp.status_code == 422
