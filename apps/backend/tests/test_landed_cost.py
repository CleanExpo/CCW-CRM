"""
Pure unit tests for landed cost apportionment (UNI-1832).

These tests exercise ``warehouse.apportion_landed_costs`` without any DB
session — fast, deterministic, and runnable in isolation.

Run:
    cd apps/backend && uv run pytest tests/test_landed_cost.py -v
"""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest

from src.warehouse import LandedCostLine, apportion_landed_costs


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _line(
    unit_cost: str,
    qty_received: int,
    qty_expected: int | None = None,
    qty_rejected: int = 0,
) -> LandedCostLine:
    return LandedCostLine(
        po_item_id=uuid.uuid4(),
        product_id=uuid.uuid4(),
        quantity_received=qty_received,
        quantity_rejected=qty_rejected,
        quantity_expected=qty_expected if qty_expected is not None else qty_received,
        po_unit_cost=Decimal(unit_cost),
    )


# ---------------------------------------------------------------------------
# Zero landed cost — fast path
# ---------------------------------------------------------------------------


class TestZeroLandedCost:
    """No landed costs → cost_per_unit == po_unit_cost for every line."""

    def test_all_zeros(self) -> None:
        lines = [_line("10.00", 5), _line("20.00", 3)]
        result = apportion_landed_costs(
            lines,
            freight_cost=Decimal("0"),
            customs_duty=Decimal("0"),
            handling_cost=Decimal("0"),
        )
        assert result[0].landed_cost_per_unit == Decimal("0")
        assert result[0].cost_per_unit == Decimal("10.00")
        assert result[1].landed_cost_per_unit == Decimal("0")
        assert result[1].cost_per_unit == Decimal("20.00")


# ---------------------------------------------------------------------------
# Value-proportional apportionment (normal case)
# ---------------------------------------------------------------------------


class TestValueProportionalApportionment:
    """Standard case: all lines have positive unit costs."""

    def test_single_line_absorbs_all_landed_cost(self) -> None:
        lines = [_line("50.00", 4)]
        result = apportion_landed_costs(
            lines,
            freight_cost=Decimal("200.00"),
            customs_duty=Decimal("0"),
            handling_cost=Decimal("0"),
        )
        ln = result[0]
        # Only one active line → absorbs 100% of landed cost
        # landed_per_unit = 200 × 50 / (50×4) = 200/4 = 50
        assert ln.landed_cost_per_unit == pytest.approx(Decimal("50.00"), abs=Decimal("0.0001"))
        assert ln.cost_per_unit == pytest.approx(Decimal("100.00"), abs=Decimal("0.0001"))

    def test_two_equal_cost_lines_share_equally(self) -> None:
        lines = [_line("100.00", 2), _line("100.00", 2)]
        result = apportion_landed_costs(
            lines,
            freight_cost=Decimal("400.00"),
            customs_duty=Decimal("0"),
            handling_cost=Decimal("0"),
        )
        # Both lines same unit cost → each gets 200/2 = 100 per unit
        for ln in result:
            assert ln.landed_cost_per_unit == pytest.approx(Decimal("100.00"), abs=Decimal("0.0001"))
            assert ln.cost_per_unit == pytest.approx(Decimal("200.00"), abs=Decimal("0.0001"))

    def test_value_proportional_allocation(self) -> None:
        """High-cost SKU receives more landed cost per unit than low-cost SKU."""
        lines = [_line("10.00", 10), _line("90.00", 10)]
        result = apportion_landed_costs(
            lines,
            freight_cost=Decimal("1000.00"),
            customs_duty=Decimal("0"),
            handling_cost=Decimal("0"),
        )
        # total_po_value = 10×10 + 90×10 = 1000
        # line0: landed = 1000 × 10 / 1000 = 10 per unit
        # line1: landed = 1000 × 90 / 1000 = 90 per unit
        assert result[0].landed_cost_per_unit == pytest.approx(Decimal("10.00"), abs=Decimal("0.001"))
        assert result[1].landed_cost_per_unit == pytest.approx(Decimal("90.00"), abs=Decimal("0.001"))

    def test_total_apportioned_reconstitutes_header_total(self) -> None:
        """Σ(landed_per_unit × qty) == total_landed_cost (within rounding)."""
        lines = [_line("25.00", 3), _line("40.00", 7), _line("15.00", 5)]
        freight = Decimal("300.00")
        customs = Decimal("150.00")
        handling = Decimal("50.00")
        total_landed = freight + customs + handling

        result = apportion_landed_costs(lines, freight, customs, handling)

        total_apportioned = sum(
            ln.landed_cost_per_unit * Decimal(ln.quantity_received)
            for ln in result
        )
        assert total_apportioned == pytest.approx(total_landed, abs=Decimal("0.01"))

    def test_combined_freight_duty_handling(self) -> None:
        lines = [_line("100.00", 2)]
        result = apportion_landed_costs(
            lines,
            freight_cost=Decimal("100.00"),
            customs_duty=Decimal("50.00"),
            handling_cost=Decimal("50.00"),
        )
        # total_landed = 200; total_po_value = 200
        # landed_per_unit = 200 × 100 / 200 = 100
        assert result[0].landed_cost_per_unit == pytest.approx(Decimal("100.00"), abs=Decimal("0.001"))
        assert result[0].cost_per_unit == pytest.approx(Decimal("200.00"), abs=Decimal("0.001"))


