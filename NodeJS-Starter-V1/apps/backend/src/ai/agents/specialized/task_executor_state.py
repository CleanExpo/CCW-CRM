"""Task executor agent state definition for LangGraph."""

from typing import Any, TypedDict


class TaskExecutorState(TypedDict, total=False):
    """State for task executor agent operations.

    Flow:
    1. Parse task to identify action
    2. Check if confirmation is required
    3. If required: generate confirmation token → wait for user approval
    4. If approved or not required: execute action
    5. Return result with success/failure status

    Attributes:
        # Input
        task: Task description from user/supervisor
        action_type: Identified action (create_order, delete_product, update_customer, etc.)
        action_params: Extracted parameters for the action
        context: Additional execution context

        # Confirmation flow
        requires_confirmation: Whether this action needs user approval
        confirmation_token: Generated token for user to approve
        confirmation_status: Status of confirmation (pending, approved, rejected, expired)
        user_provided_token: Token provided by user for verification

        # Action execution
        action_executed: Whether the action was successfully executed
        execution_result: Result from action execution
        affected_entities: List of entities modified (e.g., order IDs, product IDs)

        # Validation
        validation_errors: List of validation errors before execution
        dry_run_result: Result of validation without actual execution

        # Output
        final_result: Structured final output
        status: Execution status
        error: Error message if failed

        # Metadata
        metadata: Additional tracking data
        tools_used: List of tools executed
    """

    # Input
    task: str
    action_type: str | None
    action_params: dict[str, Any]
    context: dict[str, Any]

    # Confirmation flow
    requires_confirmation: bool
    confirmation_token: str | None
    confirmation_status: str | None
    user_provided_token: str | None

    # Action execution
    action_executed: bool
    execution_result: dict[str, Any] | None
    affected_entities: list[dict[str, Any]]

    # Validation
    validation_errors: list[str]
    dry_run_result: dict[str, Any] | None

    # Output
    final_result: dict[str, Any] | None
    status: str
    error: str | None

    # Metadata
    metadata: dict[str, Any]
    tools_used: list[str]
