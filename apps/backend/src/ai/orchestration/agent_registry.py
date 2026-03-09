"""Agent Registry for managing and discovering AI agents."""

from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum
from typing import TYPE_CHECKING, Any
from uuid import uuid4

import structlog
from pydantic import BaseModel

if TYPE_CHECKING:
    from src.ai.protocol.models import AgentCard

logger = structlog.get_logger(__name__)


class AgentStatus(str, Enum):
    """Agent status enumeration."""

    ACTIVE = "active"  # Fully operational
    DEGRADED = "degraded"  # Operational but with issues
    OFFLINE = "offline"  # Not responding to health checks
    DISABLED = "disabled"  # Manually disabled


class AgentHealthReport(BaseModel):
    """Health check report for an agent."""

    agent_id: str
    status: AgentStatus
    response_time_ms: float = 0.0
    checks_passed: list[str] = []
    checks_failed: list[str] = []
    error: str | None = None
    last_checked: datetime


class AgentMetadata(BaseModel):
    """Metadata about a registered agent."""

    agent_id: str
    name: str
    agent_class: str
    capabilities: list[str]
    description: str
    requires_verification: bool = False
    estimated_execution_time: int = 60  # seconds
    tools: list[str] = []
    status: AgentStatus = AgentStatus.ACTIVE
    last_health_check: datetime | None = None
    health_score: float = 1.0  # 0.0 to 1.0
    active_executions: int = 0
    total_executions: int = 0
    failed_executions: int = 0
    # Protocol v1.0: Optional agent card for protocol governance
    agent_card: AgentCard | None = None


