"""Tests for tax calculation engine (GAP-028)."""
from decimal import Decimal

import pytest

from src.services.tax_calculator import (
    TaxType,
    calculate_reverse_tax,
    calculate_tax,
    get_tax_rate_info,
)


class TestCalculateTax:
    """Test tax calculation logic."""

    def test_australia_gst(self):
        """Test Australian GST calculation (10%)."""
        result = calculate_tax(
            subtotal=Decimal("100.00"),
            jurisdiction="AU",
        )

        assert result.gst == Decimal("10.00")
        assert result.pst == Decimal("0.00")
        assert result.hst == Decimal("0.00")
        assert result.total_tax == Decimal("10.00")
        assert len(result.breakdown) == 1
        assert result.breakdown[0].tax_type == TaxType.GST

    def test_canada_gst(self):
        """Test Canadian GST calculation (5%)."""
        result = calculate_tax(
            subtotal=Decimal("100.00"),
            jurisdiction="CA",
        )

        assert result.gst == Decimal("5.00")
        assert result.total_tax == Decimal("5.00")

    def test_canada_bc_gst_pst(self):
        """Test BC with GST + PST (5% + 7% = 12%)."""
        result = calculate_tax(
            subtotal=Decimal("100.00"),
            jurisdiction="CA-BC",
        )

        assert result.gst == Decimal("5.00")
        assert result.pst == Decimal("7.00")
        assert result.hst == Decimal("0.00")
        assert result.total_tax == Decimal("12.00")
        assert len(result.breakdown) == 2

    def test_canada_on_hst(self):
        """Test Ontario HST (13% combined)."""
        result = calculate_tax(
            subtotal=Decimal("100.00"),
            jurisdiction="CA-ON",
        )

        assert result.gst == Decimal("0.00")
        assert result.pst == Decimal("0.00")
        assert result.hst == Decimal("13.00")
        assert result.total_tax == Decimal("13.00")
        assert result.is_hst_jurisdiction is True
        assert len(result.breakdown) == 1
        assert result.breakdown[0].tax_type == TaxType.HST

    def test_canada_ns_hst(self):
        """Test Nova Scotia HST (15%)."""
        result = calculate_tax(
            subtotal=Decimal("100.00"),
            jurisdiction="CA-NS",
        )

        assert result.hst == Decimal("15.00")
        assert result.total_tax == Decimal("15.00")

    def test_canada_qc_gst_pst(self):
        """Test Quebec with GST + QST (5% + 9.975%)."""
        result = calculate_tax(
            subtotal=Decimal("100.00"),
            jurisdiction="CA-QC",
        )

        assert result.gst == Decimal("5.00")
        assert result.pst == Decimal("9.98")  # Rounded
        assert result.total_tax == Decimal("14.98")

    def test_exempt_category(self):
        """Test tax-exempt product category."""
        result = calculate_tax(
            subtotal=Decimal("100.00"),
            jurisdiction="AU",
            product_category="groceries",
        )

        assert result.gst == Decimal("0.00")
        assert result.total_tax == Decimal("0.00")
        assert len(result.breakdown) == 0

    def test_medical_exempt(self):
        """Test medical equipment is tax-exempt."""
        result = calculate_tax(
            subtotal=Decimal("100.00"),
            jurisdiction="CA-ON",
            product_category="medical_equipment",
        )

        assert result.total_tax == Decimal("0.00")

    def test_b2b_reverse_charge(self):
        """Test B2B reverse charge (no tax collected)."""
        result = calculate_tax(
            subtotal=Decimal("100.00"),
            jurisdiction="AU",
            is_b2b=True,
        )

        assert result.gst == Decimal("0.00")
        assert result.total_tax == Decimal("0.00")
        assert len(result.breakdown) == 1
        assert "Reverse Charge" in result.breakdown[0].description

    def test_large_amounts(self):
        """Test calculation with large amounts."""
        result = calculate_tax(
            subtotal=Decimal("10000.00"),
            jurisdiction="CA-ON",
        )

        assert result.hst == Decimal("1300.00")
        assert result.total_tax == Decimal("1300.00")

    def test_decimal_precision(self):
        """Test proper decimal rounding."""
        result = calculate_tax(
            subtotal=Decimal("99.99"),
            jurisdiction="AU",
        )

        # 10% of 99.99 = 9.999, should round to 10.00
        assert result.gst == Decimal("10.00")

    def test_zero_subtotal(self):
        """Test with zero subtotal."""
        result = calculate_tax(
            subtotal=Decimal("0.00"),
            jurisdiction="AU",
        )

        assert result.total_tax == Decimal("0.00")


