"""
Warehouse service — landed cost apportionment logic.

Separated from the HTTP route so the algorithm can be tested without a
database session (pure-function style).

Apportionment algorithm
-----------------------
Given a GRN header total landed cost L and a set of lines each with a PO
unit cost p_i and quantity q_i:

  total_po_value  = Σ (p_i × q_i)          for received lines (q_i > 0)

  If total_po_value > 0:
      landed_per_unit_i = L × p_i / total_po_value
  Elif active line count > 0 (all unit costs zero):
      landed_per_unit_i = L / (active_count × q_i)   — equal apportionment
  Else:
      landed_per_unit_i = 0

  cost_per_unit_i = p_i + landed_per_unit_i

This is the GAAP-standard value-proportional allocation method (ASC 330 /
IAS 2), which ensures the landed overhead burden mirrors each SKU's
relative purchase value.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

__all__ = [
    "LandedCostLine",
    "apportion_landed_costs",
]


@dataclass
class LandedCostLine:
    """Input/output record for a single GRN line used in apportionment."""

    po_item_id: object  # UUID — kept as ``object`` to avoid circular deps
    product_id: object  # UUID
    quantity_received: int
    quantity_rejected: int
    quantity_expected: int
    po_unit_cost: Decimal

    # Filled in by ``apportion_landed_costs``
    landed_cost_per_unit: Decimal = Decimal("0")
    cost_per_unit: Decimal = Decimal("0")


def apportion_landed_costs(
    lines: list[LandedCostLine],
    freight_cost: Decimal,
    customs_duty: Decimal,
    handling_cost: Decimal,
) -> list[LandedCostLine]:
    """Apportion landed costs across GRN lines and return updated lines.

    Mutates and returns the same list for convenience; caller is free to copy
    beforehand if immutability is required.

    Args:
        lines:          GRN lines.  Only lines with ``quantity_received > 0``
                        participate in the apportionment base.
        freight_cost:   Inbound freight/shipping total for this GRN.
        customs_duty:   Customs/import duty total.
        handling_cost:  Warehousing/handling total.

    Returns:
        The same ``lines`` list with ``landed_cost_per_unit`` and
        ``cost_per_unit`` populated on every element.
    """
    total_landed: Decimal = freight_cost + customs_duty + handling_cost

    if total_landed == Decimal("0"):
        # Fast path — no landed costs to apportion.
        for ln in lines:
            ln.landed_cost_per_unit = Decimal("0")
            ln.cost_per_unit = ln.po_unit_cost
        return lines

    # --- Compute apportionment base ---
    total_po_value: Decimal = sum(
        (ln.po_unit_cost * Decimal(ln.quantity_received)
         for ln in lines
         if ln.quantity_received > 0),
        Decimal("0"),
    )
    active_line_count: int = sum(1 for ln in lines if ln.quantity_received > 0)

    for ln in lines:
        if ln.quantity_received <= 0:
            ln.landed_cost_per_unit = Decimal("0")
            ln.cost_per_unit = ln.po_unit_cost
            continue

        if total_po_value > Decimal("0"):
            # Value-proportional: landed_per_unit = L × unit_cost / total_po_value
            # (qty cancels because total_po_value already includes qty weighting)
            landed_per_unit = (total_landed * ln.po_unit_cost) / total_po_value
        elif active_line_count > 0:
            # Equal-apportionment fallback: all SKUs have zero PO cost
            landed_per_unit = (
                total_landed / Decimal(active_line_count) / Decimal(ln.quantity_received)
            )
        else:
            landed_per_unit = Decimal("0")

        ln.landed_cost_per_unit = landed_per_unit
        ln.cost_per_unit = ln.po_unit_cost + landed_per_unit

    return lines
