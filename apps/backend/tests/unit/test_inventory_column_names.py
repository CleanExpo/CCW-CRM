"""
Unit tests — inventory column name regression guard.

These tests verify that:
  1. ProductStockByLocation uses `stock` and `reserved` (not the old
     `quantity_on_hand` / `quantity_reserved` / `quantity_available` names
     that caused AttributeError in production).
  2. `available` is a computed @property, not a database column, so callers
     must never attempt to SET it on the ORM instance.
  3. `reorder_point` lives on ProductStockByLocation, not on Product.

No database connection is required — all assertions use __table__ metadata
and __dict__ inspection, which resolve without a running DB or full mapper
configuration.
"""

from __future__ import annotations

import pytest

from src.db.inventory_models import ProductStockByLocation


def _table_column_names(model_class) -> set[str]:
    """Return the set of real DB column names via __table__ (no mapper needed)."""
    return {c.name for c in model_class.__table__.columns}


# ---------------------------------------------------------------------------
# Column presence / absence
# ---------------------------------------------------------------------------


class TestProductStockByLocationColumns:
    """Regression guard: correct column names must be present, old names absent."""

    def test_stock_column_exists(self) -> None:
        """`stock` must be a real DB column (renamed from quantity_on_hand)."""
        cols = _table_column_names(ProductStockByLocation)
        assert "stock" in cols, (
            "ProductStockByLocation.stock column missing — "
            "receive-goods endpoint and auto-reorder cron will crash."
        )

    def test_reserved_column_exists(self) -> None:
        """`reserved` must be a real DB column (renamed from quantity_reserved)."""
        cols = _table_column_names(ProductStockByLocation)
        assert "reserved" in cols, (
            "ProductStockByLocation.reserved column missing — "
            "receive-goods endpoint will crash on new-record creation."
        )

    def test_reorder_point_column_exists(self) -> None:
        """`reorder_point` must be a real DB column on ProductStockByLocation."""
        cols = _table_column_names(ProductStockByLocation)
        assert "reorder_point" in cols, (
            "ProductStockByLocation.reorder_point column missing — "
            "auto-reorder cron will raise AttributeError when building the query."
        )

    def test_old_column_quantity_on_hand_absent(self) -> None:
        """`quantity_on_hand` must NOT be a DB column (buggy name from PR #110)."""
        cols = _table_column_names(ProductStockByLocation)
        assert "quantity_on_hand" not in cols, (
            "Unexpected 'quantity_on_hand' column found — "
            "the column was renamed to 'stock'; remove the duplicate."
        )

    def test_old_column_quantity_reserved_absent(self) -> None:
        """`quantity_reserved` must NOT be a DB column (buggy name from PR #110)."""
        cols = _table_column_names(ProductStockByLocation)
        assert "quantity_reserved" not in cols, (
            "Unexpected 'quantity_reserved' column found — "
            "the column was renamed to 'reserved'; remove the duplicate."
        )

    def test_old_column_quantity_available_absent(self) -> None:
        """`quantity_available` must NOT be a DB column (it was the buggy name)."""
        cols = _table_column_names(ProductStockByLocation)
        assert "quantity_available" not in cols, (
            "Unexpected 'quantity_available' column found — "
            "'available' is a computed @property, never a DB column."
        )


# ---------------------------------------------------------------------------
# 'available' is a computed property, not a column
# ---------------------------------------------------------------------------


class TestAvailableIsComputedProperty:
    """`available` must be a @property so callers cannot accidentally SET it."""

    def test_available_is_python_property(self) -> None:
        """`available` must be a Python @property on the class."""
        attr = ProductStockByLocation.__dict__.get("available")
        assert attr is not None, (
            "ProductStockByLocation.available is not defined on the class."
        )
        assert isinstance(attr, property), (
            f"ProductStockByLocation.available must be a @property, got {type(attr).__name__}. "
            "A DB column named 'available' would break the receive-goods endpoint."
        )

    def test_available_is_not_a_db_column(self) -> None:
        """`available` must NOT appear in the SQLAlchemy table column map."""
        cols = _table_column_names(ProductStockByLocation)
        assert "available" not in cols, (
            "ProductStockByLocation.available appears as a DB column — "
            "it must remain a pure computed @property (stock - reserved)."
        )

    def test_available_computes_stock_minus_reserved(self) -> None:
        """`available` fget returns stock - reserved for stock > reserved."""
        attr = ProductStockByLocation.__dict__["available"]

        class _Fake:
            stock = 10
            reserved = 3

        assert attr.fget(_Fake()) == 7

    def test_available_clamps_at_zero(self) -> None:
        """`available` must never return a negative value."""
        attr = ProductStockByLocation.__dict__["available"]

        class _Fake:
            stock = 2
            reserved = 5

        assert attr.fget(_Fake()) == 0

    def test_available_zero_reserved(self) -> None:
        """`available` == stock when reserved is 0."""
        attr = ProductStockByLocation.__dict__["available"]

        class _Fake:
            stock = 8
            reserved = 0

        assert attr.fget(_Fake()) == 8
