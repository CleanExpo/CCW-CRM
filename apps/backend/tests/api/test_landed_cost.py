"""Tests for the landed-cost apportionment helper (UNI-1832).

Standalone logic tests for the pure helper — no DB fixture required.
"""

from decimal import Decimal

import pytest


def test_apportion_landed_cost_proportional_to_subtotals():
    """Landed cost is allocated in proportion to each line's subtotal."""
    from src.api.routes.purchase_orders import apportion_landed_cost

    subtotals = [Decimal("400"), Decimal("600")]
    shares = apportion_landed_cost(subtotals, Decimal("100"))

    assert shares == [Decimal("40.00"), Decimal("60.00")]
    assert sum(shares) == Decimal("100.00")


def test_apportion_landed_cost_preserves_exact_total():
    """Rounding drift is absorbed — sum of shares equals total_landed exactly."""
    from src.api.routes.purchase_orders import apportion_landed_cost

    subtotals = [Decimal("333.33"), Decimal("333.33"), Decimal("333.34")]
    shares = apportion_landed_cost(subtotals, Decimal("10"))

    assert sum(shares) == Decimal("10.00")
    for share in shares:
        assert Decimal("3.30") <= share <= Decimal("3.40")


def test_apportion_landed_cost_zero_subtotals_split_evenly():
    """If no line carries weight, distribute equally rather than drop the cost."""
    from src.api.routes.purchase_orders import apportion_landed_cost

    subtotals = [Decimal("0"), Decimal("0"), Decimal("0")]
    shares = apportion_landed_cost(subtotals, Decimal("30"))

    assert sum(shares) == Decimal("30.00")
    assert all(Decimal("9.99") <= s <= Decimal("10.01") for s in shares)


def test_apportion_landed_cost_zero_landed_returns_zeros():
    """No landed cost -> all zeros, same length as input."""
    from src.api.routes.purchase_orders import apportion_landed_cost

    subtotals = [Decimal("100"), Decimal("200"), Decimal("300")]
    shares = apportion_landed_cost(subtotals, Decimal("0"))

    assert shares == [Decimal("0"), Decimal("0"), Decimal("0")]


def test_apportion_landed_cost_empty_input():
    """Empty list is a valid degenerate input."""
    from src.api.routes.purchase_orders import apportion_landed_cost

    assert apportion_landed_cost([], Decimal("100")) == []


@pytest.mark.parametrize(
    "subtotals, total_landed, expected_sum",
    [
        ([Decimal("1000")], Decimal("75.50"), Decimal("75.50")),
        ([Decimal("100"), Decimal("100")], Decimal("33.33"), Decimal("33.33")),
        ([Decimal("250"), Decimal("750")], Decimal("200"), Decimal("200.00")),
        ([Decimal("1.23"), Decimal("4.56"), Decimal("7.89")], Decimal("0.99"), Decimal("0.99")),
    ],
)
def test_apportion_landed_cost_sum_matches_total(subtotals, total_landed, expected_sum):
    """Across a variety of shapes, shares sum to the requested total_landed."""
    from src.api.routes.purchase_orders import apportion_landed_cost

    shares = apportion_landed_cost(subtotals, total_landed)
    assert sum(shares) == expected_sum, (
        f"Expected sum {expected_sum}, got {sum(shares)} for subtotals {subtotals}"
    )
