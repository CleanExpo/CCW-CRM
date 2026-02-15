"""Agent orchestration components."""

from .agent_registry import (
    AgentHealthReport,
    AgentMetadata,
    AgentRegistry,
    AgentStatus,
    get_agent_registry,
)
from .supervisor_agent import SupervisorAgent, get_supervisor_agent
from .supervisor_state import SupervisorState

# Resolve forward reference: AgentMetadata.agent_card uses AgentCard which is
# only available under TYPE_CHECKING in agent_registry.py. Importing AgentCard
# here and calling model_rebuild() lets Pydantic resolve the annotation at
# runtime, fixing the "AgentMetadata is not fully defined" error.
from src.ai.protocol.models import AgentCard as _AgentCard  # noqa: F401

AgentMetadata.model_rebuild()

__all__ = [
    "AgentRegistry",
    "AgentMetadata",
    "AgentHealthReport",
    "AgentStatus",
    "get_agent_registry",
    "SupervisorAgent",
    "get_supervisor_agent",
    "SupervisorState",
]
