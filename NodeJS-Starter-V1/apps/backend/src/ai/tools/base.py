"""Base tool class for LangChain compatibility."""

from abc import ABC, abstractmethod
from typing import Any

import structlog
from langchain_core.tools import BaseTool as LangChainBaseTool
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.config.database import get_async_db

logger = structlog.get_logger(__name__)


class ToolInput(BaseModel):
    """Base input schema for tools."""

    pass


class ToolOutput(BaseModel):
    """Base output schema for tools."""

    success: bool = Field(description="Whether the tool execution was successful")
    data: Any = Field(default=None, description="Tool execution result data")
    error: str | None = Field(default=None, description="Error message if failed")


class BaseTool(ABC):
    """
    Abstract base class for all tools.

    Tools are used by agents to perform specific actions like searching data,
    making calculations, or interacting with external systems.
    """

    def __init__(self, name: str, description: str):
        """
        Initialize the tool.

        Args:
            name: Tool name (should be unique)
            description: Tool description for LLM understanding
        """
        self.name = name
        self.description = description
        logger.debug("Tool initialized", name=name)

    @abstractmethod
    async def execute(self, **kwargs: Any) -> ToolOutput:
        """
        Execute the tool with given inputs.

        Args:
            **kwargs: Tool-specific input parameters

        Returns:
            Tool execution output
        """
        pass

    async def run(self, **kwargs: Any) -> dict[str, Any]:
        """
        Run the tool and return result as dictionary.

        This method wraps execute() for LangChain compatibility.

        Args:
            **kwargs: Tool-specific input parameters

        Returns:
            Result dictionary
        """
        try:
            result = await self.execute(**kwargs)
            return result.model_dump()
        except Exception as e:
            logger.error("Tool execution failed", tool=self.name, error=str(e))
            return ToolOutput(
                success=False,
                error=str(e),
            ).model_dump()

    def validate_input(self, **kwargs: Any) -> bool:
        """
        Validate tool inputs.

        Args:
            **kwargs: Input parameters to validate

        Returns:
            True if valid, False otherwise
        """
        # Override in subclasses for custom validation
        return True

    def __repr__(self) -> str:
        """String representation of the tool."""
        return f"{self.__class__.__name__}(name={self.name})"


class BaseDatabaseTool(LangChainBaseTool):
    """Base tool class with database access for analytics tools."""

    name: str = ""
    description: str = ""

    async def _execute(self, db: AsyncSession, **kwargs: Any) -> dict[str, Any]:
        """Execute the tool with database access.

        Args:
            db: Database session
            **kwargs: Tool-specific parameters

        Returns:
            Tool result as dictionary
        """
        raise NotImplementedError("Subclasses must implement _execute")

    async def _run(self, **kwargs: Any) -> dict[str, Any]:
        """Run the tool (LangChain compatibility).

        Args:
            **kwargs: Tool parameters

        Returns:
            Tool result
        """
        async for db in get_async_db():
            try:
                result = await self._execute(db, **kwargs)
                return result
            except Exception as e:
                logger.error(f"Tool execution failed", tool=self.name, error=str(e))
                return {"error": str(e)}
            finally:
                await db.close()

        return {"error": "Database session not available"}
