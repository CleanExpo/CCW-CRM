"""Tests for calculation utilities."""

from decimal import Decimal

import pytest

from src.utils.calculations import (
    calculate_line_total,
    calculate_margin,
    calculate_totals,
    calculate_unit_price,
    validate_price_vs_cost,
)


class TestCalculateLineTotal:
    """Tests for calculate_line_total function."""

    def test_basic_calculation(self):
        """Test basic line total calculation."""
        result = calculate_line_total(5, Decimal("10.00"))
        assert result == Decimal("50.00")

    def test_with_decimal_unit_price(self):
        """Test calculation with decimal unit price."""
        result = calculate_line_total(5, Decimal("10.50"))
        assert result == Decimal("52.50")

    def test_zero_quantity(self):
        """Test calculation with zero quantity."""
        result = calculate_line_total(0, Decimal("10.00"))
        assert result == Decimal("0.00")

    def test_zero_unit_price(self):
        """Test calculation with zero unit price."""
        result = calculate_line_total(5, Decimal("0.00"))
        assert result == Decimal("0.00")

    def test_rounding(self):
        """Test proper rounding to 2 decimal places."""
        result = calculate_line_total(3, Decimal("10.333333"))
        assert result == Decimal("31.00")  # 30.999999 rounds to 31.00

    def test_negative_quantity_raises_error(self):
        """Test that negative quantity raises ValueError."""
        with pytest.raises(ValueError, match="Quantity and unit price must be >= 0"):
            calculate_line_total(-1, Decimal("10.00"))

    def test_negative_unit_price_raises_error(self):
        """Test that negative unit price raises ValueError."""
        with pytest.raises(ValueError, match="Quantity and unit price must be >= 0"):
            calculate_line_total(5, Decimal("-10.00"))


class TestCalculateUnitPrice:
    """Tests for calculate_unit_price function (bidirectional)."""

    def test_basic_calculation(self):
        """Test basic unit price calculation."""
        result = calculate_unit_price(Decimal("100.00"), 5)
        assert result == Decimal("20.00")

    def test_with_decimal_result(self):
        """Test calculation resulting in decimal."""
        result = calculate_unit_price(Decimal("100.00"), 3)
        assert result == Decimal("33.33")  # Rounds down

    def test_rounding_up(self):
        """Test proper rounding up to 2 decimal places."""
        result = calculate_unit_price(Decimal("100.00"), 6)
        assert result == Decimal("16.67")  # 16.666... rounds to 16.67

    def test_zero_quantity_raises_error(self):
        """Test that zero quantity raises ValueError."""
        with pytest.raises(ValueError, match="Quantity must be > 0 for division"):
            calculate_unit_price(Decimal("100.00"), 0)

    def test_negative_quantity_raises_error(self):
        """Test that negative quantity raises ValueError."""
        with pytest.raises(ValueError, match="Quantity must be > 0 for division"):
            calculate_unit_price(Decimal("100.00"), -5)

    def test_negative_line_total_raises_error(self):
        """Test that negative line total raises ValueError."""
        with pytest.raises(ValueError, match="Line total must be >= 0"):
            calculate_unit_price(Decimal("-100.00"), 5)

    def test_zero_line_total(self):
        """Test calculation with zero line total."""
        result = calculate_unit_price(Decimal("0.00"), 5)
        assert result == Decimal("0.00")


