"""Agent autonomy level models and configuration."""

from datetime import UTC, datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class AutonomyLevel(str, Enum):
    """Agent autonomy levels determining execution behavior.

    - ADVISORY: Agent only provides recommendations, no auto-execution
    - SEMI_AUTONOMOUS: Agent can auto-execute low-risk actions, requires approval for high-risk
    - FULLY_AUTONOMOUS: Agent can execute all actions autonomously within configured limits
    """

    ADVISORY = "advisory"
    SEMI_AUTONOMOUS = "semi_autonomous"
    FULLY_AUTONOMOUS = "fully_autonomous"


class RiskLevel(str, Enum):
    """Risk level for agent actions."""

    LOW = "low"  # e.g., data retrieval, analysis, reporting
    MEDIUM = "medium"  # e.g., reorder suggestions under threshold
    HIGH = "high"  # e.g., purchase orders over threshold, bulk operations


class DecisionStatus(str, Enum):
    """Status of agent decisions."""

    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    AUTO_EXECUTED = "auto_executed"
    REJECTED = "rejected"
    EXPIRED = "expired"


class AgentAutonomyConfig(BaseModel):
    """Configuration for agent autonomy settings."""

    agent_id: str
    autonomy_level: AutonomyLevel = Field(default=AutonomyLevel.ADVISORY)

    # Confidence thresholds for auto-execution (0.0 - 1.0)
    min_confidence_low_risk: float = Field(default=0.7, ge=0.0, le=1.0)
    min_confidence_medium_risk: float = Field(default=0.85, ge=0.0, le=1.0)
    min_confidence_high_risk: float = Field(default=0.95, ge=0.0, le=1.0)

    # Value thresholds for auto-execution
    max_auto_approval_amount: float = Field(default=1000.0, description="Max $ amount for auto-approval")
    max_auto_approval_quantity: int = Field(default=100, description="Max quantity for auto-approval")

    # Rate limiting
    max_actions_per_hour: int = Field(default=10, description="Max autonomous actions per hour")
    max_actions_per_day: int = Field(default=50, description="Max autonomous actions per day")

    # Learning settings
    learning_enabled: bool = Field(default=True, description="Enable learning from outcomes")
    feedback_retention_days: int = Field(default=90, description="Days to retain feedback data")

    # Notification settings
    notify_on_execution: bool = Field(default=True, description="Send notification after auto-execution")
    notify_on_pending: bool = Field(default=True, description="Send notification when approval needed")

    # Emergency controls
    enabled: bool = Field(default=True, description="Master enable/disable switch")
    pause_until: datetime | None = Field(default=None, description="Temporary pause until timestamp")

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_by: UUID | None = None

    class Config:
        """Pydantic config."""

        json_schema_extra = {
            "example": {
                "agent_id": "procurement_agent",
                "autonomy_level": "semi_autonomous",
                "min_confidence_low_risk": 0.7,
                "min_confidence_medium_risk": 0.85,
                "min_confidence_high_risk": 0.95,
                "max_auto_approval_amount": 1000.0,
                "max_auto_approval_quantity": 100,
                "max_actions_per_hour": 10,
                "enabled": True,
            }
        }


class AgentDecision(BaseModel):
    """Record of an agent decision and its execution status."""

    decision_id: str = Field(default_factory=lambda: str(uuid4()))
    agent_id: str
    decision_type: str = Field(description="Type of decision (e.g., 'purchase_order', 'inventory_adjustment')")

    # Decision details
    recommendation: dict[str, Any] = Field(description="Agent's recommendation")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score 0.0-1.0")
    risk_level: RiskLevel = Field(description="Risk level of this decision")
    context: dict[str, Any] = Field(default_factory=dict, description="Contextual information")

    # Execution control
    autonomy_level: AutonomyLevel = Field(description="Autonomy level when decision was made")
    status: DecisionStatus = Field(default=DecisionStatus.PENDING_APPROVAL)
    requires_approval: bool = Field(description="Whether approval is required")

    # Approval workflow
    approved_by: UUID | None = None
    approved_at: datetime | None = None
    rejected_by: UUID | None = None
    rejected_at: datetime | None = None
    rejection_reason: str | None = None

    # Execution outcome
    executed: bool = Field(default=False)
    executed_at: datetime | None = None
    execution_result: dict[str, Any] | None = None
    execution_error: str | None = None

    # Learning feedback
    outcome_success: bool | None = Field(default=None, description="Was outcome successful (for learning)")
    outcome_metrics: dict[str, Any] | None = Field(default=None, description="Metrics for learning")
    human_feedback: str | None = Field(default=None, description="Human feedback on decision")
    feedback_rating: int | None = Field(default=None, ge=1, le=5, description="1-5 star rating")

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime | None = Field(default=None, description="When pending approval expires")

    class Config:
        """Pydantic config."""

        json_schema_extra = {
            "example": {
                "decision_id": "dec-123",
                "agent_id": "procurement_agent",
                "decision_type": "purchase_order",
                "recommendation": {
                    "action": "create_purchase_order",
                    "supplier": "ACME Corp",
                    "product": "Widget A",
                    "quantity": 50,
                    "estimated_cost": 500.0,
                },
                "confidence": 0.92,
                "risk_level": "medium",
                "autonomy_level": "semi_autonomous",
                "status": "pending_approval",
                "requires_approval": True,
            }
        }


class AutonomyStats(BaseModel):
    """Statistics for agent autonomy performance."""

    agent_id: str
    time_period: str = Field(description="e.g., 'last_24h', 'last_7d', 'last_30d'")

    # Execution stats
    total_decisions: int = 0
    auto_executed: int = 0
    pending_approval: int = 0
    approved_by_human: int = 0
    rejected_by_human: int = 0

    # Performance metrics
    average_confidence: float = 0.0
    success_rate: float = 0.0  # % of executed decisions that were successful
    approval_rate: float = 0.0  # % of pending decisions that were approved
    average_response_time_seconds: float = 0.0

    # Financial impact
    total_value_processed: float = 0.0
    total_value_auto_executed: float = 0.0

    # Risk distribution
    low_risk_decisions: int = 0
    medium_risk_decisions: int = 0
    high_risk_decisions: int = 0


class DecisionFilter(BaseModel):
    """Filters for querying agent decisions."""

    agent_ids: list[str] | None = None
    statuses: list[DecisionStatus] | None = None
    risk_levels: list[RiskLevel] | None = None
    decision_types: list[str] | None = None
    min_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    max_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    created_after: datetime | None = None
    created_before: datetime | None = None
    limit: int = Field(default=100, ge=1, le=1000)
    offset: int = Field(default=0, ge=0)
