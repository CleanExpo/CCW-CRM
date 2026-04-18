"""
Warehouse Pick List API Tests

Covers:
  POST /api/warehouse/pick-lists  (test_pick_list_create)
  GET  /api/warehouse/pick-lists/{id}  (test_pick_list_get)
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient


class TestPickListCreate:
    @pytest.mark.asyncio
    async def test_pick_list_create_empty_order_ids_returns_400(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/warehouse/pick-lists",
            json={"order_ids": []},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_pick_list_create_nonexistent_order_returns_400(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/warehouse/pick-lists",
            json={"order_ids": ["00000000-0000-0000-0000-000000000000"]},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_pick_list_create_missing_body_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/warehouse/pick-lists",
            json={},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_pick_list_create_invalid_uuid_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/warehouse/pick-lists",
            json={"order_ids": ["not-a-uuid"]},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_pick_list_create_with_real_order_returns_201_or_400(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Uses a real order from the DB if one exists; otherwise expects 400."""
        # Fetch the first available order
        orders_resp = await client.get("/api/orders?page=1&page_size=1", headers=auth_headers)
        if orders_resp.status_code != 200:
            pytest.skip("Orders endpoint unavailable")

        orders_data = orders_resp.json()
        items = orders_data.get("items", [])
        if not items:
            pytest.skip("No orders in test database — skipping pick list create test")

        order_id = items[0]["id"]
        resp = await client.post(
            "/api/warehouse/pick-lists",
            json={"order_ids": [order_id]},
            headers=auth_headers,
        )
        # 201 when order has line items; 400 when order has no items
        assert resp.status_code in (201, 400)
        if resp.status_code == 201:
            data = resp.json()
            assert "id" in data
            assert "pick_list_number" in data
            assert data["pick_list_number"].startswith("PL-")
            assert "line_items" in data
            assert "total_lines" in data
            assert isinstance(data["line_items"], list)
            assert data["total_lines"] == len(data["line_items"])
            assert data["order_ids"] == [order_id]


class TestPickListGet:
    @pytest.mark.asyncio
    async def test_pick_list_get_not_found_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/warehouse/pick-lists/nonexistent-id-12345",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_pick_list_get_after_create_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Create a pick list using a real order then retrieve it."""
        orders_resp = await client.get("/api/orders?page=1&page_size=1", headers=auth_headers)
        if orders_resp.status_code != 200:
            pytest.skip("Orders endpoint unavailable")

        items = orders_resp.json().get("items", [])
        if not items:
            pytest.skip("No orders in test database — skipping pick list get test")

        order_id = items[0]["id"]
        create_resp = await client.post(
            "/api/warehouse/pick-lists",
            json={"order_ids": [order_id]},
            headers=auth_headers,
        )
        if create_resp.status_code != 201:
            pytest.skip("Order has no line items; cannot test retrieval")

        pick_list_id = create_resp.json()["id"]
        get_resp = await client.get(
            f"/api/warehouse/pick-lists/{pick_list_id}",
            headers=auth_headers,
        )
        assert get_resp.status_code == 200
        data = get_resp.json()
        assert data["id"] == pick_list_id
        assert data["pick_list_number"].startswith("PL-")
        assert isinstance(data["line_items"], list)

    @pytest.mark.asyncio
    async def test_pick_list_line_items_have_required_fields(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Verify line item schema when a pick list is created."""
        orders_resp = await client.get("/api/orders?page=1&page_size=1", headers=auth_headers)
        if orders_resp.status_code != 200:
            pytest.skip("Orders endpoint unavailable")

        items = orders_resp.json().get("items", [])
        if not items:
            pytest.skip("No orders in test database")

        order_id = items[0]["id"]
        create_resp = await client.post(
            "/api/warehouse/pick-lists",
            json={"order_ids": [order_id]},
            headers=auth_headers,
        )
        if create_resp.status_code != 201:
            pytest.skip("Order has no line items")

        data = create_resp.json()
        required_fields = {
            "order_id", "order_number", "product_id", "sku",
            "description", "bin_location", "qty_ordered", "qty_picked",
        }
        for item in data["line_items"]:
            for field in required_fields:
                assert field in item, f"Line item missing field: {field}"
            assert item["qty_ordered"] > 0
            assert item["qty_picked"] == 0
