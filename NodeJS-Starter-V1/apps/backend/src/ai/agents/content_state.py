"""Content generation agent state definition for LangGraph."""

from typing import Any, TypedDict


class ContentState(TypedDict):
    """State for the content generation agent.

    This state tracks the flow of content generation from requirements to final output.
    """

    # Input parameters
    content_type: str  # quote, email, summary, report
    requirements: str  # Natural language requirements
    context: dict[str, Any]  # Additional context (customer_id, order_id, etc.)
    user_id: str | None

    # Parsing
    parsed_requirements: dict[str, Any] | None  # Structured requirements
    entities_found: list[dict[str, Any]]  # Found products, customers, etc.

    # Data gathering
    relevant_data: dict[str, Any] | None  # Retrieved data from database
    calculations: dict[str, Any] | None  # Pricing, totals, etc.

    # Generation
    draft_content: str | None  # Initial generated content
    structured_output: dict[str, Any] | None  # Structured data (for quotes)
    formatted_content: str | None  # Final formatted content

    # Validation
    validation_errors: list[str]  # Any validation issues
    requires_review: bool  # Whether content needs human review

    # Output
    final_output: dict[str, Any] | None  # Final content ready for use
    metadata: dict[str, Any]  # Generation metadata
    tools_used: list[str]  # Tools that were invoked
    error: str | None
