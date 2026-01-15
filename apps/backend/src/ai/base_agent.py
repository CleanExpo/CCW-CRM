"""Base agent class for all AI agents."""

import time
from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db

if TYPE_CHECKING:
    from src.ai.orchestration.agent_registry import AgentHealthReport

logger = structlog.get_logger(__name__)


class BaseAgent(ABC):
    """
    Abstract base class for all AI agents.

    Provides common functionality for database access, tool registration,
    and conversation management.
    """

    def __init__(
        self,
        agent_id: str | None = None,
        name: str | None = None,
        auto_register: bool = True
    ):
        """
        Initialize the agent.

        Args:
            agent_id: Unique identifier for the agent
            name: Human-readable name for the agent
            auto_register: Whether to automatically register with agent registry
        """
        self.agent_id = agent_id or str(uuid4())
        self.name = name or self.__class__.__name__
        self.tools: list[Any] = []
        self.capabilities: list[str] = []  # Override in subclasses
        logger.info("Agent initialized", agent_id=self.agent_id, name=self.name)

        # Auto-register with registry (after subclass initialization)
        if auto_register:
            self._schedule_registration()

    @abstractmethod
    async def execute(self, task: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        """
        Execute a task.

        Args:
            task: Task description or user input
            context: Additional context for execution

        Returns:
            Execution result dictionary
        """
        pass

    @abstractmethod
    async def stream(
        self, task: str, context: dict[str, Any] | None = None
    ) -> AsyncGenerator[str, None]:
        """
        Stream execution results.

        Args:
            task: Task description or user input
            context: Additional context for execution

        Yields:
            Response chunks
        """
        pass

    async def get_db_session(self) -> AsyncSession:
        """
        Get database session for data access.

        Returns:
            Async database session

        Usage:
            async with agent.get_db_session() as db:
                result = await db.execute(query)
        """
        async for session in get_db():
            return session

    def register_tool(self, tool: Any) -> None:
        """
        Register a tool for the agent to use.

        Args:
            tool: Tool instance to register
        """
        self.tools.append(tool)
        logger.debug(
            "Tool registered",
            agent_id=self.agent_id,
            tool_name=getattr(tool, "name", "unknown"),
        )

    def get_tools(self) -> list[Any]:
        """
        Get all registered tools.

        Returns:
            List of tool instances
        """
        return self.tools

    async def get_context(self, user_id: UUID | None = None) -> dict[str, Any]:
        """
        Get execution context for the agent.

        Args:
            user_id: User ID for context

        Returns:
            Context dictionary
        """
        return {
            "agent_id": self.agent_id,
            "agent_name": self.name,
            "user_id": str(user_id) if user_id else None,
            "tools_available": [getattr(t, "name", "unknown") for t in self.tools],
        }

    def _log_execution_start(self, task: str, context: dict[str, Any] | None = None) -> None:
        """Log execution start."""
        logger.info(
            "Agent execution started",
            agent_id=self.agent_id,
            agent_name=self.name,
            task_length=len(task),
            has_context=context is not None,
        )

    def _log_execution_complete(self, success: bool, error: str | None = None) -> None:
        """Log execution completion."""
        if success:
            logger.info(
                "Agent execution completed",
                agent_id=self.agent_id,
                agent_name=self.name,
            )
        else:
            logger.error(
                "Agent execution failed",
                agent_id=self.agent_id,
                agent_name=self.name,
                error=error,
            )

    async def validate_input(self, task: str, context: dict[str, Any] | None = None) -> bool:
        """
        Validate input before execution.

        Args:
            task: Task to validate
            context: Context to validate

        Returns:
            True if valid, False otherwise
        """
        if not task or not task.strip():
            logger.warning("Empty task provided", agent_id=self.agent_id)
            return False
        return True

    def _schedule_registration(self) -> None:
        """Schedule registration with agent registry.

        Note: This is called during __init__. Actual registration happens
        after subclass initialization is complete.
        """
        try:
            # Lazy import to avoid circular dependencies
            from src.ai.orchestration import get_agent_registry

            # Get capabilities from subclass (if defined)
            capabilities = getattr(self, 'capabilities', [])
            description = getattr(self, 'description', f"{self.name} agent")
            requires_verification = getattr(self, 'requires_verification', False)
            estimated_execution_time = getattr(self, 'estimated_execution_time', 60)

            # Register with registry
            registry = get_agent_registry()
            registry.register_agent(
                agent=self,
                capabilities=capabilities,
                description=description,
                requires_verification=requires_verification,
                estimated_execution_time=estimated_execution_time
            )

            logger.debug(
                "Agent registered with registry",
                agent_id=self.agent_id,
                capabilities=capabilities
            )
        except Exception as e:
            # Don't fail agent initialization if registry unavailable
            logger.warning(
                "Failed to register agent with registry",
                agent_id=self.agent_id,
                error=str(e)
            )

    async def health_check(self) -> "AgentHealthReport":
        """Check agent health status.

        Default implementation checks basic functionality. Override in
        subclasses for custom health checks.

        Returns:
            Health report with status and diagnostic information
        """
        from src.ai.orchestration import AgentHealthReport, AgentStatus

        try:
            start_time = time.time()
            checks_passed = []
            checks_failed = []

            # Check 1: Tools accessible
            try:
                tools_count = len(self.tools)
                checks_passed.append(f"tools_accessible ({tools_count} tools)")
            except Exception as e:
                checks_failed.append(f"tools_check: {str(e)}")

            # Check 2: Agent can access database (if needed)
            try:
                db = await self.get_db_session()
                if db:
                    checks_passed.append("database_accessible")
                else:
                    checks_failed.append("database_check: session is None")
            except Exception as e:
                checks_failed.append(f"database_check: {str(e)}")

            # Calculate response time
            response_time_ms = (time.time() - start_time) * 1000

            # Determine status
            if len(checks_failed) == 0:
                status = AgentStatus.ACTIVE
            elif len(checks_passed) > len(checks_failed):
                status = AgentStatus.DEGRADED
            else:
                status = AgentStatus.OFFLINE

            return AgentHealthReport(
                agent_id=self.agent_id,
                status=status,
                response_time_ms=response_time_ms,
                checks_passed=checks_passed,
                checks_failed=checks_failed,
                last_checked=datetime.now(UTC)
            )

        except Exception as e:
            return AgentHealthReport(
                agent_id=self.agent_id,
                status=AgentStatus.OFFLINE,
                error=str(e),
                last_checked=datetime.now(UTC)
            )

    async def execute_with_metrics(
        self,
        task: str,
        context: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Execute task with metrics tracking.

        Wraps the execute() method to track execution time and record metrics.

        Args:
            task: Task description or user input
            context: Additional context for execution

        Returns:
            Execution result with metrics
        """
        from src.ai.orchestration import get_agent_registry

        registry = get_agent_registry()
        start_time = time.time()

        # Increment active executions
        registry.increment_active_executions(self.agent_id)

        try:
            self._log_execution_start(task, context)
            result = await self.execute(task, context)

            # Calculate execution time
            execution_time_ms = int((time.time() - start_time) * 1000)

            # Determine success
            success = not result.get("error")

            # Record execution
            registry.record_execution(self.agent_id, success)

            # Add metrics to result
            result["execution_time_ms"] = execution_time_ms
            result["agent_id"] = self.agent_id

            self._log_execution_complete(success, result.get("error"))

            return result

        except Exception as e:
            execution_time_ms = int((time.time() - start_time) * 1000)
            registry.record_execution(self.agent_id, False)
            self._log_execution_complete(False, str(e))

            return {
                "error": str(e),
                "execution_time_ms": execution_time_ms,
                "agent_id": self.agent_id
            }
        finally:
            # Decrement active executions
            registry.decrement_active_executions(self.agent_id)

    def __repr__(self) -> str:
        """String representation of the agent."""
        return f"{self.__class__.__name__}(agent_id={self.agent_id}, name={self.name})"
