"""Tests for GET /api/analytics/ap-ageing endpoint.

Covers:
  - 200 response on happy path (no filters)
  - Required fields present in response
  - Numeric fields are non-negative
  - Bucket sum equals total_outstanding invariant
  - as_of_date query param accepted
  - Supplier rows have required fields
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient


class TestAPAgeingEndpoint:
    @pytest.mark.asyncio
    async def test_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/analytics/ap-ageing", headers=auth_headers)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_has_all_required_top_level_fields(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/analytics/ap-ageing", headers=auth_headers)
        data = resp.json()
        required = {"as_of_date", "total_outstanding", "buckets", "suppliers", "generated_at"}
        for field in required:
            assert field in data, f"Missing top-level field: {field}"

    @pytest.mark.asyncio
    async def test_buckets_has_all_bucket_fields(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/analytics/ap-ageing", headers=auth_headers)
        buckets = resp.json()["buckets"]
        required = {"current_0_30", "days_31_60", "days_61_90", "days_90_plus"}
        for field in required:
            assert field in buckets, f"Missing bucket field: {field}"

    @pytest.mark.asyncio
    async def test_bucket_sum_equals_total_outstanding(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Arithmetic invariant: sum of all buckets must equal total_outstanding."""
        resp = await client.get("/api/analytics/ap-ageing", headers=auth_headers)
        data = resp.json()
        buckets = data["buckets"]
        bucket_sum = (
            float(buckets["current_0_30"])
            + float(buckets["days_31_60"])
            + float(buckets["days_61_90"])
            + float(buckets["days_90_plus"])
        )
        total = float(data["total_outstanding"])
        assert abs(bucket_sum - total) < 0.01, (
            f"Bucket sum {bucket_sum:.2f} does not match total_outstanding {total:.2f}"
        )

    @pytest.mark.asyncio
    async def test_all_numeric_fields_non_negative(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/analytics/ap-ageing", headers=auth_headers)
        data = resp.json()
        assert float(data["total_outstanding"]) >= 0.0
        for key, val in data["buckets"].items():
            assert float(val) >= 0.0, f"Bucket {key} must be non-negative"

    @pytest.mark.asyncio
    async def test_as_of_date_param_accepted(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/analytics/ap-ageing?as_of_date=2026-01-01", headers=auth_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["as_of_date"].startswith("2026-01-01")

    @pytest.mark.asyncio
    async def test_suppliers_is_list(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/analytics/ap-ageing", headers=auth_headers)
        data = resp.json()
        assert isinstance(data["suppliers"], list)

    @pytest.mark.asyncio
    async def test_supplier_rows_have_required_fields(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get("/api/analytics/ap-ageing", headers=auth_headers)
        suppliers = resp.json()["suppliers"]
        if not suppliers:
            pytest.skip("No active POs in test DB — skipping supplier-row shape check")
        required = {
            "supplier_id",
            "supplier_code",
            "company_name",
            "total_outstanding",
            "current_0_30",
            "days_31_60",
            "days_61_90",
            "days_90_plus",
            "oldest_po_days",
            "po_count",
        }
        for row in suppliers:
            for field in required:
                assert field in row, f"Supplier row missing field: {field}"

    @pytest.mark.asyncio
    async def test_supplier_row_bucket_sum_equals_total(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Per-supplier arithmetic: bucket columns must sum to total_outstanding."""
        resp = await client.get("/api/analytics/ap-ageing", headers=auth_headers)
        suppliers = resp.json()["suppliers"]
        for row in suppliers:
            row_sum = (
                float(row["current_0_30"])
                + float(row["days_31_60"])
                + float(row["days_61_90"])
                + float(row["days_90_plus"])
            )
            total = float(row["total_outstanding"])
            assert abs(row_sum - total) < 0.01, (
                f"Supplier {row['company_name']} bucket sum {row_sum:.2f} "
                f"!= total {total:.2f}"
            )

    @pytest.mark.asyncio
    async def test_invalid_date_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/analytics/ap-ageing?as_of_date=not-a-date", headers=auth_headers
        )
        assert resp.status_code == 422
