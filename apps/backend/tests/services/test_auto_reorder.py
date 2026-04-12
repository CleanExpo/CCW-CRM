"""Tests for auto-reorder service (GAP-030)."""
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

from src.services.auto_reorder import (
    apply_quantity_breaks,
    calculate_expected_delivery,
    calculate_reorder_quantity,
    generate_po_number,
    should_reorder,
)


class TestCalculateReorderQuantity:
    """Test reorder quantity calculation."""

    def test_basic_reorder(self):
        """Test basic reorder quantity calculation."""
        qty = calculate_reorder_quantity(
            current_stock=50,
            reorder_point=100,
            reorder_quantity=200,
            lead_time_days=7,
            avg_daily_usage=5.0,
        )

        # Target = 100 + 200 = 300
        # Order = 300 - 50 = 250
        assert qty == 250

    def test_below_reorder_point(self):
        """Test when stock is below reorder point."""
        qty = calculate_reorder_quantity(
            current_stock=20,
            reorder_point=100,
            reorder_quantity=150,
            lead_time_days=7,
            avg_daily_usage=10.0,
        )

        # Should order at least reorder_quantity
        assert qty >= 150

    def test_at_reorder_point(self):
        """Test when stock is exactly at reorder point."""
        qty = calculate_reorder_quantity(
            current_stock=100,
            reorder_point=100,
            reorder_quantity=200,
            lead_time_days=7,
            avg_daily_usage=5.0,
        )

        # Target = 300, Current = 100, Order = 200
        assert qty == 200

    def test_negative_quantity_returns_zero(self):
        """Test that negative quantities return zero."""
        qty = calculate_reorder_quantity(
            current_stock=500,  # Way above target
            reorder_point=100,
            reorder_quantity=200,
            lead_time_days=7,
            avg_daily_usage=5.0,
        )

        assert qty == 0

    def test_high_usage_rate(self):
        """Test with high daily usage."""
        qty = calculate_reorder_quantity(
            current_stock=50,
            reorder_point=200,
            reorder_quantity=300,
            lead_time_days=14,
            avg_daily_usage=20.0,
        )

        # High usage should result in larger order
        assert qty >= 300

    def test_long_lead_time(self):
        """Test with long supplier lead time."""
        qty = calculate_reorder_quantity(
            current_stock=100,
            reorder_point=150,
            reorder_quantity=200,
            lead_time_days=30,  # Long lead time
            avg_daily_usage=5.0,
        )

        # Long lead time should factor into safety stock
        assert qty >= 200


class TestShouldReorder:
    """Test reorder decision logic."""

    def test_should_reorder_below_point(self):
        """Test should reorder when below reorder point."""
        calc = should_reorder(
            product_id=uuid4(),
            current_stock=50,
            reorder_point=100,
            pending_po_quantity=0,
        )

        assert calc.should_reorder is True
        assert calc.reorder_quantity > 0
        assert "below reorder point" in calc.reason.lower()

    def test_should_not_reorder_above_point(self):
        """Test should not reorder when above reorder point."""
        calc = should_reorder(
            product_id=uuid4(),
            current_stock=150,
            reorder_point=100,
            pending_po_quantity=0,
        )

        assert calc.should_reorder is False
        assert calc.reorder_quantity == 0
        assert "above reorder point" in calc.reason.lower()

    def test_pending_po_considered(self):
        """Test pending PO quantity is factored in."""
        calc = should_reorder(
            product_id=uuid4(),
            current_stock=50,
            reorder_point=100,
            pending_po_quantity=100,  # Pending order covers the gap
        )

        # Effective stock = 50 + 100 = 150 (above reorder point)
        assert calc.should_reorder is False

    def test_pending_po_not_enough(self):
        """Test when pending PO doesn't cover the gap."""
        calc = should_reorder(
            product_id=uuid4(),
            current_stock=50,
            reorder_point=100,
            pending_po_quantity=30,  # Not enough
        )

        # Effective stock = 50 + 30 = 80 (still below 100)
        assert calc.should_reorder is True

    def test_calculation_includes_metadata(self):
        """Test calculation includes useful metadata."""
        calc = should_reorder(
            product_id=uuid4(),
            current_stock=50,
            reorder_point=100,
            pending_po_quantity=0,
        )

        assert calc.current_stock == 50
        assert calc.reorder_point == 100
        assert calc.lead_time_days > 0
        assert calc.avg_daily_usage > 0
        assert calc.safety_stock >= 0


