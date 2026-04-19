"""Tests for the pick-list aggregation helper (UNI-1828).

Standalone logic tests for ``aggregate_pick_list_lines`` — no DB fixture.
Route-integration tests are a follow-up once the shared conftest is restored.
"""


def _line(**kwargs):
    """Build a pick-list input line with sensible defaults."""
    return {
        "location": kwargs.get("location", "brisbane"),
        "product_id": kwargs.get("product_id", "prod-001"),
        "sku": kwargs.get("sku", "SKU-001"),
        "name": kwargs.get("name", "Widget"),
        "quantity": kwargs.get("quantity", 1),
        "order_id": kwargs.get("order_id", "ord-001"),
        "order_number": kwargs.get("order_number", "ORD-001"),
        "customer_name": kwargs.get("customer_name", "Acme"),
    }


def test_pick_list_aggregates_same_sku_across_orders():
    """Two orders needing the same SKU at the same location → one line, summed."""
    from src.api.routes.warehouse import aggregate_pick_list_lines

    lines = [
        _line(order_id="A", order_number="ORD-A", customer_name="Acme", quantity=3),
        _line(order_id="B", order_number="ORD-B", customer_name="Bright", quantity=2),
    ]
    result = aggregate_pick_list_lines(lines)

    assert len(result) == 1
    assert result[0]["total_quantity"] == 5
    assert {o["order_number"] for o in result[0]["contributing_orders"]} == {
        "ORD-A",
        "ORD-B",
    }


def test_pick_list_splits_same_sku_across_locations():
    """Same SKU but different warehouses must stay separate — a picker can't
    be in two zones at once."""
    from src.api.routes.warehouse import aggregate_pick_list_lines

    lines = [
        _line(location="brisbane", quantity=2),
        _line(location="sydney", quantity=4),
    ]
    result = aggregate_pick_list_lines(lines)

    assert len(result) == 2
    locs = {row["location"]: row["total_quantity"] for row in result}
    assert locs == {"brisbane": 2, "sydney": 4}


def test_pick_list_null_location_becomes_unassigned():
    """Orders with no fulfillment_location must still make it onto the pick list,
    flagged as 'unassigned' so the dispatcher can triage."""
    from src.api.routes.warehouse import aggregate_pick_list_lines

    lines = [_line(location=None, quantity=7)]
    result = aggregate_pick_list_lines(lines)

    assert len(result) == 1
    assert result[0]["location"] == "unassigned"
    assert result[0]["total_quantity"] == 7


def test_pick_list_output_sorted_deterministically():
    """Output must be stable across runs — same input always prints the same
    order. Sorted by (location, sku). Distinct product_ids required so each
    SKU is its own row (aggregation key is location+product_id)."""
    from src.api.routes.warehouse import aggregate_pick_list_lines

    lines = [
        _line(location="sydney", product_id="prod-999", sku="Z-999"),
        _line(location="brisbane", product_id="prod-111", sku="A-111"),
        _line(location="brisbane", product_id="prod-222", sku="B-222"),
    ]
    result = aggregate_pick_list_lines(lines)

    locations = [r["location"] for r in result]
    skus = [r["sku"] for r in result]
    assert locations == ["brisbane", "brisbane", "sydney"]
    assert skus == ["A-111", "B-222", "Z-999"]


def test_pick_list_contributing_orders_record_quantity():
    """Each order's quantity is captured separately so the pack bench can split
    the wave pick into packing slips."""
    from src.api.routes.warehouse import aggregate_pick_list_lines

    lines = [
        _line(order_id="A", order_number="ORD-A", quantity=3),
        _line(order_id="B", order_number="ORD-B", quantity=5),
        _line(order_id="C", order_number="ORD-C", quantity=1),
    ]
    result = aggregate_pick_list_lines(lines)

    assert result[0]["total_quantity"] == 9
    contrib = {o["order_number"]: o["quantity"] for o in result[0]["contributing_orders"]}
    assert contrib == {"ORD-A": 3, "ORD-B": 5, "ORD-C": 1}


def test_pick_list_empty_input():
    """Empty input → empty list, not an error."""
    from src.api.routes.warehouse import aggregate_pick_list_lines

    assert aggregate_pick_list_lines([]) == []
