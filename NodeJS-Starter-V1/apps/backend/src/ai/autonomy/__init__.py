"""Agent autonomy management system."""

from .learning import LearningEngine, get_learning_engine
from .manager import AutonomyManager
from .models import (
    AgentAutonomyConfig,
    AgentDecision,
    AutonomyLevel,
    AutonomyStats,
    DecisionFilter,
    DecisionStatus,
    RiskLevel,
)
from .storage import AutonomyStorage

# Global autonomy manager instance
_autonomy_manager: AutonomyManager | None = None


def get_autonomy_manager() -> AutonomyManager:
    """Get the global autonomy manager instance.

    Returns:
        Autonomy manager singleton
    """
    global _autonomy_manager
    if _autonomy_manager is None:
        _autonomy_manager = AutonomyManager()
    return _autonomy_manager


__all__ = [
    "AutonomyManager",
    "AutonomyStorage",
    "LearningEngine",
    "AgentAutonomyConfig",
    "AgentDecision",
    "AutonomyLevel",
    "AutonomyStats",
    "DecisionFilter",
    "DecisionStatus",
    "RiskLevel",
    "get_autonomy_manager",
    "get_learning_engine",
]
