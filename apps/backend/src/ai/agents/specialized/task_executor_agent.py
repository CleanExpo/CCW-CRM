"""Task executor agent with user confirmation flow for write operations."""

import secrets
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from typing import Any

from langgraph.graph import END, StateGraph

from src.ai.base_agent import BaseAgent
from src.ai.tools.execution_tools import ExecuteActionTool, ValidateActionTool
from src.utils import get_logger

from .task_executor_state import TaskExecutorState

logger = get_logger(__name__)


class TaskExecutorAgent(BaseAgent):
    """Agent for executing tasks with user confirmation.

    All write operations (create, update, delete) require user confirmation
    via a token-based flow:
    1. User requests action
    2. Agent validates and generates confirmation token
    3. User provides token to approve
    4. Agent verifies token and executes action

    Capabilities:
    - Task execution with confirmation
    - Action validation (dry run)
    - Token-based approval system
    """

    def __init__(self):
        super().__init__(
            agent_id="task_executor",
            name="Task Executor",
            auto_register=False,
        )

        # Set capabilities for agent registry
        self.capabilities = [
            "task_execution",
            "action_execution",
            "user_confirmation",
            "write_operations",
        ]
        self.description = "Executes tasks with mandatory user confirmation for safety"
        self.estimated_execution_time = 10  # seconds
        self.requires_verification = True  # Always requires user confirmation

        # Register tools
        self.register_tool(ValidateActionTool())
        self.register_tool(ExecuteActionTool())

        # Confirmation token storage (in-memory for MVP)
        # Format: {token: {action_type, action_params, expires_at}}
        self._pending_confirmations: dict[str, dict] = {}

        # Build LangGraph state graph
        self.graph = self._build_graph()

        logger.info("Task executor agent initialized")

        # Register with agent registry after full initialization
        self._schedule_registration()

    def _build_graph(self) -> StateGraph:
        """Build LangGraph state graph for task execution with confirmation."""
        workflow = StateGraph(TaskExecutorState)

        # Add nodes
        workflow.add_node("parse_task", self._parse_task)
        workflow.add_node("validate_action", self._validate_action)
        workflow.add_node("check_confirmation", self._check_confirmation)
        workflow.add_node("generate_token", self._generate_token)
        workflow.add_node("verify_token", self._verify_token)
        workflow.add_node("execute_action", self._execute_action)
        workflow.add_node("finalize", self._finalize)

        # Set entry point
        workflow.set_entry_point("parse_task")

        # Add edges
        workflow.add_edge("parse_task", "validate_action")

        # After validation, check if confirmation is needed
        workflow.add_conditional_edges(
            "validate_action",
            self._needs_confirmation,
            {
                "needs_confirmation": "check_confirmation",
                "validation_failed": "finalize",
            },
        )

        # Check if confirmation already provided
        workflow.add_conditional_edges(
            "check_confirmation",
            self._has_confirmation,
            {
                "has_token": "verify_token",
                "needs_token": "generate_token",
            },
        )

        # After token generation, go to finalize (user needs to provide token)
        workflow.add_edge("generate_token", "finalize")

        # After token verification, execute or finalize
        workflow.add_conditional_edges(
            "verify_token",
            self._token_valid,
            {
                "valid": "execute_action",
                "invalid": "finalize",
            },
        )

        workflow.add_edge("execute_action", "finalize")
        workflow.add_edge("finalize", END)

        return workflow.compile()

    async def _parse_task(self, state: TaskExecutorState) -> TaskExecutorState:
        """Parse task to identify action type and parameters."""
        task = state["task"]
        context = state.get("context", {})

        logger.info("Parsing task", task_preview=task[:100])

        # Extract action type and parameters from context or task
        # In a real system, this would use NLP to parse the task string
        action_type = context.get("action_type")
        action_params = context.get("action_params", {})

        if not action_type:
            # Simple keyword detection (fallback)
            task_lower = task.lower()
            if "create order" in task_lower:
                action_type = "create_order"
            elif "update product" in task_lower:
                action_type = "update_product"
            elif "delete order" in task_lower:
                action_type = "delete_order"
            elif "update customer" in task_lower:
                action_type = "update_customer"
            else:
                action_type = "unknown"

        state["action_type"] = action_type
        state["action_params"] = action_params
        state["requires_confirmation"] = True  # All actions require confirmation
        state.setdefault("validation_errors", [])
        state.setdefault("affected_entities", [])
        state.setdefault("tools_used", [])
        state.setdefault("metadata", {})

        # Check if user provided a confirmation token
        state["user_provided_token"] = context.get("confirmation_token")

        logger.info("Task parsed", action_type=action_type)

        return state

    async def _validate_action(self, state: TaskExecutorState) -> TaskExecutorState:
        """Validate the action before requesting confirmation."""
        action_type = state.get("action_type")
        action_params = state.get("action_params", {})

        logger.info("Validating action", action_type=action_type)

        try:
            async with self.get_db_session() as db:
                validate_tool: ValidateActionTool = next(
                    t for t in self.tools if isinstance(t, ValidateActionTool)
                )

                validation_result = await validate_tool.execute(
                    action_type=action_type,
                    action_params=action_params,
                    db=db,
                )

                if validation_result.success:
                    validation_data = validation_result.data
                    state["validation_errors"] = validation_data.get("errors", [])
                    state["tools_used"].append("validate_action")

                    # Store dry run result
                    state["dry_run_result"] = {
                        "validation_passed": validation_data.get("validation_passed", False),
                        "warnings": validation_data.get("warnings", []),
                    }

                    logger.info(
                        "Validation complete",
                        passed=validation_data.get("validation_passed"),
                        errors_count=len(state["validation_errors"]),
                    )
                else:
                    state["validation_errors"].append(
                        f"Validation failed: {validation_result.error}"
                    )
                    state["error"] = validation_result.error

        except Exception as e:
            logger.error("Validation failed", error=str(e))
            state["validation_errors"].append(f"Validation error: {str(e)}")
            state["error"] = str(e)

        return state

    def _needs_confirmation(self, state: TaskExecutorState) -> str:
        """Determine if confirmation is needed or validation failed."""
        validation_errors = state.get("validation_errors", [])

        if validation_errors:
            return "validation_failed"
        else:
            return "needs_confirmation"

    async def _check_confirmation(self, state: TaskExecutorState) -> TaskExecutorState:
        """Check if user has provided a confirmation token."""
        user_token = state.get("user_provided_token")
        state["confirmation_status"] = "approved" if user_token else "pending"
        return state

    def _has_confirmation(self, state: TaskExecutorState) -> str:
        """Check if confirmation token was provided."""
        return "has_token" if state.get("user_provided_token") else "needs_token"

    async def _generate_token(self, state: TaskExecutorState) -> TaskExecutorState:
        """Generate a confirmation token for the user."""
        # Generate secure random token
        token = f"conf-{secrets.token_urlsafe(8)}"

        # Store token with action details (expires in 10 minutes)
        expires_at = datetime.now(UTC) + timedelta(minutes=10)
        self._pending_confirmations[token] = {
            "action_type": state.get("action_type"),
            "action_params": state.get("action_params"),
            "expires_at": expires_at,
            "created_at": datetime.now(UTC),
        }

        state["confirmation_token"] = token
        state["confirmation_status"] = "pending"

        logger.info("Confirmation token generated", token=token[:15] + "...")

        return state

    async def _verify_token(self, state: TaskExecutorState) -> TaskExecutorState:
        """Verify the user-provided confirmation token."""
        user_token = state.get("user_provided_token")

        if not user_token:
            state["confirmation_status"] = "rejected"
            state["error"] = "No confirmation token provided"
            return state

        # Check if token exists and hasn't expired
        pending = self._pending_confirmations.get(user_token)

        if not pending:
            state["confirmation_status"] = "rejected"
            state["error"] = f"Invalid confirmation token: {user_token}"
            logger.warning("Invalid token provided", token=user_token[:15] + "...")
            return state

        # Check expiration
        if datetime.now(UTC) > pending["expires_at"]:
            state["confirmation_status"] = "expired"
            state["error"] = "Confirmation token has expired"
            del self._pending_confirmations[user_token]
            logger.warning("Expired token provided", token=user_token[:15] + "...")
            return state

        # Token is valid - mark as approved and remove from pending
        state["confirmation_status"] = "approved"
        del self._pending_confirmations[user_token]

        logger.info("Confirmation token verified", token=user_token[:15] + "...")

        return state

    def _token_valid(self, state: TaskExecutorState) -> str:
        """Check if token verification was successful."""
        return "valid" if state.get("confirmation_status") == "approved" else "invalid"

    async def _execute_action(self, state: TaskExecutorState) -> TaskExecutorState:
        """Execute the confirmed action."""
        action_type = state.get("action_type")
        action_params = state.get("action_params", {})

        logger.info("Executing action", action_type=action_type)

        try:
            async with self.get_db_session() as db:
                execute_tool: ExecuteActionTool = next(
                    t for t in self.tools if isinstance(t, ExecuteActionTool)
                )

                execution_result = await execute_tool.execute(
                    action_type=action_type,
                    action_params=action_params,
                    confirmation_verified=True,
                    db=db,
                )

                if execution_result.success:
                    state["action_executed"] = True
                    state["execution_result"] = execution_result.data
                    state["tools_used"].append("execute_action")

                    # Extract affected entities
                    if "product_id" in execution_result.data:
                        state["affected_entities"].append({
                            "type": "product",
                            "id": execution_result.data["product_id"],
                        })
                    elif "customer_id" in execution_result.data:
                        state["affected_entities"].append({
                            "type": "customer",
                            "id": execution_result.data["customer_id"],
                        })

                    logger.info("Action executed successfully", action_type=action_type)
                else:
                    state["action_executed"] = False
                    state["error"] = execution_result.error
                    logger.error("Action execution failed", error=execution_result.error)

        except Exception as e:
            logger.error("Action execution failed", error=str(e))
            state["action_executed"] = False
            state["error"] = str(e)

        return state

    async def _finalize(self, state: TaskExecutorState) -> TaskExecutorState:
        """Finalize task execution and format output."""
        validation_errors = state.get("validation_errors", [])
        confirmation_status = state.get("confirmation_status")
        action_executed = state.get("action_executed", False)
        error = state.get("error")

        # Determine status
        if confirmation_status in ["rejected", "expired"]:
            status = "confirmation_failed"
        elif confirmation_status == "pending":
            status = "pending_confirmation"
        elif error or validation_errors:
            status = "failed"
        elif action_executed:
            status = "completed"
        else:
            status = "failed"

        state["status"] = status

        # Build final result
        if status == "pending_confirmation":
            # User needs to provide confirmation token
            state["final_result"] = {
                "status": status,
                "message": "Action validated and requires confirmation",
                "action_type": state.get("action_type"),
                "action_summary": self._format_action_summary(state),
                "confirmation_token": state.get("confirmation_token"),
                "confirmation_instructions": (
                    "To execute this action, provide the confirmation token in your next request: "
                    f"confirmation_token='{state.get('confirmation_token')}'"
                ),
                "dry_run_result": state.get("dry_run_result"),
                "tools_used": state.get("tools_used", []),
            }
        elif status == "completed":
            # Action executed successfully
            state["final_result"] = {
                "status": status,
                "message": "Action executed successfully",
                "action_type": state.get("action_type"),
                "execution_result": state.get("execution_result"),
                "affected_entities": state.get("affected_entities", []),
                "tools_used": state.get("tools_used", []),
            }
        else:
            # Failed or rejected
            state["final_result"] = {
                "status": status,
                "message": error or "Action failed",
                "action_type": state.get("action_type"),
                "validation_errors": validation_errors,
                "confirmation_status": confirmation_status,
            }

        logger.info("Task execution finalized", status=status)

        return state

    def _format_action_summary(self, state: TaskExecutorState) -> str:
        """Format a human-readable summary of the action."""
        action_type = state.get("action_type", "unknown")
        action_params = state.get("action_params", {})

        if action_type == "create_order":
            items_count = len(action_params.get("items", []))
            return f"Create order with {items_count} items for customer {action_params.get('customer_id', 'unknown')}"  # noqa: E501
        elif action_type == "update_product":
            product_id = action_params.get("product_id", "unknown")
            fields = list(action_params.get("updates", {}).keys())
            return f"Update product {product_id}: {', '.join(fields)}"
        elif action_type == "delete_order":
            return f"Delete order {action_params.get('order_id', 'unknown')}"
        elif action_type == "update_customer":
            customer_id = action_params.get("customer_id", "unknown")
            fields = list(action_params.get("updates", {}).keys())
            return f"Update customer {customer_id}: {', '.join(fields)}"
        else:
            return f"Execute {action_type}"

    async def execute(self, task: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        """Execute task with confirmation flow.

        Args:
            task: Task description
            context: Context with action_type, action_params, confirmation_token, etc.

        Returns:
            dict with execution result or confirmation request
        """
        context = context or {}

        # Build initial state
        initial_state: TaskExecutorState = {
            "task": task,
            "action_type": None,
            "action_params": {},
            "context": context,
            # Confirmation
            "requires_confirmation": True,
            "confirmation_token": None,
            "confirmation_status": None,
            "user_provided_token": None,
            # Execution
            "action_executed": False,
            "execution_result": None,
            "affected_entities": [],
            # Validation
            "validation_errors": [],
            "dry_run_result": None,
            # Output
            "final_result": None,
            "status": "pending",
            "error": None,
            # Metadata
            "metadata": {},
            "tools_used": [],
        }

        try:
            # Execute graph
            final_state = await self.graph.ainvoke(initial_state)

            return final_state.get("final_result", {})

        except Exception as e:
            logger.error("Task executor execution failed", error=str(e))
            return {
                "status": "failed",
                "error": f"Task execution failed: {str(e)}",
            }

    async def stream(
        self, task: str, context: dict[str, Any] | None = None
    ) -> AsyncGenerator[str, None]:
        """Stream task execution (not implemented - task executor is batch-based)."""
        yield "Validating action...\n"
        result = await self.execute(task, context)

        status = result.get("status")
        if status == "pending_confirmation":
            yield "⚠ Action requires confirmation\n"
            yield f"Token: {result.get('confirmation_token')}\n"
        elif status == "completed":
            yield "✓ Action executed successfully\n"
        else:
            yield f"Error: {result.get('message')}\n"


# Singleton instance
_task_executor_agent: TaskExecutorAgent | None = None


def get_task_executor_agent() -> TaskExecutorAgent:
    """Get or create task executor agent singleton."""
    global _task_executor_agent
    if _task_executor_agent is None:
        _task_executor_agent = TaskExecutorAgent()
    return _task_executor_agent
