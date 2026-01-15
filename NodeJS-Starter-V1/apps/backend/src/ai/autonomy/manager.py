"""Agent autonomy manager for decision execution control."""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import structlog

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

logger = structlog.get_logger(__name__)


class AutonomyManager:
    """Manages agent autonomy levels and decision execution.

    This class handles:
    - Decision approval logic based on autonomy level
    - Confidence threshold checks
    - Rate limiting
    - Decision storage and retrieval
    - Learning feedback processing
    """

    def __init__(self, storage: AutonomyStorage | None = None):
        """Initialize autonomy manager.

        Args:
            storage: Storage backend for autonomy data (defaults to in-memory)
        """
        self.storage = storage or AutonomyStorage()
        logger.info("Autonomy manager initialized")

    async def get_config(self, agent_id: str) -> AgentAutonomyConfig:
        """Get autonomy configuration for an agent.

        Args:
            agent_id: Agent identifier

        Returns:
            Autonomy configuration (creates default if not exists)
        """
        config = await self.storage.get_config(agent_id)
        if not config:
            # Create default configuration
            config = AgentAutonomyConfig(agent_id=agent_id)
            await self.storage.save_config(config)
            logger.info("Created default autonomy config", agent_id=agent_id)
        return config

    async def update_config(
        self,
        agent_id: str,
        updates: dict[str, Any],
        updated_by: UUID | None = None
    ) -> AgentAutonomyConfig:
        """Update autonomy configuration for an agent.

        Args:
            agent_id: Agent identifier
            updates: Configuration fields to update
            updated_by: User ID making the update

        Returns:
            Updated configuration
        """
        config = await self.get_config(agent_id)

        # Update fields
        for key, value in updates.items():
            if hasattr(config, key):
                setattr(config, key, value)

        config.updated_at = datetime.now(UTC)
        config.updated_by = updated_by

        await self.storage.save_config(config)
        logger.info("Updated autonomy config", agent_id=agent_id, updates=list(updates.keys()))

        return config

    async def should_auto_execute(
        self,
        agent_id: str,
        decision_type: str,
        confidence: float,
        risk_level: RiskLevel,
        estimated_value: float = 0.0,
        estimated_quantity: int = 0
    ) -> tuple[bool, str]:
        """Determine if a decision should be auto-executed.

        Args:
            agent_id: Agent identifier
            decision_type: Type of decision being made
            confidence: Confidence score (0.0 - 1.0)
            risk_level: Risk level of the decision
            estimated_value: Estimated financial value
            estimated_quantity: Estimated quantity involved

        Returns:
            Tuple of (should_execute: bool, reason: str)
        """
        config = await self.get_config(agent_id)

        # Check if agent is enabled
        if not config.enabled:
            return False, "Agent autonomy is disabled"

        # Check if paused
        if config.pause_until and datetime.now(UTC) < config.pause_until:
            return False, f"Agent autonomy paused until {config.pause_until}"

        # Check autonomy level
        if config.autonomy_level == AutonomyLevel.ADVISORY:
            return False, "Agent is in advisory mode (no auto-execution)"

        if config.autonomy_level == AutonomyLevel.SEMI_AUTONOMOUS:
            # Semi-autonomous only auto-executes low-risk actions
            if risk_level != RiskLevel.LOW:
                return False, f"Risk level {risk_level} requires approval in semi-autonomous mode"

        # Check confidence thresholds
        min_confidence = self._get_min_confidence(config, risk_level)
        if confidence < min_confidence:
            return False, f"Confidence {confidence:.2f} below threshold {min_confidence:.2f}"

        # Check value thresholds
        if estimated_value > config.max_auto_approval_amount:
            return False, f"Value ${estimated_value:.2f} exceeds max ${config.max_auto_approval_amount:.2f}"

        if estimated_quantity > config.max_auto_approval_quantity:
            return False, f"Quantity {estimated_quantity} exceeds max {config.max_auto_approval_quantity}"

        # Check rate limits
        rate_limit_ok, rate_limit_reason = await self._check_rate_limits(agent_id, config)
        if not rate_limit_ok:
            return False, rate_limit_reason

        return True, "All auto-execution criteria met"

    def _get_min_confidence(self, config: AgentAutonomyConfig, risk_level: RiskLevel) -> float:
        """Get minimum confidence threshold for risk level."""
        if risk_level == RiskLevel.LOW:
            return config.min_confidence_low_risk
        elif risk_level == RiskLevel.MEDIUM:
            return config.min_confidence_medium_risk
        else:  # HIGH
            return config.min_confidence_high_risk

    async def _check_rate_limits(
        self,
        agent_id: str,
        config: AgentAutonomyConfig
    ) -> tuple[bool, str]:
        """Check if agent is within rate limits.

        Args:
            agent_id: Agent identifier
            config: Autonomy configuration

        Returns:
            Tuple of (within_limits: bool, reason: str)
        """
        now = datetime.now(UTC)

        # Check hourly limit
        hourly_start = now - timedelta(hours=1)
        hourly_count = await self.storage.count_auto_executed(agent_id, since=hourly_start)
        if hourly_count >= config.max_actions_per_hour:
            return False, f"Hourly rate limit reached ({hourly_count}/{config.max_actions_per_hour})"

        # Check daily limit
        daily_start = now - timedelta(days=1)
        daily_count = await self.storage.count_auto_executed(agent_id, since=daily_start)
        if daily_count >= config.max_actions_per_day:
            return False, f"Daily rate limit reached ({daily_count}/{config.max_actions_per_day})"

        return True, "Within rate limits"

    async def record_decision(
        self,
        agent_id: str,
        decision_type: str,
        recommendation: dict[str, Any],
        confidence: float,
        risk_level: RiskLevel,
        context: dict[str, Any] | None = None,
        estimated_value: float = 0.0,
        estimated_quantity: int = 0
    ) -> AgentDecision:
        """Record an agent decision.

        Args:
            agent_id: Agent identifier
            decision_type: Type of decision
            recommendation: The agent's recommendation
            confidence: Confidence score (0.0 - 1.0)
            risk_level: Risk level
            context: Additional context
            estimated_value: Estimated financial value
            estimated_quantity: Estimated quantity

        Returns:
            Created decision record
        """
        config = await self.get_config(agent_id)

        # Determine if auto-execution is possible
        should_execute, reason = await self.should_auto_execute(
            agent_id=agent_id,
            decision_type=decision_type,
            confidence=confidence,
            risk_level=risk_level,
            estimated_value=estimated_value,
            estimated_quantity=estimated_quantity
        )

        decision = AgentDecision(
            agent_id=agent_id,
            decision_type=decision_type,
            recommendation=recommendation,
            confidence=confidence,
            risk_level=risk_level,
            context=context or {},
            autonomy_level=config.autonomy_level,
            requires_approval=not should_execute,
            status=DecisionStatus.AUTO_EXECUTED if should_execute else DecisionStatus.PENDING_APPROVAL
        )

        # Set expiration for pending decisions (24 hours)
        if decision.status == DecisionStatus.PENDING_APPROVAL:
            decision.expires_at = datetime.now(UTC) + timedelta(hours=24)

        await self.storage.save_decision(decision)

        logger.info(
            "Agent decision recorded",
            decision_id=decision.decision_id,
            agent_id=agent_id,
            decision_type=decision_type,
            confidence=confidence,
            risk_level=risk_level,
            should_execute=should_execute,
            reason=reason
        )

        return decision

    async def approve_decision(
        self,
        decision_id: str,
        approved_by: UUID
    ) -> AgentDecision:
        """Approve a pending decision.

        Args:
            decision_id: Decision identifier
            approved_by: User ID approving the decision

        Returns:
            Updated decision
        """
        decision = await self.storage.get_decision(decision_id)
        if not decision:
            raise ValueError(f"Decision {decision_id} not found")

        if decision.status != DecisionStatus.PENDING_APPROVAL:
            raise ValueError(f"Decision {decision_id} is not pending approval")

        decision.status = DecisionStatus.APPROVED
        decision.approved_by = approved_by
        decision.approved_at = datetime.now(UTC)

        await self.storage.save_decision(decision)

        logger.info(
            "Decision approved",
            decision_id=decision_id,
            agent_id=decision.agent_id,
            approved_by=str(approved_by)
        )

        return decision

    async def reject_decision(
        self,
        decision_id: str,
        rejected_by: UUID,
        reason: str
    ) -> AgentDecision:
        """Reject a pending decision.

        Args:
            decision_id: Decision identifier
            rejected_by: User ID rejecting the decision
            reason: Reason for rejection

        Returns:
            Updated decision
        """
        decision = await self.storage.get_decision(decision_id)
        if not decision:
            raise ValueError(f"Decision {decision_id} not found")

        if decision.status != DecisionStatus.PENDING_APPROVAL:
            raise ValueError(f"Decision {decision_id} is not pending approval")

        decision.status = DecisionStatus.REJECTED
        decision.rejected_by = rejected_by
        decision.rejected_at = datetime.now(UTC)
        decision.rejection_reason = reason

        await self.storage.save_decision(decision)

        logger.info(
            "Decision rejected",
            decision_id=decision_id,
            agent_id=decision.agent_id,
            rejected_by=str(rejected_by),
            reason=reason
        )

        return decision

    async def mark_executed(
        self,
        decision_id: str,
        result: dict[str, Any] | None = None,
        error: str | None = None
    ) -> AgentDecision:
        """Mark a decision as executed.

        Args:
            decision_id: Decision identifier
            result: Execution result
            error: Error message if execution failed

        Returns:
            Updated decision
        """
        decision = await self.storage.get_decision(decision_id)
        if not decision:
            raise ValueError(f"Decision {decision_id} not found")

        decision.executed = True
        decision.executed_at = datetime.now(UTC)
        decision.execution_result = result
        decision.execution_error = error

        await self.storage.save_decision(decision)

        logger.info(
            "Decision marked as executed",
            decision_id=decision_id,
            agent_id=decision.agent_id,
            success=error is None
        )

        return decision

    async def record_outcome(
        self,
        decision_id: str,
        success: bool,
        metrics: dict[str, Any] | None = None,
        feedback: str | None = None,
        rating: int | None = None
    ) -> AgentDecision:
        """Record outcome and feedback for learning.

        Args:
            decision_id: Decision identifier
            success: Was the outcome successful
            metrics: Performance metrics
            feedback: Human feedback
            rating: 1-5 star rating

        Returns:
            Updated decision
        """
        decision = await self.storage.get_decision(decision_id)
        if not decision:
            raise ValueError(f"Decision {decision_id} not found")

        decision.outcome_success = success
        decision.outcome_metrics = metrics
        decision.human_feedback = feedback
        decision.feedback_rating = rating

        await self.storage.save_decision(decision)

        logger.info(
            "Decision outcome recorded",
            decision_id=decision_id,
            agent_id=decision.agent_id,
            success=success,
            rating=rating
        )

        return decision

    async def get_pending_decisions(
        self,
        agent_id: str | None = None,
        limit: int = 100
    ) -> list[AgentDecision]:
        """Get pending decisions requiring approval.

        Args:
            agent_id: Filter by agent ID (optional)
            limit: Maximum number of decisions to return

        Returns:
            List of pending decisions
        """
        filter_obj = DecisionFilter(
            agent_ids=[agent_id] if agent_id else None,
            statuses=[DecisionStatus.PENDING_APPROVAL],
            limit=limit
        )
        return await self.storage.query_decisions(filter_obj)

    async def get_stats(
        self,
        agent_id: str,
        time_period: str = "last_7d"
    ) -> AutonomyStats:
        """Get autonomy statistics for an agent.

        Args:
            agent_id: Agent identifier
            time_period: Time period for stats

        Returns:
            Autonomy statistics
        """
        # Determine time range
        now = datetime.now(UTC)
        if time_period == "last_24h":
            start_time = now - timedelta(days=1)
        elif time_period == "last_7d":
            start_time = now - timedelta(days=7)
        elif time_period == "last_30d":
            start_time = now - timedelta(days=30)
        else:
            start_time = now - timedelta(days=7)  # default

        # Get all decisions in time period
        filter_obj = DecisionFilter(
            agent_ids=[agent_id],
            created_after=start_time,
            limit=1000
        )
        decisions = await self.storage.query_decisions(filter_obj)

        # Calculate statistics
        stats = AutonomyStats(
            agent_id=agent_id,
            time_period=time_period,
            total_decisions=len(decisions)
        )

        if not decisions:
            return stats

        # Count statuses
        stats.auto_executed = sum(1 for d in decisions if d.status == DecisionStatus.AUTO_EXECUTED)
        stats.pending_approval = sum(1 for d in decisions if d.status == DecisionStatus.PENDING_APPROVAL)
        stats.approved_by_human = sum(1 for d in decisions if d.status == DecisionStatus.APPROVED)
        stats.rejected_by_human = sum(1 for d in decisions if d.status == DecisionStatus.REJECTED)

        # Calculate averages
        stats.average_confidence = sum(d.confidence for d in decisions) / len(decisions)

        executed_decisions = [d for d in decisions if d.executed]
        if executed_decisions:
            successful = sum(1 for d in executed_decisions if d.outcome_success)
            stats.success_rate = successful / len(executed_decisions)

        pending_or_approved = [d for d in decisions if d.status in [DecisionStatus.APPROVED, DecisionStatus.REJECTED]]
        if pending_or_approved:
            approved = sum(1 for d in pending_or_approved if d.status == DecisionStatus.APPROVED)
            stats.approval_rate = approved / len(pending_or_approved)

        # Count risk levels
        stats.low_risk_decisions = sum(1 for d in decisions if d.risk_level == RiskLevel.LOW)
        stats.medium_risk_decisions = sum(1 for d in decisions if d.risk_level == RiskLevel.MEDIUM)
        stats.high_risk_decisions = sum(1 for d in decisions if d.risk_level == RiskLevel.HIGH)

        return stats
