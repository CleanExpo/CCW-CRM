"""Base agent class for all AI agents."""

from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator
from uuid import UUID, uuid4

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_db

logger = structlog.get_logger(__name__)


class BaseAgent(ABC):
    """
    Abstract base class for all AI agents.

    Provides common functionality for database access, tool registration,
    and conversation management.
    """

    def __init__(self, agent_id: str | None = None, name: str | None = None):
        """
        Initialize the agent.

        Args:
            agent_id: Unique identifier for the agent
            name: Human-readable name for the agent
        """
        self.agent_id = agent_id or str(uuid4())
        self.name = name or self.__class__.__name__
        self.tools: list[Any] = []
        logger.info("Agent initialized", agent_id=self.agent_id, name=self.name)

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

    def __repr__(self) -> str:
        """String representation of the agent."""
        return f"{self.__class__.__name__}(agent_id={self.agent_id}, name={self.name})"
