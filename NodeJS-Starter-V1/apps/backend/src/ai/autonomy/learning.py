"""Learning and feedback analysis for agent autonomy.

This module analyzes decision outcomes and provides recommendations
for improving agent performance through adaptive thresholds.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog

from .models import (
    AgentAutonomyConfig,
    AgentDecision,
    AutonomyLevel,
    DecisionFilter,
    DecisionStatus,
    RiskLevel,
)
from .storage import AutonomyStorage

logger = structlog.get_logger(__name__)


class LearningEngine:
    """Analyzes decision outcomes and recommends threshold adjustments.

    The learning engine tracks:
    - Success rates by confidence level
    - Human override patterns
    - Outcome accuracy vs confidence
    - Risk assessment accuracy

    Based on this data, it recommends:
    - Confidence threshold adjustments
    - Risk threshold modifications
    - Autonomy level changes
    """

    def __init__(self, storage: AutonomyStorage):
        """Initialize learning engine.

        Args:
            storage: Storage backend for decision data
        """
        self.storage = storage
        logger.info("Learning engine initialized")

    async def analyze_agent_performance(
        self,
        agent_id: str,
        days: int = 30,
    ) -> dict[str, Any]:
        """Analyze agent performance over time period.

        Args:
            agent_id: Agent identifier
            days: Number of days to analyze

        Returns:
            dict with performance analysis
        """
        since = datetime.now(UTC) - timedelta(days=days)

        # Get all decisions for agent
        filter_obj = DecisionFilter(
            agent_ids=[agent_id],
            created_after=since,
            limit=1000,
        )
        decisions = await self.storage.query_decisions(filter_obj)

        if not decisions:
            logger.warning("No decisions found for analysis", agent_id=agent_id, days=days)
            return {
                "agent_id": agent_id,
                "analysis_period_days": days,
                "total_decisions": 0,
                "message": "Insufficient data for analysis",
            }

        # Analyze decisions
        analysis = {
            "agent_id": agent_id,
            "analysis_period_days": days,
            "total_decisions": len(decisions),
            "decision_breakdown": self._analyze_decision_breakdown(decisions),
            "confidence_analysis": self._analyze_confidence_accuracy(decisions),
            "risk_analysis": self._analyze_risk_accuracy(decisions),
            "human_override_patterns": self._analyze_human_overrides(decisions),
            "execution_analysis": self._analyze_execution_outcomes(decisions),
        }

        logger.info(
            "Performance analysis complete",
            agent_id=agent_id,
            total_decisions=len(decisions),
            days=days,
        )

        return analysis

    def _analyze_decision_breakdown(
        self,
        decisions: list[AgentDecision],
    ) -> dict[str, Any]:
        """Analyze decision status breakdown."""
        total = len(decisions)

        status_counts = {
            "auto_executed": 0,
            "pending_approval": 0,
            "approved": 0,
            "rejected": 0,
            "expired": 0,
        }

        for decision in decisions:
            status = decision.status
            if status in status_counts:
                status_counts[status] += 1

        return {
            "total": total,
            "auto_executed_count": status_counts["auto_executed"],
            "auto_executed_rate": status_counts["auto_executed"] / total if total > 0 else 0,
            "pending_count": status_counts["pending_approval"],
            "approved_count": status_counts["approved"],
            "approved_rate": (
                status_counts["approved"] / (status_counts["approved"] + status_counts["rejected"])
                if (status_counts["approved"] + status_counts["rejected"]) > 0
                else 0
            ),
            "rejected_count": status_counts["rejected"],
            "expired_count": status_counts["expired"],
        }

    def _analyze_confidence_accuracy(
        self,
        decisions: list[AgentDecision],
    ) -> dict[str, Any]:
        """Analyze how well confidence scores predict outcomes.

        Groups decisions by confidence ranges and calculates success rates.
        """
        # Group by confidence ranges
        confidence_ranges = {
            "high (0.9-1.0)": {"decisions": [], "range": (0.9, 1.0)},
            "medium-high (0.8-0.9)": {"decisions": [], "range": (0.8, 0.9)},
            "medium (0.7-0.8)": {"decisions": [], "range": (0.7, 0.8)},
            "low (0.6-0.7)": {"decisions": [], "range": (0.6, 0.7)},
            "very low (<0.6)": {"decisions": [], "range": (0.0, 0.6)},
        }

        for decision in decisions:
            confidence = decision.confidence
            for range_name, range_data in confidence_ranges.items():
                min_conf, max_conf = range_data["range"]
                if min_conf <= confidence < max_conf or (
                    range_name == "high (0.9-1.0)" and confidence >= max_conf
                ):
                    range_data["decisions"].append(decision)
                    break

        # Calculate success rates for each range
        analysis = {}
        for range_name, range_data in confidence_ranges.items():
            range_decisions = range_data["decisions"]
            if not range_decisions:
                continue

            executed = [d for d in range_decisions if d.executed]
            if executed:
                successful = sum(1 for d in executed if d.outcome_success is True)
                success_rate = successful / len(executed)
            else:
                success_rate = None

            # Calculate approval rate for non-auto-executed
            pending_or_reviewed = [
                d for d in range_decisions if d.status in ["approved", "rejected"]
            ]
            if pending_or_reviewed:
                approved = sum(1 for d in pending_or_reviewed if d.status == "approved")
                approval_rate = approved / len(pending_or_reviewed)
            else:
                approval_rate = None

            analysis[range_name] = {
                "count": len(range_decisions),
                "avg_confidence": sum(d.confidence for d in range_decisions)
                / len(range_decisions),
                "success_rate": success_rate,
                "approval_rate": approval_rate,
            }

        return analysis

    def _analyze_risk_accuracy(
        self,
        decisions: list[AgentDecision],
    ) -> dict[str, Any]:
        """Analyze how well risk assessments predict outcomes.

        Groups decisions by risk level and calculates success rates.
        """
        risk_groups = {
            "low": [],
            "medium": [],
            "high": [],
        }

        for decision in decisions:
            risk_level = decision.risk_level
            if risk_level in risk_groups:
                risk_groups[risk_level].append(decision)

        analysis = {}
        for risk_level, risk_decisions in risk_groups.items():
            if not risk_decisions:
                continue

            executed = [d for d in risk_decisions if d.executed]
            if executed:
                successful = sum(1 for d in executed if d.outcome_success is True)
                success_rate = successful / len(executed)
            else:
                success_rate = None

            # Calculate average confidence for this risk level
            avg_confidence = sum(d.confidence for d in risk_decisions) / len(risk_decisions)

            # Auto-execution rate
            auto_executed = sum(1 for d in risk_decisions if d.status == "auto_executed")
            auto_exec_rate = auto_executed / len(risk_decisions)

            analysis[risk_level] = {
                "count": len(risk_decisions),
                "avg_confidence": avg_confidence,
                "success_rate": success_rate,
                "auto_execution_rate": auto_exec_rate,
            }

        return analysis

    def _analyze_human_overrides(
        self,
        decisions: list[AgentDecision],
    ) -> dict[str, Any]:
        """Analyze patterns in human approvals and rejections."""
        # Get decisions that required human review
        reviewed = [d for d in decisions if d.status in ["approved", "rejected"]]

        if not reviewed:
            return {"message": "No human reviews found"}

        approved = [d for d in reviewed if d.status == "approved"]
        rejected = [d for d in reviewed if d.status == "rejected"]

        # Analyze rejection patterns
        rejection_patterns = {
            "high_confidence_rejected": [],
            "low_confidence_approved": [],
            "common_rejection_reasons": {},
        }

        # High confidence but rejected (agent was overconfident)
        for decision in rejected:
            if decision.confidence >= 0.8:
                rejection_patterns["high_confidence_rejected"].append(
                    {
                        "decision_id": decision.decision_id,
                        "confidence": decision.confidence,
                        "risk_level": decision.risk_level,
                        "reason": decision.rejection_reason,
                    }
                )

            # Count rejection reasons
            if decision.rejection_reason:
                reason_key = decision.rejection_reason[:50]  # First 50 chars as key
                rejection_patterns["common_rejection_reasons"][reason_key] = (
                    rejection_patterns["common_rejection_reasons"].get(reason_key, 0) + 1
                )

        # Low confidence but approved (agent was under-confident)
        for decision in approved:
            if decision.confidence < 0.7:
                rejection_patterns["low_confidence_approved"].append(
                    {
                        "decision_id": decision.decision_id,
                        "confidence": decision.confidence,
                        "risk_level": decision.risk_level,
                    }
                )

        return {
            "total_reviewed": len(reviewed),
            "approved_count": len(approved),
            "rejected_count": len(rejected),
            "approval_rate": len(approved) / len(reviewed) if reviewed else 0,
            "avg_confidence_approved": (
                sum(d.confidence for d in approved) / len(approved) if approved else 0
            ),
            "avg_confidence_rejected": (
                sum(d.confidence for d in rejected) / len(rejected) if rejected else 0
            ),
            "patterns": rejection_patterns,
        }

    def _analyze_execution_outcomes(
        self,
        decisions: list[AgentDecision],
    ) -> dict[str, Any]:
        """Analyze execution outcomes and ratings."""
        executed = [d for d in decisions if d.executed]

        if not executed:
            return {"message": "No executed decisions found"}

        # Outcome success analysis
        with_outcomes = [d for d in executed if d.outcome_success is not None]
        successful = sum(1 for d in with_outcomes if d.outcome_success is True)

        # Rating analysis
        with_ratings = [d for d in executed if d.feedback_rating is not None]
        avg_rating = (
            sum(d.feedback_rating for d in with_ratings) / len(with_ratings)
            if with_ratings
            else None
        )

        return {
            "total_executed": len(executed),
            "with_outcome_data": len(with_outcomes),
            "successful_count": successful,
            "success_rate": successful / len(with_outcomes) if with_outcomes else None,
            "with_ratings": len(with_ratings),
            "average_rating": avg_rating,
        }

    async def recommend_threshold_adjustments(
        self,
        agent_id: str,
        config: AgentAutonomyConfig,
        days: int = 30,
    ) -> dict[str, Any]:
        """Recommend threshold adjustments based on performance.

        Args:
            agent_id: Agent identifier
            config: Current configuration
            days: Days of data to analyze

        Returns:
            dict with recommendations
        """
        analysis = await self.analyze_agent_performance(agent_id, days)

        if analysis["total_decisions"] < 10:
            return {
                "agent_id": agent_id,
                "recommendations": [],
                "message": "Insufficient data for recommendations (need at least 10 decisions)",
            }

        recommendations = []

        # Recommendation 1: Adjust confidence thresholds based on success rates
        confidence_analysis = analysis.get("confidence_analysis", {})
        recommendations.extend(
            self._recommend_confidence_adjustments(config, confidence_analysis)
        )

        # Recommendation 2: Adjust autonomy level based on performance
        decision_breakdown = analysis.get("decision_breakdown", {})
        human_overrides = analysis.get("human_override_patterns", {})
        recommendations.extend(
            self._recommend_autonomy_level(config, decision_breakdown, human_overrides)
        )

        # Recommendation 3: Adjust rate limits based on volume
        recommendations.extend(self._recommend_rate_limits(config, decision_breakdown))

        logger.info(
            "Generated threshold recommendations",
            agent_id=agent_id,
            recommendation_count=len(recommendations),
        )

        return {
            "agent_id": agent_id,
            "current_config": {
                "autonomy_level": config.autonomy_level,
                "min_confidence_low_risk": config.min_confidence_low_risk,
                "min_confidence_medium_risk": config.min_confidence_medium_risk,
                "min_confidence_high_risk": config.min_confidence_high_risk,
                "max_actions_per_hour": config.max_actions_per_hour,
                "max_actions_per_day": config.max_actions_per_day,
            },
            "recommendations": recommendations,
            "analysis_summary": {
                "total_decisions": analysis["total_decisions"],
                "auto_execution_rate": decision_breakdown.get("auto_executed_rate"),
                "approval_rate": decision_breakdown.get("approved_rate"),
            },
        }

    def _recommend_confidence_adjustments(
        self,
        config: AgentAutonomyConfig,
        confidence_analysis: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Recommend confidence threshold adjustments."""
        recommendations = []

        # Check if high confidence decisions are succeeding
        high_conf = confidence_analysis.get("high (0.9-1.0)", {})
        if high_conf.get("count", 0) >= 5:
            success_rate = high_conf.get("success_rate")
            if success_rate and success_rate > 0.95:
                # Agent is very accurate at high confidence, can lower high-risk threshold
                current = config.min_confidence_high_risk
                recommended = max(0.90, current - 0.03)
                if recommended < current:
                    recommendations.append(
                        {
                            "type": "confidence_threshold",
                            "parameter": "min_confidence_high_risk",
                            "current_value": current,
                            "recommended_value": recommended,
                            "reason": f"High confidence decisions have {success_rate:.1%} success rate, can reduce threshold",
                            "confidence": "high",
                        }
                    )

        # Check if medium confidence decisions are failing
        med_conf = confidence_analysis.get("medium (0.7-0.8)", {})
        if med_conf.get("count", 0) >= 5:
            success_rate = med_conf.get("success_rate")
            if success_rate and success_rate < 0.70:
                # Agent struggling at medium confidence, raise low-risk threshold
                current = config.min_confidence_low_risk
                recommended = min(0.80, current + 0.05)
                if recommended > current:
                    recommendations.append(
                        {
                            "type": "confidence_threshold",
                            "parameter": "min_confidence_low_risk",
                            "current_value": current,
                            "recommended_value": recommended,
                            "reason": f"Medium confidence decisions have {success_rate:.1%} success rate, should increase threshold",
                            "confidence": "medium",
                        }
                    )

        return recommendations

    def _recommend_autonomy_level(
        self,
        config: AgentAutonomyConfig,
        decision_breakdown: dict[str, Any],
        human_overrides: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Recommend autonomy level adjustments."""
        recommendations = []

        current_level = config.autonomy_level
        approval_rate = human_overrides.get("approval_rate", 0)

        # If approval rate is very high, can increase autonomy
        if current_level == AutonomyLevel.ADVISORY and approval_rate > 0.90:
            if decision_breakdown.get("total", 0) >= 20:
                recommendations.append(
                    {
                        "type": "autonomy_level",
                        "parameter": "autonomy_level",
                        "current_value": current_level,
                        "recommended_value": "semi_autonomous",
                        "reason": f"Agent has {approval_rate:.1%} approval rate, ready for semi-autonomous mode",
                        "confidence": "high",
                    }
                )

        elif current_level == AutonomyLevel.SEMI_AUTONOMOUS and approval_rate > 0.95:
            if decision_breakdown.get("total", 0) >= 50:
                recommendations.append(
                    {
                        "type": "autonomy_level",
                        "parameter": "autonomy_level",
                        "current_value": current_level,
                        "recommended_value": "fully_autonomous",
                        "reason": f"Agent has {approval_rate:.1%} approval rate, ready for fully autonomous mode",
                        "confidence": "medium",
                    }
                )

        # If approval rate is low, should decrease autonomy
        elif current_level == AutonomyLevel.FULLY_AUTONOMOUS and approval_rate < 0.70:
            recommendations.append(
                {
                    "type": "autonomy_level",
                    "parameter": "autonomy_level",
                    "current_value": current_level,
                    "recommended_value": "semi_autonomous",
                    "reason": f"Agent has {approval_rate:.1%} approval rate, should reduce autonomy",
                    "confidence": "high",
                }
            )

        return recommendations

    def _recommend_rate_limits(
        self,
        config: AgentAutonomyConfig,
        decision_breakdown: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Recommend rate limit adjustments."""
        recommendations = []

        total_decisions = decision_breakdown.get("total", 0)
        auto_executed = decision_breakdown.get("auto_executed_count", 0)

        # Estimate hourly rate (rough approximation)
        # If auto-executed count is approaching limits, suggest increase
        if auto_executed > config.max_actions_per_day * 0.8:
            recommendations.append(
                {
                    "type": "rate_limit",
                    "parameter": "max_actions_per_day",
                    "current_value": config.max_actions_per_day,
                    "recommended_value": int(config.max_actions_per_day * 1.5),
                    "reason": "Agent frequently hits daily rate limit, consider increasing",
                    "confidence": "medium",
                }
            )

        return recommendations


# Singleton instance
_learning_engine: LearningEngine | None = None


def get_learning_engine(storage: AutonomyStorage | None = None) -> LearningEngine:
    """Get or create learning engine singleton.

    Args:
        storage: Storage backend (optional, uses default if not provided)

    Returns:
        LearningEngine instance
    """
    global _learning_engine
    if _learning_engine is None:
        from . import get_autonomy_manager

        if storage is None:
            storage = get_autonomy_manager().storage
        _learning_engine = LearningEngine(storage)
    return _learning_engine