class AgentRegistry:
    """Central registry for AI agents."""

    _instance: AgentRegistry | None = None

    def __new__(cls):
        """Singleton pattern."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        """Initialize the agent registry."""
        if self._initialized:
            return

        self._agents: dict[str, Any] = {}  # agent_id -> agent instance
        self._metadata: dict[str, AgentMetadata] = {}  # agent_id -> metadata
        self._capability_index: dict[str, list[str]] = {}  # capability -> [agent_ids]
        self._health_checks: dict[str, AgentHealthReport] = {}  # agent_id -> health report
        self._accepting_requests = True
        self._consecutive_failures: dict[str, int] = {}  # agent_id -> failure count
        self._initialized = True

        logger.info("Agent registry initialized")

    def register_agent(
        self,
        agent: Any,
        capabilities: list[str],
        description: str = "",
        requires_verification: bool = False,
        estimated_execution_time: int = 60,
    ) -> None:
        """Register an agent with the registry.

        Args:
            agent: Agent instance
            capabilities: List of capabilities this agent provides
            description: Human-readable description
            requires_verification: Whether output needs validation
            estimated_execution_time: Expected execution time in seconds
        """
        agent_id = getattr(agent, "agent_id", str(uuid4()))
        name = getattr(agent, "name", agent.__class__.__name__)
        tools = getattr(agent, "tools", [])
        tool_names = [getattr(t, "name", "unknown") for t in tools]

        if agent_id in self._agents:
            logger.warning("Agent already registered", agent_id=agent_id)
            return

        # Create metadata
        metadata = AgentMetadata(
            agent_id=agent_id,
            name=name,
            agent_class=f"{agent.__class__.__module__}.{agent.__class__.__name__}",
            capabilities=capabilities,
            description=description or f"{name} agent",
            requires_verification=requires_verification,
            estimated_execution_time=estimated_execution_time,
            tools=tool_names,
            status=AgentStatus.ACTIVE,
            last_health_check=None,
            health_score=1.0,
        )

        # Store agent and metadata
        self._agents[agent_id] = agent
        self._metadata[agent_id] = metadata
        self._consecutive_failures[agent_id] = 0

        # Index by capabilities
        for capability in capabilities:
            if capability not in self._capability_index:
                self._capability_index[capability] = []
            self._capability_index[capability].append(agent_id)

        logger.info(
            "Agent registered",
            agent_id=agent_id,
            name=name,
            capabilities=capabilities,
            tools_count=len(tool_names),
        )

    def get_agent(self, agent_id: str) -> Any | None:
        """Get agent instance by ID.

        Args:
            agent_id: Agent identifier

        Returns:
            Agent instance or None
        """
        return self._agents.get(agent_id)

    def get_agent_by_name(self, name: str) -> Any | None:
        """Get agent instance by name.

        Args:
            name: Agent name

        Returns:
            Agent instance or None
        """
        for agent_id, metadata in self._metadata.items():
            if metadata.name.lower() == name.lower():
                return self._agents.get(agent_id)
        return None

    def get_metadata(self, agent_id: str) -> AgentMetadata | None:
        """Get agent metadata.

        Args:
            agent_id: Agent identifier

        Returns:
            Agent metadata or None
        """
        return self._metadata.get(agent_id)

    def get_agent_card(self, agent_id: str) -> AgentCard | None:
        """Get an agent's protocol card.

        Args:
            agent_id: Agent identifier

        Returns:
            AgentCard or None if not registered
        """
        metadata = self._metadata.get(agent_id)
        if metadata:
            return metadata.agent_card
        return None

    def register_agent_card(self, agent_id: str, card: AgentCard) -> bool:
        """Register a protocol agent card for an existing agent.

        Args:
            agent_id: Agent identifier
            card: The AgentCard to register

        Returns:
            True if registered successfully
        """
        if agent_id not in self._metadata:
            logger.warning("Cannot register card for unknown agent", agent_id=agent_id)
            return False

        self._metadata[agent_id].agent_card = card
        logger.info(
            "Agent card registered",
            agent_id=agent_id,
            permission_tier=card.permission_tier.value
            if hasattr(card, "permission_tier")
            else "unknown",
        )
        return True

    def find_agents_by_capability(self, capability: str) -> list[tuple[str, Any, AgentMetadata]]:
        """Find agents that provide a specific capability.

        Args:
            capability: Capability name

        Returns:
            List of (agent_id, agent_instance, metadata) tuples
        """
        agent_ids = self._capability_index.get(capability, [])
        results = []

        for agent_id in agent_ids:
            agent = self._agents.get(agent_id)
            metadata = self._metadata.get(agent_id)

            # Only include active or degraded agents
            if agent and metadata and metadata.status in [AgentStatus.ACTIVE, AgentStatus.DEGRADED]:
                results.append((agent_id, agent, metadata))

        # Sort by health score (descending)
        results.sort(key=lambda x: x[2].health_score, reverse=True)
        return results

    def get_all_agents(self) -> list[tuple[str, Any, AgentMetadata]]:
        """Get all registered agents.

        Returns:
            List of (agent_id, agent_instance, metadata) tuples
        """
        return [
            (agent_id, agent, self._metadata[agent_id])
            for agent_id, agent in self._agents.items()
        ]

    def get_all_metadata(self) -> list[AgentMetadata]:
        """Get metadata for all agents.

        Returns:
            List of agent metadata
        """
        return list(self._metadata.values())

    async def health_check_all(self) -> dict[str, AgentHealthReport]:
        """Run health checks on all agents.

        Returns:
            Dictionary of agent_id -> health report
        """
        results = {}

        for agent_id, agent in self._agents.items():
            try:
                # Call agent's health_check method if it exists
                if hasattr(agent, "health_check"):
                    report = await agent.health_check()
                else:
                    # Default health check
                    report = AgentHealthReport(
                        agent_id=agent_id,
                        status=AgentStatus.ACTIVE,
                        checks_passed=["default"],
                        last_checked=datetime.now(UTC),
                    )

                results[agent_id] = report
                self._health_checks[agent_id] = report

                # Update metadata status
                metadata = self._metadata[agent_id]
                metadata.status = report.status
                metadata.last_health_check = report.last_checked

                # Update health score based on status
                if report.status == AgentStatus.ACTIVE:
                    metadata.health_score = min(1.0, metadata.health_score + 0.1)
                    self._consecutive_failures[agent_id] = 0
                elif report.status == AgentStatus.DEGRADED:
                    metadata.health_score = max(0.5, metadata.health_score - 0.1)
                    self._consecutive_failures[agent_id] += 1
                else:  # OFFLINE
                    metadata.health_score = max(0.0, metadata.health_score - 0.2)
                    self._consecutive_failures[agent_id] += 1

                # Auto-disable after 3 consecutive failures
                if self._consecutive_failures[agent_id] >= 3:
                    metadata.status = AgentStatus.OFFLINE
                    logger.warning(
                        "Agent marked offline after consecutive failures",
                        agent_id=agent_id,
                        failures=self._consecutive_failures[agent_id],
                    )

            except Exception as e:
                logger.error("Health check failed", agent_id=agent_id, error=str(e))
                report = AgentHealthReport(
                    agent_id=agent_id,
                    status=AgentStatus.OFFLINE,
                    error=str(e),
                    last_checked=datetime.now(UTC),
                )
                results[agent_id] = report
                self._health_checks[agent_id] = report

                # Update metadata
                metadata = self._metadata[agent_id]
                metadata.status = AgentStatus.OFFLINE
                metadata.health_score = max(0.0, metadata.health_score - 0.2)
                self._consecutive_failures[agent_id] += 1

        logger.info("Health check complete", total_agents=len(results))
        return results

    def get_latest_health_report(self, agent_id: str) -> AgentHealthReport | None:
        """Get the latest health report for an agent.

        Args:
            agent_id: Agent identifier

        Returns:
            Health report or None
        """
        return self._health_checks.get(agent_id)

    def disable_agent(self, agent_id: str) -> bool:
        """Manually disable an agent.

        Args:
            agent_id: Agent identifier

        Returns:
            True if disabled successfully
        """
        if agent_id not in self._metadata:
            return False

        self._metadata[agent_id].status = AgentStatus.DISABLED
        logger.info("Agent disabled", agent_id=agent_id)
        return True

    def enable_agent(self, agent_id: str) -> bool:
        """Enable a disabled agent.

        Args:
            agent_id: Agent identifier

        Returns:
            True if enabled successfully
        """
        if agent_id not in self._metadata:
            return False

        self._metadata[agent_id].status = AgentStatus.ACTIVE
        self._consecutive_failures[agent_id] = 0
        logger.info("Agent enabled", agent_id=agent_id)
        return True

    def increment_active_executions(self, agent_id: str) -> None:
        """Increment active execution counter.

        Args:
            agent_id: Agent identifier
        """
        if agent_id in self._metadata:
            self._metadata[agent_id].active_executions += 1

    def decrement_active_executions(self, agent_id: str) -> None:
        """Decrement active execution counter.

        Args:
            agent_id: Agent identifier
        """
        if agent_id in self._metadata:
            self._metadata[agent_id].active_executions = max(
                0, self._metadata[agent_id].active_executions - 1
            )

    def record_execution(self, agent_id: str, success: bool) -> None:
        """Record an agent execution.

        Args:
            agent_id: Agent identifier
            success: Whether execution succeeded
        """
        if agent_id not in self._metadata:
            return

        metadata = self._metadata[agent_id]
        metadata.total_executions += 1

        if not success:
            metadata.failed_executions += 1

        # Update health score based on success rate
        success_rate = (metadata.total_executions - metadata.failed_executions) / metadata.total_executions  # noqa: E501
        metadata.health_score = success_rate

    def set_accepting_requests(self, accepting: bool) -> None:
        """Set whether registry is accepting new requests.

        Args:
            accepting: Whether to accept requests
        """
        self._accepting_requests = accepting
        logger.info("Registry accepting requests", accepting=accepting)

    def is_accepting_requests(self) -> bool:
        """Check if registry is accepting requests.

        Returns:
            True if accepting requests
        """
        return self._accepting_requests

    @property
    def agents(self) -> dict[str, Any]:
        """Get all registered agents.

        Returns:
            Dictionary of agent_id -> agent instance
        """
        return self._agents

    def get_statistics(self) -> dict[str, Any]:
        """Get registry statistics.

        Returns:
            Dictionary with statistics
        """
        total_agents = len(self._agents)
        active_count = sum(1 for m in self._metadata.values() if m.status == AgentStatus.ACTIVE)
        degraded_count = sum(1 for m in self._metadata.values() if m.status == AgentStatus.DEGRADED)
        offline_count = sum(1 for m in self._metadata.values() if m.status == AgentStatus.OFFLINE)
        disabled_count = sum(1 for m in self._metadata.values() if m.status == AgentStatus.DISABLED)

        total_executions = sum(m.total_executions for m in self._metadata.values())
        total_failures = sum(m.failed_executions for m in self._metadata.values())
        success_rate = (
            (total_executions - total_failures) / total_executions if total_executions > 0 else 1.0
        )

        return {
            "total_agents": total_agents,
            "active_agents": active_count,
            "degraded_agents": degraded_count,
            "offline_agents": offline_count,
            "disabled_agents": disabled_count,
            "total_executions": total_executions,
            "total_failures": total_failures,
            "success_rate": success_rate,
            "capabilities": list(self._capability_index.keys()),
        }


# Global instance
_registry: AgentRegistry | None = None


def get_agent_registry() -> AgentRegistry:
    """Get the global agent registry instance.

    Returns:
        Agent registry singleton
    """
    global _registry
    if _registry is None:
        _registry = AgentRegistry()
    return _registry