class TestCalculateReverseTax:
    """Test reverse tax calculation (extracting tax from total)."""

    def test_reverse_australia_gst(self):
        """Test reverse calculation for Australian GST."""
        total_with_tax = Decimal("110.00")  # $100 + 10% GST

        result = calculate_reverse_tax(
            total_including_tax=total_with_tax,
            jurisdiction="AU",
        )

        assert result.gst == Decimal("10.00")
        assert result.total_tax == Decimal("10.00")

    def test_reverse_canada_hst(self):
        """Test reverse calculation for Canadian HST."""
        total_with_tax = Decimal("113.00")  # $100 + 13% HST

        result = calculate_reverse_tax(
            total_including_tax=total_with_tax,
            jurisdiction="CA-ON",
        )

        assert result.hst == Decimal("13.00")
        assert result.total_tax == Decimal("13.00")

    def test_reverse_with_gst_pst(self):
        """Test reverse calculation with GST + PST."""
        total_with_tax = Decimal("112.00")  # $100 + 5% GST + 7% PST

        result = calculate_reverse_tax(
            total_including_tax=total_with_tax,
            jurisdiction="CA-BC",
        )

        assert result.gst == Decimal("5.00")
        assert result.pst == Decimal("7.00")
        assert result.total_tax == Decimal("12.00")

    def test_reverse_exempt_category(self):
        """Test reverse calculation for exempt category."""
        result = calculate_reverse_tax(
            total_including_tax=Decimal("100.00"),
            jurisdiction="AU",
            product_category="groceries",
        )

        assert result.total_tax == Decimal("0.00")


class TestGetTaxRateInfo:
    """Test tax rate information lookup."""

    def test_australia_info(self):
        """Test Australian tax rate info."""
        info = get_tax_rate_info("AU")

        assert info["country"] == "AU"
        assert info["gst_rate"] == 0.10
        assert info["uses_hst"] is False
        assert info["combined_rate"] == 0.10

    def test_canada_bc_info(self):
        """Test BC tax rate info (GST + PST)."""
        info = get_tax_rate_info("CA-BC")

        assert info["country"] == "CA"
        assert info["province"] == "BC"
        assert info["gst_rate"] == 0.05
        assert info["pst_rate"] == 0.07
        assert info["uses_hst"] is False
        assert abs(info["combined_rate"] - 0.12) < 0.001  # Float precision tolerance

    def test_canada_on_info(self):
        """Test Ontario tax rate info (HST)."""
        info = get_tax_rate_info("CA-ON")

        assert info["country"] == "CA"
        assert info["province"] == "ON"
        assert info["uses_hst"] is True
        assert info["hst_rate"] == 0.13
        assert info["combined_rate"] == 0.13

    def test_unknown_jurisdiction(self):
        """Test info for unknown jurisdiction."""
        info = get_tax_rate_info("XX")

        assert info["country"] == "XX"
        assert info["gst_rate"] == 0.0
        assert info["combined_rate"] == 0.0


class TestTaxBreakdown:
    """Test tax breakdown details."""

    def test_breakdown_includes_rate(self):
        """Test breakdown includes rate information."""
        result = calculate_tax(
            subtotal=Decimal("100.00"),
            jurisdiction="AU",
        )

        assert result.breakdown[0].rate == Decimal("10")  # 10%
        assert result.breakdown[0].amount == Decimal("10.00")

    def test_breakdown_description(self):
        """Test breakdown includes description."""
        result = calculate_tax(
            subtotal=Decimal("100.00"),
            jurisdiction="CA-ON",
        )

        assert "HST" in result.breakdown[0].description
        assert "ON" in result.breakdown[0].description

    def test_multiple_breakdown_items(self):
        """Test breakdown with multiple tax components."""
        result = calculate_tax(
            subtotal=Decimal("100.00"),
            jurisdiction="CA-BC",
        )

        assert len(result.breakdown) == 2
        tax_types = {item.tax_type for item in result.breakdown}
        assert TaxType.GST in tax_types
        assert TaxType.PST in tax_types
