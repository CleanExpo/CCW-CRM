"""Pricing agent state definition for LangGraph."""

from typing import Any, TypedDict


class PricingState(TypedDict, total=False):
    """State for pricing agent operations.

    Flow:
    1. Parse pricing request
    2. Fetch cost data and historical pricing
    3. Analyze pricing trends
    4. Calculate optimal margin
    5. Generate price recommendation
    6. Validate recommendation
    7. Format final output

    Attributes:
        # Input
        request_type: Type of pricing request (analyze, recommend, compare)
        product_id: Product UUID to analyze/price
        target_margin: Desired profit margin percentage
        quantity: Quantity for volume pricing (optional)
        context: Additional context

        # Data gathering
        product_data: Product information (cost, current price, etc.)
        historical_data: Historical pricing analysis
        margin_analysis: Current margin calculations

        # Analysis
        pricing_trends: Identified pricing trends
        market_position: How price compares to historical averages
        risk_factors: Potential risks with pricing decision

        # Recommendation
        recommended_price: Calculated optimal price
        recommended_margin: Expected margin at recommended price
        price_justification: Reasoning for recommendation
        confidence_score: Confidence in recommendation (0-1)

        # Validation
        validation_passed: Whether recommendation meets business rules
        validation_warnings: List of warnings
        requires_review: Whether recommendation needs human review

        # Output
        final_recommendation: Structured final output
        status: Execution status
        error: Error message if failed

        # Metadata
        tools_used: List of tools executed
        metadata: Additional tracking data
    """

    # Input
    request_type: str
    product_id: str
    target_margin: float
    quantity: int | None
    context: dict[str, Any]

    # Data gathering
    product_data: dict[str, Any] | None
    historical_data: dict[str, Any] | None
    margin_analysis: dict[str, Any] | None

    # Analysis
    pricing_trends: list[str]
    market_position: str | None
    risk_factors: list[str]

    # Recommendation
    recommended_price: float | None
    recommended_margin: float | None
    price_justification: list[str]
    confidence_score: float

    # Validation
    validation_passed: bool
    validation_warnings: list[str]
    requires_review: bool

    # Output
    final_recommendation: dict[str, Any] | None
    status: str
    error: str | None

    # Metadata
    tools_used: list[str]
    metadata: dict[str, Any]
