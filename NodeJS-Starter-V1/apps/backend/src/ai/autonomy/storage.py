"""Storage backend for autonomy data."""

from datetime import datetime, timedelta
from typing import Any

import structlog

from .models import AgentAutonomyConfig, AgentDecision, DecisionFilter, DecisionStatus

logger = structlog.get_logger(__name__)


class AutonomyStorage:
    """In-memory storage for autonomy configurations and decisions.

    Note: This is an in-memory implementation. For production, replace with
    database-backed storage (PostgreSQL, Redis, etc.).
    """

    def __init__(self):
        """Initialize storage."""
        self._configs: dict[str, AgentAutonomyConfig] = {}
        self._decisions: dict[str, AgentDecision] = {}
        logger.info("Autonomy storage initialized (in-memory)")

    async def get_config(self, agent_id: str) -> AgentAutonomyConfig | None:
        """Get autonomy configuration for an agent.

        Args:
            agent_id: Agent identifier

        Returns:
            Configuration or None if not found
        """
        return self._configs.get(agent_id)

    async def save_config(self, config: AgentAutonomyConfig) -> None:
        """Save autonomy configuration.

        Args:
            config: Configuration to save
        """
        self._configs[config.agent_id] = config
        logger.debug("Saved autonomy config", agent_id=config.agent_id)

    async def get_decision(self, decision_id: str) -> AgentDecision | None:
        """Get a decision by ID.

        Args:
            decision_id: Decision identifier

        Returns:
            Decision or None if not found
        """
        return self._decisions.get(decision_id)

    async def save_decision(self, decision: AgentDecision) -> None:
        """Save a decision.

        Args:
            decision: Decision to save
        """
        self._decisions[decision.decision_id] = decision
        logger.debug("Saved decision", decision_id=decision.decision_id, agent_id=decision.agent_id)

    async def query_decisions(self, filter_obj: DecisionFilter) -> list[AgentDecision]:
        """Query decisions with filters.

        Args:
            filter_obj: Filter criteria

        Returns:
            List of matching decisions
        """
        decisions = list(self._decisions.values())

        # Apply filters
        if filter_obj.agent_ids:
            decisions = [d for d in decisions if d.agent_id in filter_obj.agent_ids]

        if filter_obj.statuses:
            decisions = [d for d in decisions if d.status in filter_obj.statuses]

        if filter_obj.risk_levels:
            decisions = [d for d in decisions if d.risk_level in filter_obj.risk_levels]

        if filter_obj.decision_types:
            decisions = [d for d in decisions if d.decision_type in filter_obj.decision_types]

        if filter_obj.min_confidence is not None:
            decisions = [d for d in decisions if d.confidence >= filter_obj.min_confidence]

        if filter_obj.max_confidence is not None:
            decisions = [d for d in decisions if d.confidence <= filter_obj.max_confidence]

        if filter_obj.created_after:
            decisions = [d for d in decisions if d.created_at >= filter_obj.created_after]

        if filter_obj.created_before:
            decisions = [d for d in decisions if d.created_at <= filter_obj.created_before]

        # Sort by created_at descending (newest first)
        decisions.sort(key=lambda d: d.created_at, reverse=True)

        # Apply pagination
        start = filter_obj.offset
        end = start + filter_obj.limit
        return decisions[start:end]

    async def count_auto_executed(
        self,
        agent_id: str,
        since: datetime
    ) -> int:
        """Count auto-executed decisions since a timestamp.

        Args:
            agent_id: Agent identifier
            since: Count decisions since this time

        Returns:
            Count of auto-executed decisions
        """
        count = 0
        for decision in self._decisions.values():
            if (
                decision.agent_id == agent_id
                and decision.status == DecisionStatus.AUTO_EXECUTED
                and decision.created_at >= since
            ):
                count += 1
        return count

    async def delete_old_decisions(self, agent_id: str, days: int) -> int:
        """Delete decisions older than specified days.

        Args:
            agent_id: Agent identifier
            days: Delete decisions older than this many days

        Returns:
            Number of decisions deleted
        """
        cutoff = datetime.now() - timedelta(days=days)
        deleted = 0

        # Create list of IDs to delete (can't modify dict while iterating)
        to_delete = [
            decision_id
            for decision_id, decision in self._decisions.items()
            if decision.agent_id == agent_id and decision.created_at < cutoff
        ]

        for decision_id in to_delete:
            del self._decisions[decision_id]
            deleted += 1

        logger.info(
            "Deleted old decisions",
            agent_id=agent_id,
            days=days,
            count=deleted
        )

        return deleted

    def clear_all(self) -> None:
        """Clear all data (for testing)."""
        self._configs.clear()
        self._decisions.clear()
        logger.warning("Cleared all autonomy data")
