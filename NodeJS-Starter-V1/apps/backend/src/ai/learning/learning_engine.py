"""Core learning engine for agent self-improvement."""

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from pydantic import BaseModel, Field

from src.ai.monitoring import get_metrics_collector

logger = structlog.get_logger(__name__)


class LearningPattern(BaseModel):
    """Represents a learned pattern from agent executions."""

    pattern_id: str
    agent_id: str
    pattern_type: str = Field(description="success, failure, optimization")
    task_category: str
    observed_count: int = 1
    success_rate: float
    avg_duration_ms: float
    conditions: dict[str, Any] = Field(default_factory=dict)
    actions: list[str] = Field(default_factory=list)
    outcomes: dict[str, Any] = Field(default_factory=dict)
    confidence: float = Field(ge=0.0, le=1.0)
    first_observed: str
    last_observed: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class PromptVariant(BaseModel):
    """A variant of an agent prompt for A/B testing."""

    variant_id: str
    agent_id: str
    prompt_template: str
    version: int
    is_active: bool = True
    executions: int = 0
    success_count: int = 0
    failure_count: int = 0
    avg_duration_ms: float = 0.0
    confidence_score: float = 0.5
    created_at: str
    last_used: str | None = None


class LearningInsight(BaseModel):
    """An actionable insight derived from learning patterns."""

    insight_id: str
    insight_type: str = Field(description="prompt_improvement, process_optimization, error_prevention")
    agent_id: str
    priority: str = Field(description="high, medium, low")
    title: str
    description: str
    recommended_action: str
    supporting_patterns: list[str] = Field(default_factory=list)
    expected_improvement: float = Field(description="Percentage improvement expected")
    created_at: str


