"""SQLAlchemy models for AI learning engine persistence."""

import enum
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from .models import Base


class PatternType(str, enum.Enum):
    """Pattern type enum."""

    SUCCESS = "success"
    FAILURE = "failure"
    OPTIMIZATION = "optimization"


class InsightType(str, enum.Enum):
    """Insight type enum."""

    PROMPT_IMPROVEMENT = "prompt_improvement"
    PROCESS_OPTIMIZATION = "process_optimization"
    ERROR_PREVENTION = "error_prevention"


class InsightPriority(str, enum.Enum):
    """Insight priority enum."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class LearningPattern(Base):
    """Learned pattern from agent executions."""

    __tablename__ = "learning_patterns"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    pattern_id = Column(String(100), unique=True, nullable=False, index=True)
    agent_id = Column(String(100), nullable=False, index=True)
    pattern_type = Column(Enum(PatternType, values_callable=lambda obj: [e.value for e in obj]), nullable=False, index=True)
    task_category = Column(String(200), nullable=False)
    observed_count = Column(Integer, nullable=False, default=1)
    success_rate = Column(Float, nullable=False)
    avg_duration_ms = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False)

    # JSON fields
    conditions = Column(JSON, nullable=False, default=dict)
    actions = Column(JSON, nullable=False, default=list)
    outcomes = Column(JSON, nullable=False, default=dict)
    pattern_metadata = Column(JSON, nullable=False, default=dict)

    # Timestamps
    first_observed = Column(DateTime(timezone=True), nullable=False)
    last_observed = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC), onupdate=lambda: datetime.now(UTC))

    def __repr__(self) -> str:
        """String representation."""
        return f"<LearningPattern {self.pattern_id} ({self.pattern_type})>"


class LearningInsight(Base):
    """Actionable insight derived from learning patterns."""

    __tablename__ = "learning_insights"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    insight_id = Column(String(100), unique=True, nullable=False, index=True)
    insight_type = Column(Enum(InsightType, values_callable=lambda obj: [e.value for e in obj]), nullable=False, index=True)
    agent_id = Column(String(100), nullable=False, index=True)
    priority = Column(Enum(InsightPriority, values_callable=lambda obj: [e.value for e in obj]), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    recommended_action = Column(Text, nullable=False)
    expected_improvement = Column(Float, nullable=False)

    # JSON field for supporting patterns
    supporting_patterns = Column(JSON, nullable=False, default=list)

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))

    # Status tracking
    is_implemented = Column(Boolean, nullable=False, default=False)
    implemented_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        """String representation."""
        return f"<LearningInsight {self.insight_id} ({self.priority})>"


class PromptVariant(Base):
    """A variant of an agent prompt for A/B testing."""

    __tablename__ = "prompt_variants"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    variant_id = Column(String(100), unique=True, nullable=False, index=True)
    agent_id = Column(String(100), nullable=False, index=True)
    prompt_template = Column(Text, nullable=False)
    version = Column(Integer, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    # Performance metrics
    executions = Column(Integer, nullable=False, default=0)
    success_count = Column(Integer, nullable=False, default=0)
    failure_count = Column(Integer, nullable=False, default=0)
    avg_duration_ms = Column(Float, nullable=False, default=0.0)
    confidence_score = Column(Float, nullable=False, default=0.5)

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC))
    last_used = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        """String representation."""
        return f"<PromptVariant {self.variant_id} v{self.version}>"