# ---------------------------------------------------------------------------
# Equal apportionment fallback (all PO unit costs == 0)
# ---------------------------------------------------------------------------


class TestEqualApportionmentFallback:
    """When all po_unit_cost values are 0, cost is divided equally."""

    def test_zero_po_cost_equal_fallback(self) -> None:
        lines = [_line("0.00", 5), _line("0.00", 5)]
        result = apportion_landed_costs(
            lines,
            freight_cost=Decimal("100.00"),
            customs_duty=Decimal("0"),
            handling_cost=Decimal("0"),
        )
        # Equal fallback: 100 / 2 lines / 5 qty each = 10 per unit
        for ln in result:
            assert ln.landed_cost_per_unit == pytest.approx(Decimal("10.00"), abs=Decimal("0.001"))
            assert ln.cost_per_unit == pytest.approx(Decimal("10.00"), abs=Decimal("0.001"))


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


class TestEdgeCases:
    """Edge cases: zero-qty lines, single line, large decimals."""

    def test_zero_qty_lines_get_zero_landed_cost(self) -> None:
        lines = [_line("50.00", 0), _line("50.00", 10)]
        result = apportion_landed_costs(
            lines,
            freight_cost=Decimal("500.00"),
            customs_duty=Decimal("0"),
            handling_cost=Decimal("0"),
        )
        assert result[0].landed_cost_per_unit == Decimal("0")
        assert result[0].cost_per_unit == Decimal("50.00")
        # Active line absorbs all
        assert result[1].landed_cost_per_unit > Decimal("0")

    def test_empty_lines_list(self) -> None:
        result = apportion_landed_costs(
            [],
            freight_cost=Decimal("100.00"),
            customs_duty=Decimal("0"),
            handling_cost=Decimal("0"),
        )
        assert result == []

    def test_high_precision_decimal(self) -> None:
        """Ensure no floating-point drift with high-precision decimals."""
        lines = [_line("123.456789", 7)]
        result = apportion_landed_costs(
            lines,
            freight_cost=Decimal("99.999999"),
            customs_duty=Decimal("0"),
            handling_cost=Decimal("0"),
        )
        # Should not raise; result should be finite
        assert result[0].cost_per_unit > result[0].po_unit_cost

    def test_returns_same_list_object(self) -> None:
        """Function mutates and returns the same list (documented behaviour)."""
        lines = [_line("10.00", 2)]
        result = apportion_landed_costs(lines, Decimal("0"), Decimal("0"), Decimal("0"))
        assert result is lines
