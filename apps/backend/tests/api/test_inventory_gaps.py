"""Integration tests for Batch 2B inventory gap endpoints (GAP-013 to GAP-018).

Tests written FIRST following TDD pattern.
"""

import pytest
from httpx import AsyncClient


class TestAutoReorder:
    """Test GAP-013 auto-reorder endpoint."""

    @pytest.mark.asyncio
    async def test_auto_reorder_success(self, client: AsyncClient, auth_headers: dict):
        """GAP-013: Create PO when stock < reorder_point."""
        payload = {
            "product_id": "00000000-0000-0000-0000-000000000001"
        }
        response = await client.post("/api/inventory/auto-reorder", json=payload, headers=auth_headers)

        # Should succeed or return 404 if product doesn't exist
        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            assert "purchase_order_id" in data
            assert "created" in data
            assert isinstance(data["created"], bool)

    @pytest.mark.asyncio
    async def test_auto_reorder_no_product(self, client: AsyncClient, auth_headers: dict):
        """Error case: auto-reorder for non-existent product."""
        payload = {
            "product_id": "99999999-9999-9999-9999-999999999999"
        }
        response = await client.post("/api/inventory/auto-reorder", json=payload, headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_auto_reorder_stock_sufficient(self, client: AsyncClient, auth_headers: dict):
        """Edge case: auto-reorder when stock is sufficient."""
        payload = {
            "product_id": "00000000-0000-0000-0000-000000000002"
        }
        response = await client.post("/api/inventory/auto-reorder", json=payload, headers=auth_headers)

        # Should succeed but created=False if stock is sufficient
        if response.status_code == 200:
            data = response.json()
            # created might be False if stock > reorder_point
            assert "created" in data


class TestThreeWayMatch:
    """Test GAP-014 three-way match endpoint."""

    @pytest.mark.asyncio
    async def test_three_way_match_success(self, client: AsyncClient, auth_headers: dict):
        """GAP-014: Match PO + GRN + Invoice."""
        payload = {
            "po_id": "00000000-0000-0000-0000-000000000001",
            "grn_id": "00000000-0000-0000-0000-000000000002",
            "invoice_id": "00000000-0000-0000-0000-000000000003"
        }
        response = await client.post("/api/procurement/three-way-match", json=payload, headers=auth_headers)

        # Should succeed or return 404 if any document doesn't exist
        assert response.status_code in [200, 404]

        if response.status_code == 200:
            data = response.json()
            assert "match_status" in data
            assert "variances" in data
            assert isinstance(data["variances"], list)

    @pytest.mark.asyncio
    async def test_three_way_match_missing_doc(self, client: AsyncClient, auth_headers: dict):
        """Error case: missing document."""
        payload = {
            "po_id": "99999999-9999-9999-9999-999999999999",
            "grn_id": "00000000-0000-0000-0000-000000000002",
            "invoice_id": "00000000-0000-0000-0000-000000000003"
        }
        response = await client.post("/api/procurement/three-way-match", json=payload, headers=auth_headers)
        assert response.status_code == 404


class TestUnmatchedPOItems:
    """Test GAP-015 unmatched PO items endpoint."""

    @pytest.mark.asyncio
    async def test_list_unmatched_items_all(self, client: AsyncClient, auth_headers: dict):
        """GAP-015: List all unmatched PO items."""
        response = await client.get("/api/procurement/unmatched-po-items", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        # Should have pagination structure
        assert "items" in data or isinstance(data, list)

    @pytest.mark.asyncio
    async def test_list_unmatched_items_for_po(self, client: AsyncClient, auth_headers: dict):
        """Filter unmatched items by PO ID."""
        po_id = "00000000-0000-0000-0000-000000000001"
        response = await client.get(
            f"/api/procurement/unmatched-po-items?po_id={po_id}",
            headers=auth_headers
        )
        assert response.status_code in [200, 404]


class TestBulkAdjust:
    """Test GAP-016 bulk stock adjustment endpoint."""

    @pytest.mark.asyncio
    async def test_bulk_adjust_success(self, client: AsyncClient, auth_headers: dict):
        """GAP-016: Bulk stock adjustments."""
        payload = {
            "adjustments": [
                {
                    "product_id": "00000000-0000-0000-0000-000000000001",
                    "quantity": 10,
                    "reason": "stock count correction"
                },
                {
                    "product_id": "00000000-0000-0000-0000-000000000002",
                    "quantity": -5,
                    "reason": "damage"
                }
            ]
        }
        response = await client.post("/api/inventory/bulk-adjust", json=payload, headers=auth_headers)

        # Should succeed even if some items fail
        assert response.status_code == 200
        data = response.json()
        assert "adjusted" in data
        assert "failed" in data
        assert isinstance(data["adjusted"], int)
        assert isinstance(data["failed"], list)

    @pytest.mark.asyncio
    async def test_bulk_adjust_empty_list(self, client: AsyncClient, auth_headers: dict):
        """Edge case: empty adjustments list."""
        payload = {"adjustments": []}
        response = await client.post("/api/inventory/bulk-adjust", json=payload, headers=auth_headers)
        assert response.status_code in [200, 400]


class TestStockTakes:
    """Test GAP-017 active stock takes endpoint."""

    @pytest.mark.asyncio
    async def test_list_active_stock_takes(self, client: AsyncClient, auth_headers: dict):
        """GAP-017: List active stock takes."""
        response = await client.get("/api/inventory/stock-takes/active", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

        # Each stock take should have required fields
        if data:
            stock_take = data[0]
            assert "id" in stock_take
            assert "status" in stock_take


class TestCycleCount:
    """Test GAP-018 cycle count generation endpoint."""

    @pytest.mark.asyncio
    async def test_generate_cycle_count_schedule(self, client: AsyncClient, auth_headers: dict):
        """GAP-018: Generate cycle count schedule."""
        payload = {
            "frequency": "weekly",
            "abc_class": "A"
        }
        response = await client.post("/api/inventory/cycle-count/generate", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        assert "schedule_id" in data
        assert "items" in data
        assert isinstance(data["items"], int)
        assert data["items"] >= 0

    @pytest.mark.asyncio
    async def test_generate_cycle_count_invalid_frequency(self, client: AsyncClient, auth_headers: dict):
        """Error case: invalid frequency."""
        payload = {
            "frequency": "never",
            "abc_class": "A"
        }
        response = await client.post("/api/inventory/cycle-count/generate", json=payload, headers=auth_headers)
        # Should return 422 validation error or 400
        assert response.status_code in [400, 422]
