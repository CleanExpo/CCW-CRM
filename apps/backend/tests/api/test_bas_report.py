"""
Australian GST/BAS Report API Tests — Sprint 2

Covers:
  GET /api/invoices/reports/bas

Tests period parsing (monthly shorthand, quarterly shorthand, explicit
date range), response shape, field types, and GST arithmetic invariants.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient

# ---------------------------------------------------------------------------
# GET /api/invoices/reports/bas — Monthly period shorthand
# ---------------------------------------------------------------------------


class TestBASReportMonthly:
    @pytest.mark.asyncio
    async def test_monthly_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/invoices/reports/bas?period=2026-03", headers=auth_headers
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_monthly_has_all_required_fields(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/invoices/reports/bas?period=2026-03", headers=auth_headers
        )
        data = resp.json()
        required = {
            "period", "date_from", "date_to",
            "label_1a_gst_collected", "label_1b_gst_credits",
            "label_net_gst_payable", "taxable_sales", "export_sales",
            "total_sales_incl_gst", "invoice_count", "note",
        }
        for field in required:
            assert field in data, f"Missing BAS field: {field}"

    @pytest.mark.asyncio
    async def test_monthly_date_range_march_2026(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/invoices/reports/bas?period=2026-03", headers=auth_headers
        )
        data = resp.json()
        assert data["date_from"].startswith("2026-03-01")
        assert data["date_to"].startswith("2026-03-31")

    @pytest.mark.asyncio
    async def test_monthly_1b_is_zero(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """1B input tax credits is always 0 — manual entry by accountant."""
        resp = await client.get(
            "/api/invoices/reports/bas?period=2026-03", headers=auth_headers
        )
        data = resp.json()
        assert float(data["label_1b_gst_credits"]) == 0.0

    @pytest.mark.asyncio
    async def test_monthly_has_disclaimer_note(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/invoices/reports/bas?period=2026-03", headers=auth_headers
        )
        note = resp.json().get("note", "")
        assert len(note) > 10, "Disclaimer note should be non-trivial"

    @pytest.mark.asyncio
    async def test_monthly_invoice_count_non_negative_int(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/invoices/reports/bas?period=2026-03", headers=auth_headers
        )
        data = resp.json()
        assert isinstance(data["invoice_count"], int)
        assert data["invoice_count"] >= 0

    @pytest.mark.asyncio
    async def test_monthly_numeric_fields_parseable(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/invoices/reports/bas?period=2026-03", headers=auth_headers
        )
        data = resp.json()
        for field in (
            "label_1a_gst_collected", "label_net_gst_payable",
            "taxable_sales", "total_sales_incl_gst",
        ):
            assert float(data[field]) >= 0.0, f"{field} must be >= 0"

    @pytest.mark.asyncio
    async def test_recent_months_all_accepted(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        for month in ("2026-01", "2026-02", "2025-12", "2025-06"):
            resp = await client.get(
                f"/api/invoices/reports/bas?period={month}", headers=auth_headers
            )
            assert resp.status_code == 200, f"Failed for period={month}"


# ---------------------------------------------------------------------------
# GET /api/invoices/reports/bas — Quarterly period shorthand
# ---------------------------------------------------------------------------


class TestBASReportQuarterly:
    @pytest.mark.asyncio
    async def test_q1_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/invoices/reports/bas?period=2026-Q1", headers=auth_headers
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_q1_date_range_jan_to_mar(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/invoices/reports/bas?period=2026-Q1", headers=auth_headers
        )
        data = resp.json()
        assert data["date_from"].startswith("2026-01-01")
        assert data["date_to"].startswith("2026-03-31")

    @pytest.mark.asyncio
    async def test_q2_date_range_apr_to_jun(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/invoices/reports/bas?period=2026-Q2", headers=auth_headers
        )
        data = resp.json()
        assert data["date_from"].startswith("2026-04-01")
        assert data["date_to"].startswith("2026-06-30")

    @pytest.mark.asyncio
    async def test_q3_date_range_jul_to_sep(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/invoices/reports/bas?period=2026-Q3", headers=auth_headers
        )
        data = resp.json()
        assert data["date_from"].startswith("2026-07-01")
        assert data["date_to"].startswith("2026-09-30")

    @pytest.mark.asyncio
    async def test_q4_date_range_oct_to_dec(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/invoices/reports/bas?period=2026-Q4", headers=auth_headers
        )
        data = resp.json()
        assert data["date_from"].startswith("2026-10-01")
        assert data["date_to"].startswith("2026-12-31")

    @pytest.mark.asyncio
    async def test_all_four_quarters_accepted(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        for q in (1, 2, 3, 4):
            resp = await client.get(
                f"/api/invoices/reports/bas?period=2025-Q{q}", headers=auth_headers
            )
            assert resp.status_code == 200, f"Failed for Q{q}"


# ---------------------------------------------------------------------------
# GET /api/invoices/reports/bas — Explicit date range
# ---------------------------------------------------------------------------


class TestBASReportExplicitDates:
    @pytest.mark.asyncio
    async def test_explicit_date_range_returns_200(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/invoices/reports/bas?date_from=2026-01-01&date_to=2026-03-31",
            headers=auth_headers,
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_explicit_dates_reflected_in_response(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/invoices/reports/bas?date_from=2025-07-01&date_to=2025-09-30",
            headers=auth_headers,
        )
        data = resp.json()
        assert "2025-07-01" in data["date_from"]
        assert "2025-09-30" in data["date_to"]

    @pytest.mark.asyncio
    async def test_no_params_returns_all_time_summary(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/invoices/reports/bas", headers=auth_headers
        )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GST Arithmetic Invariants
# ---------------------------------------------------------------------------


class TestBASGSTArithmetic:
    @pytest.mark.asyncio
    async def test_net_gst_equals_1a_minus_1b(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Net GST = 1A - 1B (1B is always 0 in this system)."""
        resp = await client.get(
            "/api/invoices/reports/bas?period=2026-Q1", headers=auth_headers
        )
        data = resp.json()
        label_1a = float(data["label_1a_gst_collected"])
        label_1b = float(data["label_1b_gst_credits"])
        net = float(data["label_net_gst_payable"])
        assert abs((label_1a - label_1b) - net) < 0.01, (
            f"Net GST arithmetic: {label_1a} - {label_1b} ≠ {net}"
        )

    @pytest.mark.asyncio
    async def test_total_sales_includes_gst(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """total_sales_incl_gst = taxable_sales + GST + export_sales."""
        resp = await client.get(
            "/api/invoices/reports/bas?period=2026-Q1", headers=auth_headers
        )
        data = resp.json()
        taxable = float(data["taxable_sales"])
        gst = float(data["label_1a_gst_collected"])
        total = float(data["total_sales_incl_gst"])
        export = float(data["export_sales"])

        if taxable > 0:
            expected = taxable + gst + export
            assert abs(expected - total) < 0.10, (
                f"Total sales: expected ~{expected:.2f}, got {total:.2f}"
            )

    @pytest.mark.asyncio
    async def test_gst_rate_approximately_10_percent(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """GST should be ~10% of taxable sales (Australian standard rate)."""
        resp = await client.get(
            "/api/invoices/reports/bas?period=2026-Q1", headers=auth_headers
        )
        data = resp.json()
        taxable = float(data["taxable_sales"])
        gst = float(data["label_1a_gst_collected"])

        if taxable > 0 and gst > 0:
            effective_rate = (gst / taxable) * 100
            # Allow generous range for invoices with mixed or zero tax rates
            assert 0.0 <= effective_rate <= 12.0, (
                f"Effective GST rate {effective_rate:.1f}% outside 0-12% range"
            )

    @pytest.mark.asyncio
    async def test_all_amounts_non_negative(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/invoices/reports/bas?period=2026-Q1", headers=auth_headers
        )
        data = resp.json()
        for field in (
            "label_1a_gst_collected", "label_1b_gst_credits",
            "label_net_gst_payable", "taxable_sales",
            "export_sales", "total_sales_incl_gst",
        ):
            assert float(data[field]) >= 0.0, f"{field} must be non-negative"
