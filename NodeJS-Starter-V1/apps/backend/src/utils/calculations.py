"""
Shared calculation utilities for Orders, Quotes, and Purchase Orders.

This module provides DRY calculation functions to eliminate duplication
across different parts of the ERP system. All financial calculations use
Python's Decimal type for precision.
"""

from decimal import Decimal, ROUND_HALF_UP
from typing import TypedDict


class CalculationTotals(TypedDict):
    """Type definition for totals calculation result."""
    subtotal: Decimal
    tax: Decimal
    total: Decimal


def calculate_line_total(quantity: int, unit_price: Decimal) -> Decimal:
    """
    Calculate line total from quantity and unit price.

    Args:
        quantity: Number of units (must be >= 0)
        unit_price: Price per unit (must be >= 0)

    Returns:
        Line total rounded to 2 decimal places

    Raises:
        ValueError: If quantity or unit_price is negative

    Example:
        >>> calculate_line_total(5, Decimal("10.50"))
        Decimal('52.50')
    """
    if quantity < 0 or unit_price < 0:
        raise ValueError("Quantity and unit price must be >= 0")

    line_total = unit_price * Decimal(quantity)
    return line_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_unit_price(line_total: Decimal, quantity: int) -> Decimal:
    """
    Calculate unit price from line total (bidirectional calculation).

    This function enables the reverse calculation: given a total amount
    and quantity, calculate what the unit price should be.

    Args:
        line_total: Total amount for the line (must be >= 0)
        quantity: Number of units (must be > 0)

    Returns:
        Unit price rounded to 2 decimal places

    Raises:
        ValueError: If quantity is <= 0 (division by zero)
        ValueError: If line_total is negative

    Example:
        >>> calculate_unit_price(Decimal("100.00"), 5)
        Decimal('20.00')
    """
    if quantity <= 0:
        raise ValueError("Quantity must be > 0 for division")
    if line_total < 0:
        raise ValueError("Line total must be >= 0")

    unit_price = line_total / Decimal(quantity)
    return unit_price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def calculate_totals(
    line_items: list[tuple[int, Decimal]],
    tax_rate: Decimal,
    tax_enabled: bool = True
) -> CalculationTotals:
    """
    Calculate subtotal, tax, and total from line items.

    Args:
        line_items: List of (quantity, unit_price) tuples
        tax_rate: Tax rate as decimal (e.g., 0.10 for 10%)
        tax_enabled: Whether to apply tax (default: True)

    Returns:
        Dictionary with 'subtotal', 'tax', and 'total' keys

    Raises:
        ValueError: If tax_rate is negative

    Example:
        >>> items = [(5, Decimal("10.00")), (3, Decimal("20.00"))]
        >>> calculate_totals(items, Decimal("0.10"))
        {'subtotal': Decimal('110.00'), 'tax': Decimal('11.00'), 'total': Decimal('121.00')}
    """
    if tax_rate < 0:
        raise ValueError("Tax rate must be >= 0")

    subtotal = sum(
        (calculate_line_total(qty, price) for qty, price in line_items),
        start=Decimal("0.00")
    )

    tax = (
        (subtotal * tax_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if tax_enabled
        else Decimal("0.00")
    )

    total = subtotal + tax

    return {
        "subtotal": subtotal,
        "tax": tax,
        "total": total
    }


def calculate_margin(price: Decimal, cost: Decimal) -> dict[str, Decimal]:
    """
    Calculate profit margin: (price - cost) / price × 100.

    Args:
        price: Selling price (must be > 0)
        cost: Cost price (must be >= 0)

    Returns:
        Dictionary with 'margin_amount' and 'margin_percentage' keys

    Raises:
        ValueError: If price <= 0 or cost < 0
        ValueError: If cost > price (negative margin)

    Example:
        >>> calculate_margin(Decimal("100.00"), Decimal("75.00"))
        {'margin_amount': Decimal('25.00'), 'margin_percentage': Decimal('25.00')}
    """
    if price <= 0:
        raise ValueError("Price must be > 0")
    if cost < 0:
        raise ValueError("Cost must be >= 0")
    if cost > price:
        raise ValueError("Cost cannot exceed price (negative margin)")

    margin_amount = price - cost
    margin_percentage = ((margin_amount / price) * Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    return {
        "margin_amount": margin_amount,
        "margin_percentage": margin_percentage
    }


def validate_price_vs_cost(price: Decimal, cost: Decimal | None) -> bool:
    """
    Validate that price is greater than or equal to cost.

    This is used in Pydantic validators to ensure products maintain
    positive or zero margins.

    Args:
        price: Selling price
        cost: Cost price (can be None)

    Returns:
        True if valid, False otherwise

    Example:
        >>> validate_price_vs_cost(Decimal("100"), Decimal("75"))
        True
        >>> validate_price_vs_cost(Decimal("50"), Decimal("75"))
        False
    """
    if cost is None:
        return True
    return price >= cost
