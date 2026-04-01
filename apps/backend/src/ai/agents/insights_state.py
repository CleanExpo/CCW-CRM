"""Insights agent state definition for LangGraph."""

from typing import Any, TypedDict


class InsightsState(TypedDict):
    """State for the insights agent.

    This state tracks the flow of data analysis and insight generation.
    """

    # Input parameters
    category: str  # sales, inventory, customers, orders
    date_range: dict[str, str] | None  # start_date, end_date
    filters: dict[str, Any]  # Additional filters
    user_id: str | None

    # Data fetching
    raw_data: dict[str, Any] | None  # Raw data from database
    aggregated_data: dict[str, Any] | None  # Processed aggregations

    # Analysis
    analysis_context: str | None  # Formatted context for LLM
    trends: list[dict[str, Any]]  # Identified trends
    anomalies: list[dict[str, Any]]  # Detected anomalies

    # Insight generation
    insights: list[dict[str, Any]]  # Generated insights with recommendations
    priority_insights: list[dict[str, Any]]  # Top priority insights

    # Output
    formatted_response: dict[str, Any] | None  # Final formatted output
    tools_used: list[str]  # Tools that were invoked
    error: str | None

    # Metadata
    metadata: dict[str, Any]  # Execution metadata
