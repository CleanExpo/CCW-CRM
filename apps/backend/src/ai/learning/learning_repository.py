"""Database repository for learning engine persistence."""

from datetime import datetime
from typing import Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.ai_models import (
    LearningInsight as DBLearningInsight,
    LearningPattern as DBLearningPattern,
    PromptVariant as DBPromptVariant,
)

logger = structlog.get_logger(__name__)


class LearningRepository:
    """Repository for learning engine data persistence."""

    def __init__(self, db_session: AsyncSession | None = None):
        """Initialize repository with optional session or use session factory."""
        self.db_session = db_session
        self._use_factory = db_session is None

        # Import session factory for on-demand session creation
        if self._use_factory:
            try:
                from src.config.database import AsyncSessionLocal
                self._session_factory = AsyncSessionLocal
                self._db_available = True
                logger.debug("Repository initialized with session factory")
            except Exception as e:
                logger.warning("Failed to import session factory", error=str(e))
                self._db_available = False
                self._session_factory = None
        else:
            self._session_factory = None
            self._db_available = True

    async def _get_session(self):
        """Get database session - either provided or create new one."""
        if self._use_factory and self._session_factory:
            return self._session_factory()
        return self.db_session

    async def save_pattern(self, pattern_data: dict[str, Any]) -> bool:
        """
        Save or update a learning pattern to database.

        Args:
            pattern_data: Pattern data dictionary

        Returns:
            True if saved successfully, False otherwise
        """
        if not self._db_available:
            logger.debug("Database not available, skipping pattern save")
            return False

        session = await self._get_session()
        if session is None:
            return False

        try:
            # Check if pattern exists
            result = await session.execute(
                select(DBLearningPattern).where(
                    DBLearningPattern.pattern_id == pattern_data["pattern_id"]
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                # Update existing pattern
                existing.observed_count = pattern_data["observed_count"]
                existing.success_rate = pattern_data["success_rate"]
                existing.avg_duration_ms = pattern_data["avg_duration_ms"]
                existing.confidence = pattern_data["confidence"]
                existing.last_observed = datetime.fromisoformat(pattern_data["last_observed"])
                existing.pattern_metadata = pattern_data.get("metadata", {})
                existing.conditions = pattern_data.get("conditions", {})
                existing.actions = pattern_data.get("actions", [])
                existing.outcomes = pattern_data.get("outcomes", {})
                logger.debug("Updated existing pattern", pattern_id=pattern_data["pattern_id"])
            else:
                # Create new pattern
                db_pattern = DBLearningPattern(
                    pattern_id=pattern_data["pattern_id"],
                    agent_id=pattern_data["agent_id"],
                    pattern_type=pattern_data["pattern_type"],
                    task_category=pattern_data["task_category"],
                    observed_count=pattern_data["observed_count"],
                    success_rate=pattern_data["success_rate"],
                    avg_duration_ms=pattern_data["avg_duration_ms"],
                    confidence=pattern_data["confidence"],
                    conditions=pattern_data.get("conditions", {}),
                    actions=pattern_data.get("actions", []),
                    outcomes=pattern_data.get("outcomes", {}),
                    pattern_metadata=pattern_data.get("metadata", {}),
                    first_observed=datetime.fromisoformat(pattern_data["first_observed"]),
                    last_observed=datetime.fromisoformat(pattern_data["last_observed"]),
                )
                session.add(db_pattern)
                logger.debug("Created new pattern", pattern_id=pattern_data["pattern_id"])

            await session.commit()

            # Close session if we created it
            if self._use_factory:
                await session.close()

            return True

        except Exception as e:
            logger.error("Failed to save pattern", error=str(e), pattern_id=pattern_data.get("pattern_id"))
            await session.rollback()

            # Close session if we created it
            if self._use_factory:
                await session.close()

            return False

    async def save_insight(self, insight_data: dict[str, Any]) -> bool:
        """
        Save a learning insight to database.

        Args:
            insight_data: Insight data dictionary

        Returns:
            True if saved successfully, False otherwise
        """
        if not self._db_available:
            logger.debug("Database not available, skipping insight save")
            return False

        try:
            # Check if insight exists
            result = await self.db_session.execute(
                select(DBLearningInsight).where(
                    DBLearningInsight.insight_id == insight_data["insight_id"]
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                logger.debug("Insight already exists, skipping", insight_id=insight_data["insight_id"])
                return True

            # Create new insight
            db_insight = DBLearningInsight(
                insight_id=insight_data["insight_id"],
                insight_type=insight_data["insight_type"],
                agent_id=insight_data["agent_id"],
                priority=insight_data["priority"],
                title=insight_data["title"],
                description=insight_data["description"],
                recommended_action=insight_data["recommended_action"],
                expected_improvement=insight_data["expected_improvement"],
                supporting_patterns=insight_data.get("supporting_patterns", []),
                created_at=datetime.fromisoformat(insight_data["created_at"]),
            )
            self.db_session.add(db_insight)
            await self.db_session.commit()

            logger.debug("Created new insight", insight_id=insight_data["insight_id"])
            return True

        except Exception as e:
            logger.error("Failed to save insight", error=str(e), insight_id=insight_data.get("insight_id"))
            await self.db_session.rollback()
            return False

    async def save_variant(self, variant_data: dict[str, Any]) -> bool:
        """
        Save or update a prompt variant to database.

        Args:
            variant_data: Variant data dictionary

        Returns:
            True if saved successfully, False otherwise
        """
        if not self._db_available:
            logger.debug("Database not available, skipping variant save")
            return False

        try:
            # Check if variant exists
            result = await self.db_session.execute(
                select(DBPromptVariant).where(
                    DBPromptVariant.variant_id == variant_data["variant_id"]
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                # Update existing variant
                existing.executions = variant_data["executions"]
                existing.success_count = variant_data["success_count"]
                existing.failure_count = variant_data["failure_count"]
                existing.avg_duration_ms = variant_data["avg_duration_ms"]
                existing.confidence_score = variant_data["confidence_score"]
                existing.is_active = variant_data["is_active"]
                if variant_data.get("last_used"):
                    existing.last_used = datetime.fromisoformat(variant_data["last_used"])
                logger.debug("Updated existing variant", variant_id=variant_data["variant_id"])
            else:
                # Create new variant
                db_variant = DBPromptVariant(
                    variant_id=variant_data["variant_id"],
                    agent_id=variant_data["agent_id"],
                    prompt_template=variant_data["prompt_template"],
                    version=variant_data["version"],
                    is_active=variant_data["is_active"],
                    executions=variant_data.get("executions", 0),
                    success_count=variant_data.get("success_count", 0),
                    failure_count=variant_data.get("failure_count", 0),
                    avg_duration_ms=variant_data.get("avg_duration_ms", 0.0),
                    confidence_score=variant_data.get("confidence_score", 0.5),
                    created_at=datetime.fromisoformat(variant_data["created_at"]),
                )
                self.db_session.add(db_variant)
                logger.debug("Created new variant", variant_id=variant_data["variant_id"])

            await self.db_session.commit()
            return True

        except Exception as e:
            logger.error("Failed to save variant", error=str(e), variant_id=variant_data.get("variant_id"))
            await self.db_session.rollback()
            return False

    async def load_patterns(self, agent_id: str | None = None) -> list[dict[str, Any]]:
        """
        Load patterns from database.

        Args:
            agent_id: Optional agent filter

        Returns:
            List of pattern dictionaries
        """
        if not self._db_available:
            return []

        session = await self._get_session()
        if session is None:
            return []

        try:
            query = select(DBLearningPattern)
            if agent_id:
                query = query.where(DBLearningPattern.agent_id == agent_id)

            result = await session.execute(query)
            patterns = result.scalars().all()

            result_patterns = [
                {
                    "pattern_id": p.pattern_id,
                    "agent_id": p.agent_id,
                    "pattern_type": p.pattern_type.value,
                    "task_category": p.task_category,
                    "observed_count": p.observed_count,
                    "success_rate": p.success_rate,
                    "avg_duration_ms": p.avg_duration_ms,
                    "confidence": p.confidence,
                    "conditions": p.conditions,
                    "actions": p.actions,
                    "outcomes": p.outcomes,
                    "metadata": p.pattern_metadata,
                    "first_observed": p.first_observed.isoformat(),
                    "last_observed": p.last_observed.isoformat(),
                }
                for p in patterns
            ]

            # Close session if we created it
            if self._use_factory:
                await session.close()

            return result_patterns

        except Exception as e:
            logger.error("Failed to load patterns", error=str(e))
            # Close session if we created it
            if self._use_factory:
                await session.close()
            return []

    async def load_insights(
        self, agent_id: str | None = None, priority: str | None = None
    ) -> list[dict[str, Any]]:
        """
        Load insights from database.

        Args:
            agent_id: Optional agent filter
            priority: Optional priority filter

        Returns:
            List of insight dictionaries
        """
        if not self._db_available:
            return []

        session = await self._get_session()
        if session is None:
            return []

        try:
            from sqlalchemy import cast, Text

            query = select(DBLearningInsight)
            if agent_id:
                query = query.where(DBLearningInsight.agent_id == agent_id)
            if priority:
                # Cast enum column to text for string comparison
                query = query.where(cast(DBLearningInsight.priority, Text) == priority)

            result = await session.execute(query)
            insights = result.scalars().all()

            result_insights = [
                {
                    "insight_id": i.insight_id,
                    "insight_type": i.insight_type.value,
                    "agent_id": i.agent_id,
                    "priority": i.priority.value,
                    "title": i.title,
                    "description": i.description,
                    "recommended_action": i.recommended_action,
                    "expected_improvement": i.expected_improvement,
                    "supporting_patterns": i.supporting_patterns,
                    "created_at": i.created_at.isoformat(),
                    "is_implemented": i.is_implemented,
                    "implemented_at": i.implemented_at.isoformat() if i.implemented_at else None,
                }
                for i in insights
            ]

            # Close session if we created it
            if self._use_factory:
                await session.close()

            return result_insights

        except Exception as e:
            logger.error("Failed to load insights", error=str(e))
            # Close session if we created it
            if self._use_factory:
                await session.close()
            return []
