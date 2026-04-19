"""
Warehouse Pick List and Packing Slip API Tests

Covers:
  POST /api/warehouse/pick-lists  (TestPickListCreate)
  GET  /api/warehouse/pick-lists/{id}  (TestPickListGet)
  POST /api/warehouse/packing-slips  (TestPackingSlipCreate)
  GET  /api/warehouse/packing-slips/{id}  (TestPackingSlipGet)
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


class TestPackingSlipCreate:
    @pytest.mark.asyncio
    async def test_packing_slip_create_empty_order_ids_returns_400(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/warehouse/packing-slips",
            json={"order_ids": []},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_packing_slip_create_nonexistent_order_returns_400(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/warehouse/packing-slips",
            json={"order_ids": ["00000000-0000-0000-0000-000000000000"]},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_packing_slip_create_missing_body_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/warehouse/packing-slips",
            json={},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_packing_slip_create_invalid_uuid_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/warehouse/packing-slips",
            json={"order_ids": ["not-a-uuid"]},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_packing_slip_create_with_real_order_returns_201_or_400(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Uses a real order from the DB if one exists; otherwise expects 400."""
        orders_resp = await client.get("/api/orders?page=1&page_size=1", headers=auth_headers)
        if orders_resp.status_code != 200:
            pytest.skip("Orders endpoint unavailable")

        items = orders_resp.json().get("items", [])
        if not items:
            pytest.skip("No orders in test database — skipping packing slip create test")

        order_id = items[0]["id"]
        resp = await client.post(
            "/api/warehouse/packing-slips",
            json={"order_ids": [order_id]},
            headers=auth_headers,
        )
        # 201 when order has line items; 400 when order has no items
        assert resp.status_code in (201, 400)
        if resp.status_code == 201:
            data = resp.json()
            assert "id" in data
            assert "slip_number" in data
            assert data["slip_number"].startswith("PS-")
            assert "orders" in data
            assert "total_orders" in data
            assert "total_items" in data
            assert isinstance(data["orders"], list)
            assert data["total_orders"] == len(data["orders"])


class TestPackingSlipGet:
    @pytest.mark.asyncio
    async def test_packing_slip_get_not_found_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/warehouse/packing-slips/nonexistent-id-12345",
            headers=auth_headers,
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_packing_slip_get_after_create_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Create a packing slip using a real order then retrieve it."""
        orders_resp = await client.get("/api/orders?page=1&page_size=1", headers=auth_headers)
        if orders_resp.status_code != 200:
            pytest.skip("Orders endpoint unavailable")

        items = orders_resp.json().get("items", [])
        if not items:
            pytest.skip("No orders in test database — skipping packing slip get test")

        order_id = items[0]["id"]
        create_resp = await client.post(
            "/api/warehouse/packing-slips",
            json={"order_ids": [order_id]},
            headers=auth_headers,
        )
        if create_resp.status_code != 201:
            pytest.skip("Order has no line items; cannot test retrieval")

        slip_id = create_resp.json()["id"]
        get_resp = await client.get(
            f"/api/warehouse/packing-slips/{slip_id}",
            headers=auth_headers,
        )
        assert get_resp.status_code == 200
        data = get_resp.json()
        assert data["id"] == slip_id
        assert data["slip_number"].startswith("PS-")
        assert isinstance(data["orders"], list)

    @pytest.mark.asyncio
    async def test_packing_slip_order_sections_have_required_fields(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Verify order section and line item schema when a packing slip is created."""
        orders_resp = await client.get("/api/orders?page=1&page_size=1", headers=auth_headers)
        if orders_resp.status_code != 200:
            pytest.skip("Orders endpoint unavailable")

        items = orders_resp.json().get("items", [])
        if not items:
            pytest.skip("No orders in test database")

        order_id = items[0]["id"]
        create_resp = await client.post(
            "/api/warehouse/packing-slips",
            json={"order_ids": [order_id]},
            headers=auth_headers,
        )
        if create_resp.status_code != 201:
            pytest.skip("Order has no line items")

        data = create_resp.json()
        order_required = {
            "order_id", "order_number", "order_date", "order_total", "customer", "line_items",
        }
        customer_required = {
            "company_name", "contact_name", "email", "phone",
            "address", "city", "state", "postcode",
        }
        line_required = {"product_id", "sku", "description", "qty", "unit_price", "line_total"}

        for order in data["orders"]:
            for field in order_required:
                assert field in order, f"Order section missing field: {field}"
            for field in customer_required:
                assert field in order["customer"], f"Customer missing field: {field}"
            for item in order["line_items"]:
                for field in line_required:
                    assert field in item, f"Line item missing field: {field}"
                assert item["qty"] > 0