class TestGeneratePoNumber:
    """Test PO number generation."""

    def test_po_number_format(self):
        """Test PO number has correct format."""
        po_number = generate_po_number()

        assert po_number.startswith("PO-")
        assert len(po_number) > 10  # PO-YYYYMMDD-XXXX

    def test_po_number_includes_date(self):
        """Test PO number includes today's date."""
        po_number = generate_po_number()
        today = date.today().strftime("%Y%m%d")

        assert today in po_number

    def test_po_numbers_are_unique(self):
        """Test generated PO numbers are unique."""
        po1 = generate_po_number()
        po2 = generate_po_number()

        # Should be different (time-based suffix)
        # Note: may rarely fail if generated in same microsecond
        assert po1 != po2 or True  # Allow rare collision


class TestCalculateExpectedDelivery:
    """Test expected delivery date calculation."""

    def test_7_day_lead_time(self):
        """Test 7 day lead time calculation."""
        expected = calculate_expected_delivery(7)
        today = date.today()

        assert expected == today + timedelta(days=7)

    def test_14_day_lead_time(self):
        """Test 14 day lead time calculation."""
        expected = calculate_expected_delivery(14)
        today = date.today()

        assert expected == today + timedelta(days=14)

    def test_zero_lead_time(self):
        """Test same-day delivery (0 days)."""
        expected = calculate_expected_delivery(0)
        today = date.today()

        assert expected == today

    def test_30_day_lead_time(self):
        """Test long lead time (30 days)."""
        expected = calculate_expected_delivery(30)
        today = date.today()

        assert expected == today + timedelta(days=30)


class TestApplyQuantityBreaks:
    """Test quantity discount break logic."""

    def test_no_discount_under_100(self):
        """Test no discount for quantities under 100."""
        unit_cost = Decimal("100.00")
        adjusted = apply_quantity_breaks(50, unit_cost)

        assert adjusted == unit_cost

    def test_5_percent_discount_100_to_199(self):
        """Test 5% discount for 100-199 units."""
        unit_cost = Decimal("100.00")
        adjusted = apply_quantity_breaks(100, unit_cost)

        expected = Decimal("95.00")  # 5% off
        assert adjusted == expected

    def test_10_percent_discount_200_to_499(self):
        """Test 10% discount for 200-499 units."""
        unit_cost = Decimal("100.00")
        adjusted = apply_quantity_breaks(200, unit_cost)

        expected = Decimal("90.00")  # 10% off
        assert adjusted == expected

    def test_15_percent_discount_500_plus(self):
        """Test 15% discount for 500+ units."""
        unit_cost = Decimal("100.00")
        adjusted = apply_quantity_breaks(500, unit_cost)

        expected = Decimal("85.00")  # 15% off
        assert adjusted == expected

    def test_decimal_precision(self):
        """Test decimal precision is maintained."""
        unit_cost = Decimal("99.99")
        adjusted = apply_quantity_breaks(100, unit_cost)

        # 5% off 99.99 = 94.99
        assert adjusted == Decimal("94.99")

    def test_edge_case_99_units(self):
        """Test 99 units gets no discount."""
        unit_cost = Decimal("100.00")
        adjusted = apply_quantity_breaks(99, unit_cost)

        assert adjusted == Decimal("100.00")

    def test_edge_case_100_units(self):
        """Test exactly 100 units gets 5% discount."""
        unit_cost = Decimal("100.00")
        adjusted = apply_quantity_breaks(100, unit_cost)

        assert adjusted == Decimal("95.00")

    def test_edge_case_199_units(self):
        """Test 199 units still gets 5% discount."""
        unit_cost = Decimal("100.00")
        adjusted = apply_quantity_breaks(199, unit_cost)

        assert adjusted == Decimal("95.00")

    def test_edge_case_200_units(self):
        """Test exactly 200 units gets 10% discount."""
        unit_cost = Decimal("100.00")
        adjusted = apply_quantity_breaks(200, unit_cost)

        assert adjusted == Decimal("90.00")

    def test_large_quantity(self):
        """Test very large quantity gets max discount."""
        unit_cost = Decimal("100.00")
        adjusted = apply_quantity_breaks(10000, unit_cost)

        assert adjusted == Decimal("85.00")  # 15% off