class LearningEngine:
    """Engine for agent self-learning and continuous improvement."""

    def __init__(self, repository=None):
        """
        Initialize the learning engine.

        Args:
            repository: Optional LearningRepository for database persistence
        """
        self.metrics_collector = get_metrics_collector()
        self._patterns: dict[str, LearningPattern] = {}
        self._prompt_variants: dict[str, dict[str, PromptVariant]] = {}  # agent_id -> variant_id -> variant
        self._insights: list[LearningInsight] = []
        self.repository = repository
        logger.info("Learning engine initialized", has_persistence=repository is not None)

    async def extract_patterns(
        self,
        agent_id: str | None = None,
        lookback_hours: int = 24,
        min_observations: int = 3,
    ) -> list[LearningPattern]:
        """
        Extract patterns from recent agent executions.

        Args:
            agent_id: Filter by specific agent, or None for all agents
            lookback_hours: How far back to analyze executions
            min_observations: Minimum observations needed to establish a pattern

        Returns:
            List of identified patterns
        """
        logger.info(
            "Extracting learning patterns",
            agent_id=agent_id,
            lookback_hours=lookback_hours,
            min_observations=min_observations,
        )

        # Get recent executions
        since_minutes = lookback_hours * 60
        executions = self.metrics_collector.get_recent_executions(
            limit=500,
            agent_id=agent_id,
            since_minutes=since_minutes,
        )

        if len(executions) < min_observations:
            logger.warning(
                "Insufficient executions for pattern extraction",
                execution_count=len(executions),
                min_required=min_observations,
            )
            return []

        # Group executions by task and status
        task_groups: dict[str, list[Any]] = {}
        for execution in executions:
            key = f"{execution.agent_id}:{execution.task}"
            if key not in task_groups:
                task_groups[key] = []
            task_groups[key].append(execution)

        patterns = []
        now = datetime.now(UTC).isoformat()

        for key, group in task_groups.items():
            if len(group) < min_observations:
                continue

            agent_id_from_key, task = key.split(":", 1)

            # Calculate statistics
            total = len(group)
            successes = sum(1 for ex in group if ex.status == "completed")
            failures = sum(1 for ex in group if ex.status == "failed")
            success_rate = successes / total if total > 0 else 0

            # Calculate average duration for completed tasks
            durations = [ex.duration_ms for ex in group if ex.duration_ms is not None and ex.status == "completed"]
            avg_duration = sum(durations) / len(durations) if durations else 0

            # Determine pattern type
            if success_rate >= 0.8:
                pattern_type = "success"
            elif success_rate <= 0.3:
                pattern_type = "failure"
            else:
                pattern_type = "optimization"

            # Extract common conditions and actions
            conditions = self._extract_common_conditions(group)
            actions = self._extract_common_actions(group)
            outcomes = {"success_rate": success_rate, "avg_duration_ms": avg_duration}

            # Calculate confidence based on sample size and consistency
            confidence = min(0.95, (total / (min_observations * 3)) * success_rate)

            # Get first and last observed timestamps
            timestamps = [ex.started_at for ex in group]
            first_observed = min(timestamps)
            last_observed = max(timestamps)

            pattern = LearningPattern(
                pattern_id=f"pattern-{agent_id_from_key}-{abs(hash(str(task))) % 10000}",
                agent_id=agent_id_from_key,
                pattern_type=pattern_type,
                task_category=task,
                observed_count=total,
                success_rate=success_rate,
                avg_duration_ms=avg_duration,
                conditions=conditions,
                actions=actions,
                outcomes=outcomes,
                confidence=confidence,
                first_observed=first_observed,
                last_observed=last_observed,
                metadata={"successes": successes, "failures": failures},
            )

            patterns.append(pattern)
            self._patterns[pattern.pattern_id] = pattern

        logger.info("Pattern extraction complete", patterns_found=len(patterns))

        # Persist patterns to database if repository is available
        if self.repository:
            for pattern in patterns:
                await self.repository.save_pattern(pattern.model_dump())

        return patterns

    def _extract_common_conditions(self, executions: list[Any]) -> dict[str, Any]:
        """Extract common conditions from execution metadata."""
        conditions = {}

        # Analyze metadata from executions
        all_metadata = [ex.metadata for ex in executions if ex.metadata]
        if not all_metadata:
            return conditions

        # Find common keys
        common_keys = set(all_metadata[0].keys())
        for metadata in all_metadata[1:]:
            common_keys &= set(metadata.keys())

        # Extract common values (only for hashable types)
        for key in common_keys:
            values = [m.get(key) for m in all_metadata]
            # Skip if values contain unhashable types (lists, dicts)
            try:
                # Filter out None values
                values = [v for v in values if v is not None]
                if not values:
                    continue

                # If >70% have same value, consider it a condition
                # Convert to string for comparison if needed
                comparable_values = []
                for v in values:
                    if isinstance(v, (list, dict)):
                        comparable_values.append(str(v))
                    else:
                        comparable_values.append(v)

                # Find most common
                from collections import Counter
                counter = Counter(comparable_values)
                most_common_value, count = counter.most_common(1)[0]

                if count / len(values) >= 0.7:
                    # Store original value if possible, not string representation
                    # Find first occurrence of most common value
                    for i, cv in enumerate(comparable_values):
                        if cv == most_common_value:
                            conditions[key] = values[i]
                            break
            except (TypeError, ValueError):
                # Skip fields that can't be compared
                continue

        return conditions

    def _extract_common_actions(self, executions: list[Any]) -> list[str]:
        """Extract common action sequences from executions."""
        # This would analyze execution traces to find common action patterns
        # For now, return task name as primary action
        if executions:
            return [executions[0].task]
        return []

    async def generate_insights(
        self,
        agent_id: str | None = None,
        min_confidence: float = 0.7,
    ) -> list[LearningInsight]:
        """
        Generate actionable insights from learned patterns.

        Args:
            agent_id: Filter by specific agent
            min_confidence: Minimum pattern confidence required

        Returns:
            List of insights with recommended actions
        """
        logger.info(
            "Generating learning insights",
            agent_id=agent_id,
            min_confidence=min_confidence,
        )

        insights = []
        patterns = [
            p
            for p in self._patterns.values()
            if (agent_id is None or p.agent_id == agent_id) and p.confidence >= min_confidence
        ]

        now = datetime.now(UTC).isoformat()

        # Insight 1: Identify consistently failing patterns
        for pattern in patterns:
            if pattern.pattern_type == "failure" and pattern.success_rate < 0.3:
                insight = LearningInsight(
                    insight_id=f"insight-{len(insights) + 1}",
                    insight_type="error_prevention",
                    agent_id=pattern.agent_id,
                    priority="high",
                    title=f"High failure rate detected for {pattern.task_category}",
                    description=(
                        f"Agent {pattern.agent_id} fails {(1 - pattern.success_rate) * 100:.1f}% "
                        f"of the time on task: {pattern.task_category}. "
                        f"Observed {pattern.observed_count} times."
                    ),
                    recommended_action=(
                        "Review and update the agent's prompt or tools for this task category. "
                        "Consider adding error handling or pre-validation steps."
                    ),
                    supporting_patterns=[pattern.pattern_id],
                    expected_improvement=50.0,
                    created_at=now,
                )
                insights.append(insight)

        # Insight 2: Identify slow but successful patterns
        for pattern in patterns:
            if pattern.pattern_type == "success" and pattern.avg_duration_ms > 5000:
                insight = LearningInsight(
                    insight_id=f"insight-{len(insights) + 1}",
                    insight_type="process_optimization",
                    agent_id=pattern.agent_id,
                    priority="medium",
                    title=f"Optimization opportunity for {pattern.task_category}",
                    description=(
                        f"Agent {pattern.agent_id} succeeds {pattern.success_rate * 100:.1f}% "
                        f"but takes {pattern.avg_duration_ms / 1000:.1f}s on average. "
                        f"Opportunity for performance improvement."
                    ),
                    recommended_action=(
                        "Analyze the agent's execution steps to identify bottlenecks. "
                        "Consider caching, parallel processing, or prompt optimization."
                    ),
                    supporting_patterns=[pattern.pattern_id],
                    expected_improvement=30.0,
                    created_at=now,
                )
                insights.append(insight)

        # Insight 3: Identify successful patterns worth reinforcing
        for pattern in patterns:
            if pattern.pattern_type == "success" and pattern.success_rate > 0.9 and pattern.observed_count >= 10:
                insight = LearningInsight(
                    insight_id=f"insight-{len(insights) + 1}",
                    insight_type="prompt_improvement",
                    agent_id=pattern.agent_id,
                    priority="low",
                    title=f"Strong success pattern for {pattern.task_category}",
                    description=(
                        f"Agent {pattern.agent_id} has {pattern.success_rate * 100:.1f}% success rate "
                        f"on {pattern.task_category}. This approach should be documented and reused."
                    ),
                    recommended_action=(
                        "Extract successful prompt patterns and apply to similar tasks. "
                        "Consider this as a template for other agents."
                    ),
                    supporting_patterns=[pattern.pattern_id],
                    expected_improvement=15.0,
                    created_at=now,
                )
                insights.append(insight)

        self._insights.extend(insights)
        logger.info("Insights generated", count=len(insights))

        # Persist insights to database if repository is available
        if self.repository:
            for insight in insights:
                await self.repository.save_insight(insight.model_dump())

        return insights

    async def create_prompt_variant(
        self,
        agent_id: str,
        prompt_template: str,
        version: int,
    ) -> PromptVariant:
        """
        Create a new prompt variant for A/B testing.

        Args:
            agent_id: Agent to create variant for
            prompt_template: The prompt template text
            version: Version number

        Returns:
            Created prompt variant
        """
        now = datetime.now(UTC).isoformat()

        variant = PromptVariant(
            variant_id=f"variant-{agent_id}-v{version}",
            agent_id=agent_id,
            prompt_template=prompt_template,
            version=version,
            is_active=True,
            created_at=now,
        )

        if agent_id not in self._prompt_variants:
            self._prompt_variants[agent_id] = {}

        self._prompt_variants[agent_id][variant.variant_id] = variant

        logger.info(
            "Prompt variant created",
            agent_id=agent_id,
            variant_id=variant.variant_id,
            version=version,
        )

        # Persist variant to database if repository is available
        if self.repository:
            await self.repository.save_variant(variant.model_dump())

        return variant

    async def record_variant_execution(
        self,
        variant_id: str,
        success: bool,
        duration_ms: float,
    ) -> None:
        """
        Record the outcome of using a prompt variant.

        Args:
            variant_id: The variant that was used
            success: Whether execution was successful
            duration_ms: Execution duration
        """
        # Find variant
        variant = None
        for agent_variants in self._prompt_variants.values():
            if variant_id in agent_variants:
                variant = agent_variants[variant_id]
                break

        if not variant:
            logger.warning("Variant not found", variant_id=variant_id)
            return

        # Update statistics
        variant.executions += 1
        if success:
            variant.success_count += 1
        else:
            variant.failure_count += 1

        # Update average duration (running average)
        if variant.executions == 1:
            variant.avg_duration_ms = duration_ms
        else:
            variant.avg_duration_ms = (variant.avg_duration_ms * (variant.executions - 1) + duration_ms) / variant.executions

        # Update confidence score (based on success rate and sample size)
        success_rate = variant.success_count / variant.executions
        sample_confidence = min(1.0, variant.executions / 20)  # Full confidence after 20 executions
        variant.confidence_score = success_rate * sample_confidence

        variant.last_used = datetime.now(UTC).isoformat()

        logger.debug(
            "Variant execution recorded",
            variant_id=variant_id,
            executions=variant.executions,
            success_rate=success_rate,
            confidence=variant.confidence_score,
        )

        # Persist variant update to database if repository is available
        if self.repository:
            await self.repository.save_variant(variant.model_dump())

    async def select_best_variant(self, agent_id: str, min_executions: int = 10) -> PromptVariant | None:
        """
        Select the best performing prompt variant for an agent.

        Args:
            agent_id: Agent to select variant for
            min_executions: Minimum executions before considering a variant

        Returns:
            Best performing variant, or None if insufficient data
        """
        if agent_id not in self._prompt_variants:
            return None

        variants = [v for v in self._prompt_variants[agent_id].values() if v.executions >= min_executions and v.is_active]

        if not variants:
            logger.warning(
                "No variants with sufficient data",
                agent_id=agent_id,
                min_executions=min_executions,
            )
            return None

        # Select variant with highest confidence score
        best = max(variants, key=lambda v: v.confidence_score)

        logger.info(
            "Best variant selected",
            agent_id=agent_id,
            variant_id=best.variant_id,
            confidence=best.confidence_score,
            success_rate=best.success_count / best.executions,
        )

        return best

    async def load_patterns_from_db(self, agent_id: str | None = None) -> int:
        """
        Load patterns from database into in-memory storage.

        Args:
            agent_id: Optional agent ID to filter patterns

        Returns:
            Number of patterns loaded
        """
        if not self.repository:
            logger.warning("No repository configured, cannot load patterns from database")
            return 0

        try:
            patterns_data = await self.repository.load_patterns(agent_id=agent_id)
            loaded_count = 0

            for pattern_dict in patterns_data:
                # Convert to LearningPattern model
                pattern = LearningPattern(
                    pattern_id=pattern_dict["pattern_id"],
                    agent_id=pattern_dict["agent_id"],
                    pattern_type=pattern_dict["pattern_type"],
                    task_category=pattern_dict["task_category"],
                    observed_count=pattern_dict["observed_count"],
                    success_rate=pattern_dict["success_rate"],
                    avg_duration_ms=pattern_dict["avg_duration_ms"],
                    confidence=pattern_dict["confidence"],
                    conditions=pattern_dict.get("conditions", {}),
                    actions=pattern_dict.get("actions", []),
                    outcomes=pattern_dict.get("outcomes", {}),
                    first_observed=pattern_dict["first_observed"],
                    last_observed=pattern_dict["last_observed"],
                    metadata=pattern_dict.get("metadata", {}),
                )

                # Store in memory
                self._patterns[pattern.pattern_id] = pattern
                loaded_count += 1

            logger.info(
                "Loaded patterns from database",
                loaded_count=loaded_count,
                agent_id=agent_id,
            )
            return loaded_count

        except Exception as e:
            logger.error("Failed to load patterns from database", error=str(e))
            return 0

    def get_patterns(self, agent_id: str | None = None) -> list[LearningPattern]:
        """Get all learned patterns, optionally filtered by agent."""
        if agent_id is None:
            return list(self._patterns.values())
        return [p for p in self._patterns.values() if p.agent_id == agent_id]

    def get_insights(self, agent_id: str | None = None, priority: str | None = None) -> list[LearningInsight]:
        """Get all insights, optionally filtered by agent and priority."""
        insights = self._insights

        if agent_id:
            insights = [i for i in insights if i.agent_id == agent_id]

        if priority:
            insights = [i for i in insights if i.priority == priority]

        return insights

    def get_variants(self, agent_id: str) -> list[PromptVariant]:
        """Get all prompt variants for an agent."""
        if agent_id not in self._prompt_variants:
            return []
        return list(self._prompt_variants[agent_id].values())

    async def get_status(self) -> dict[str, Any]:
        """Get learning engine status and statistics."""
        total_patterns = len(self._patterns)
        total_insights = len(self._insights)
        total_variants = sum(len(variants) for variants in self._prompt_variants.values())

        # Pattern breakdown
        pattern_types = {"success": 0, "failure": 0, "optimization": 0}
        for pattern in self._patterns.values():
            pattern_types[pattern.pattern_type] += 1

        # Insight breakdown
        insight_priorities = {"high": 0, "medium": 0, "low": 0}
        for insight in self._insights:
            insight_priorities[insight.priority] += 1

        return {
            "total_patterns": total_patterns,
            "pattern_breakdown": pattern_types,
            "total_insights": total_insights,
            "insight_priorities": insight_priorities,
            "total_variants": total_variants,
            "agents_with_variants": len(self._prompt_variants),
        }


# Global learning engine instance
_learning_engine: LearningEngine | None = None


def get_learning_engine() -> LearningEngine:
    """Get or create learning engine singleton with database persistence."""
    global _learning_engine
    if _learning_engine is None:
        # Try to initialize with database persistence
        repository = None
        try:
            from src.ai.learning.learning_repository import LearningRepository
            from src.config.database import get_async_db

            # Create a repository instance
            # Note: We can't use async context here, so we'll pass None
            # The repository will handle database operations when available
            repository = LearningRepository(db_session=None)
            logger.info("Learning engine initialized with database persistence")
        except Exception as e:
            logger.warning("Failed to initialize database persistence, using in-memory only", error=str(e))

        _learning_engine = LearningEngine(repository=repository)
    return _learning_engine
