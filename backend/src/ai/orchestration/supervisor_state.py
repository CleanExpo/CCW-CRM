"""Supervisor agent state definition for LangGraph."""

from typing import Any, TypedDict


class SupervisorState(TypedDict, total=False):
    """State for supervisor agent orchestration flow.

    Flow:
    1. Receive task → analyze_task
    2. Determine intent and required capabilities
    3. Query registry for candidate agents
    4. Select best agent based on health, capability, speed, load
    5. Execute selected agent with context
    6. Validate result
    7. Return final output

    Attributes:
        task: The task description from user/workflow
        context: Additional context for execution (user_id, workflow_id, etc.)
        user_id: Optional user ID for execution tracking
        workflow_id: Optional workflow ID if called from workflow

        # Analysis phase
        task_intent: Classified intent (e.g., "data_analysis", "content_generation")
        required_capabilities: List of capabilities needed (e.g., ["pricing", "cost_analysis"])
        task_complexity: Estimated complexity score (1-10)
        estimated_execution_time: Estimated time in seconds

        # Agent selection phase
        candidate_agents: List of agents that match required capabilities
                          Format: [(agent_id, health_score, est_time), ...]
        selected_agent_id: ID of agent selected for execution
        selection_reasoning: Why this agent was selected

        # Execution phase
        agent_result: Result from agent execution
        execution_time_ms: Actual execution time in milliseconds
        tokens_used: LLM tokens consumed (if applicable)

        # Validation phase
        validation_passed: Whether result passed validation checks
        validation_errors: List of validation error messages
        requires_user_confirmation: Whether result needs user approval

        # Output
        final_result: Final structured output
        status: Overall status (completed, failed, pending_confirmation)
        error: Error message if execution failed

        # Metadata
        metadata: Additional metadata for tracking
        tools_used: List of tools used during execution
        call_stack_depth: Current depth in agent-to-agent calls (prevent infinite loops)
    """

    # Input
    task: str
    context: dict[str, Any]
    user_id: str | None
    workflow_id: str | None

    # Analysis
    task_intent: str | None
    required_capabilities: list[str]
    task_complexity: int
    estimated_execution_time: int

    # Selection
    candidate_agents: list[tuple[str, float, int]]
    selected_agent_id: str | None
    selection_reasoning: str | None

    # Execution
    agent_result: dict[str, Any] | None
    execution_time_ms: int | None
    tokens_used: int | None

    # Validation
    validation_passed: bool
    validation_errors: list[str]
    requires_user_confirmation: bool

    # Output
    final_result: dict[str, Any] | None
    status: str
    error: str | None

    # Metadata
    metadata: dict[str, Any]
    tools_used: list[str]
    call_stack_depth: int