class TestCalculateTotals:
    """Tests for calculate_totals function."""

    def test_basic_totals_with_tax(self):
        """Test basic totals calculation with tax."""
        items = [
            (5, Decimal("10.00")),  # 50.00
            (3, Decimal("20.00")),  # 60.00
        ]
        result = calculate_totals(items, Decimal("0.10"), tax_enabled=True)

        assert result["subtotal"] == Decimal("110.00")
        assert result["tax"] == Decimal("11.00")
        assert result["total"] == Decimal("121.00")

    def test_totals_without_tax(self):
        """Test totals calculation without tax."""
        items = [(5, Decimal("10.00"))]
        result = calculate_totals(items, Decimal("0.10"), tax_enabled=False)

        assert result["subtotal"] == Decimal("50.00")
        assert result["tax"] == Decimal("0.00")
        assert result["total"] == Decimal("50.00")

    def test_empty_items_list(self):
        """Test calculation with empty items list."""
        result = calculate_totals([], Decimal("0.10"))

        assert result["subtotal"] == Decimal("0.00")
        assert result["tax"] == Decimal("0.00")
        assert result["total"] == Decimal("0.00")

    def test_multiple_items(self):
        """Test calculation with multiple items."""
        items = [
            (2, Decimal("25.00")),   # 50.00
            (1, Decimal("100.00")),  # 100.00
            (10, Decimal("5.00")),   # 50.00
        ]
        result = calculate_totals(items, Decimal("0.10"))

        assert result["subtotal"] == Decimal("200.00")
        assert result["tax"] == Decimal("20.00")
        assert result["total"] == Decimal("220.00")

    def test_different_tax_rate(self):
        """Test calculation with different tax rate."""
        items = [(1, Decimal("100.00"))]
        result = calculate_totals(items, Decimal("0.15"))  # 15% tax

        assert result["subtotal"] == Decimal("100.00")
        assert result["tax"] == Decimal("15.00")
        assert result["total"] == Decimal("115.00")

    def test_zero_tax_rate(self):
        """Test calculation with zero tax rate."""
        items = [(1, Decimal("100.00"))]
        result = calculate_totals(items, Decimal("0.00"))

        assert result["subtotal"] == Decimal("100.00")
        assert result["tax"] == Decimal("0.00")
        assert result["total"] == Decimal("100.00")

    def test_negative_tax_rate_raises_error(self):
        """Test that negative tax rate raises ValueError."""
        items = [(1, Decimal("100.00"))]
        with pytest.raises(ValueError, match="Tax rate must be >= 0"):
            calculate_totals(items, Decimal("-0.10"))

    def test_tax_rounding(self):
        """Test proper rounding of tax amount."""
        items = [(1, Decimal("33.33"))]
        result = calculate_totals(items, Decimal("0.10"))

        assert result["subtotal"] == Decimal("33.33")
        assert result["tax"] == Decimal("3.33")  # 3.333 rounds to 3.33
        assert result["total"] == Decimal("36.66")


class TestCalculateMargin:
    """Tests for calculate_margin function."""

    def test_basic_margin(self):
        """Test basic margin calculation."""
        result = calculate_margin(Decimal("100.00"), Decimal("75.00"))

        assert result["margin_amount"] == Decimal("25.00")
        assert result["margin_percentage"] == Decimal("25.00")

    def test_50_percent_margin(self):
        """Test 50% margin calculation."""
        result = calculate_margin(Decimal("100.00"), Decimal("50.00"))

        assert result["margin_amount"] == Decimal("50.00")
        assert result["margin_percentage"] == Decimal("50.00")

    def test_zero_margin(self):
        """Test zero margin (price equals cost)."""
        result = calculate_margin(Decimal("100.00"), Decimal("100.00"))

        assert result["margin_amount"] == Decimal("0.00")
        assert result["margin_percentage"] == Decimal("0.00")

    def test_zero_cost(self):
        """Test margin with zero cost."""
        result = calculate_margin(Decimal("100.00"), Decimal("0.00"))

        assert result["margin_amount"] == Decimal("100.00")
        assert result["margin_percentage"] == Decimal("100.00")

    def test_margin_rounding(self):
        """Test proper rounding of margin percentage."""
        result = calculate_margin(Decimal("100.00"), Decimal("66.67"))

        assert result["margin_amount"] == Decimal("33.33")
        assert result["margin_percentage"] == Decimal("33.33")

    def test_zero_price_raises_error(self):
        """Test that zero price raises ValueError."""
        with pytest.raises(ValueError, match="Price must be > 0"):
            calculate_margin(Decimal("0.00"), Decimal("50.00"))

    def test_negative_price_raises_error(self):
        """Test that negative price raises ValueError."""
        with pytest.raises(ValueError, match="Price must be > 0"):
            calculate_margin(Decimal("-100.00"), Decimal("50.00"))

    def test_negative_cost_raises_error(self):
        """Test that negative cost raises ValueError."""
        with pytest.raises(ValueError, match="Cost must be >= 0"):
            calculate_margin(Decimal("100.00"), Decimal("-50.00"))

    def test_cost_exceeds_price_raises_error(self):
        """Test that cost > price raises ValueError."""
        with pytest.raises(ValueError, match="Cost cannot exceed price"):
            calculate_margin(Decimal("100.00"), Decimal("150.00"))


class TestValidatePriceVsCost:
    """Tests for validate_price_vs_cost function."""

    def test_price_greater_than_cost(self):
        """Test validation when price > cost."""
        result = validate_price_vs_cost(Decimal("100.00"), Decimal("75.00"))
        assert result is True

    def test_price_equals_cost(self):
        """Test validation when price equals cost."""
        result = validate_price_vs_cost(Decimal("100.00"), Decimal("100.00"))
        assert result is True

    def test_price_less_than_cost(self):
        """Test validation when price < cost."""
        result = validate_price_vs_cost(Decimal("75.00"), Decimal("100.00"))
        assert result is False

    def test_none_cost(self):
        """Test validation when cost is None."""
        result = validate_price_vs_cost(Decimal("100.00"), None)
        assert result is True

    def test_zero_cost(self):
        """Test validation with zero cost."""
        result = validate_price_vs_cost(Decimal("100.00"), Decimal("0.00"))
        assert result is True
