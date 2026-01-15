"""Procurement agent state definition for LangGraph."""

from typing import Any, TypedDict


class ProcurementState(TypedDict, total=False):
    """State for procurement agent operations.

    Flow:
    1. Parse procurement request
    2. Analyze inventory levels
    3. Calculate reorder quantities
    4. Suggest suppliers
    5. Format procurement recommendations
    6. Validate and finalize

    Attributes:
        # Input
        request_type: Type of request (analyze_inventory, recommend_restock, suggest_suppliers)
        category: Product category filter
        product_id: Specific product ID (for reorder calculations)
        context: Additional context

        # Inventory analysis
        inventory_data: Full inventory analysis results
        low_stock_products: Products that need restocking
        out_of_stock_products: Products that are out of stock
        priority_items: High-priority restock items

        # Reorder calculations
        reorder_calculations: Calculated reorder quantities per product
        total_reorder_value: Total value of recommended orders

        # Supplier suggestions
        supplier_recommendations: Supplier suggestions per product

        # Analysis
        insights: Key insights from inventory analysis
        risk_factors: Identified risks (stockouts, overstocking, etc.)

        # Output
        procurement_plan: Structured procurement recommendations
        status: Execution status
        error: Error message if failed

        # Metadata
        tools_used: List of tools executed
        metadata: Additional tracking data
    """

    # Input
    request_type: str
    category: str | None
    product_id: str | None
    context: dict[str, Any]

    # Inventory analysis
    inventory_data: dict[str, Any] | None
    low_stock_products: list[dict[str, Any]]
    out_of_stock_products: list[dict[str, Any]]
    priority_items: list[dict[str, Any]]

    # Reorder calculations
    reorder_calculations: dict[str, Any]
    total_reorder_value: float

    # Supplier suggestions
    supplier_recommendations: dict[str, list[dict[str, Any]]]

    # Analysis
    insights: list[str]
    risk_factors: list[str]

    # Output
    procurement_plan: dict[str, Any] | None
    status: str
    error: str | None

    # Metadata
    tools_used: list[str]
    metadata: dict[str, Any]
