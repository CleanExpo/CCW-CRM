"""Agents Protocol v1.0 — Core Pydantic models.

Defines all structured types for the protocol:
- Agent Identity (AgentCard)
- Communication (AgentMessage)
- Delegation (DelegationRequest, DelegationRule)
- Escalation (EscalationTrigger)
- Handoff (HandoffPackage)
- Permissions (PermissionTier)
- Error Handling (ErrorClassification)
- Quality (ConfidenceScore)
- Versioning (ProtocolVersion)
"""

from datetime import UTC, datetime
from enum import Enum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field

# ─── Section 6: Permission Tiers ───────────────────────────────────────────


class PermissionTier(str, Enum):
    """Permission tier for agent actions (Section 6).

    Defines what level of access an agent has:
    - READ_ONLY: Can read data, cannot modify anything
    - STANDARD: Can read and perform non-destructive operations
    - ELEVATED: Can perform state-changing operations (create, update)
    - ADMIN: Full access including destructive operations (delete, config changes)
    """

    READ_ONLY = "read_only"
    STANDARD = "standard"
    ELEVATED = "elevated"
    ADMIN = "admin"


# ─── Section 2: Message Types ──────────────────────────────────────────────


class MessageType(str, Enum):
    """Types of inter-agent messages (Section 2)."""

    REQUEST = "request"
    RESPONSE = "response"
    NOTIFICATION = "notification"
    ESCALATION = "escalation"
    HANDOFF = "handoff"


class Priority(str, Enum):
    """Message priority levels (Section 2)."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


# ─── Section 4: Escalation Triggers ───────────────────────────────────────


class EscalationTriggerType(str, Enum):
    """Types of conditions that trigger escalation (Section 4)."""

    CONFIDENCE_LOW = "confidence_low"
    TIMEOUT = "timeout"
    ERROR_THRESHOLD = "error_threshold"
    CAPABILITY_MISSING = "capability_missing"
    HUMAN_REQUIRED = "human_required"


# ─── Section 7: Error Types ───────────────────────────────────────────────


class ErrorType(str, Enum):
    """Classification of error types (Section 7)."""

    TRANSIENT = "transient"  # Temporary, likely to resolve on retry
    PERMANENT = "permanent"  # Will not resolve on retry
    CAPACITY = "capacity"  # Agent at capacity, retry later
    PERMISSION = "permission"  # Insufficient permissions
    TIMEOUT = "timeout"  # Operation timed out
    DATA_QUALITY = "data_quality"  # Input data issues


class Severity(str, Enum):
    """Error severity levels (Section 7)."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ─── Section 3: Delegation Rules ──────────────────────────────────────────


class DelegationRule(BaseModel):
    """Rule governing when an agent can delegate tasks (Section 3)."""

    capability: str = Field(description="Capability being delegated")
    allowed_delegates: list[str] = Field(
        default_factory=list,
        description="Agent IDs allowed to receive delegation (empty = any)",
    )
    requires_approval: bool = Field(
        default=False,
        description="Whether delegation requires human approval",
    )
    max_chain_depth: int = Field(
        default=3,
        description="Maximum delegation chain depth",
    )


# ─── Section 1: Agent Identity ────────────────────────────────────────────


class AgentCard(BaseModel):
    """Full agent manifest defining identity, capabilities, and boundaries (Section 1)."""

    agent_id: str = Field(description="Unique agent identifier")
    name: str = Field(description="Human-readable agent name")
    version: str = Field(default="1.0.0", description="Agent version")
    description: str = Field(default="", description="What this agent does")

    capabilities: list[str] = Field(default_factory=list)
    boundaries: list[str] = Field(default_factory=list)

    inputs: dict[str, str] = Field(default_factory=dict)
    outputs: dict[str, str] = Field(default_factory=dict)

    delegation_rules: list[DelegationRule] = Field(default_factory=list)
    permission_tier: PermissionTier = Field(default=PermissionTier.STANDARD)

    max_concurrent: int = Field(default=5)
    timeout_seconds: int = Field(default=120)

    escalation_triggers: list["EscalationTrigger"] = Field(default_factory=list)


# ─── Section 2: Agent Messages ────────────────────────────────────────────


class AgentMessage(BaseModel):
    """Structured inter-agent message (Section 2)."""

    message_id: str = Field(default_factory=lambda: str(uuid4()))
    correlation_id: str = Field(default_factory=lambda: str(uuid4()))
    sender_id: str = Field(description="ID of the sending agent")
    recipient_id: str = Field(description="ID of the receiving agent")
    message_type: MessageType = Field(description="Type of message")
    payload: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    priority: Priority = Field(default=Priority.NORMAL)
    ttl_seconds: int | None = Field(default=None)


# ─── Section 3: Delegation ────────────────────────────────────────────────


class DelegationRequest(BaseModel):
    """Formal delegation request between agents (Section 3)."""

    delegator_id: str = Field(description="Agent requesting delegation")
    delegate_id: str = Field(description="Target agent for delegation")
    task: str = Field(description="Task to be delegated")
    context: dict[str, Any] = Field(default_factory=dict)
    required_capabilities: list[str] = Field(default_factory=list)
    timeout_seconds: int = Field(default=120)
    fallback_agent_id: str | None = Field(default=None)
    chain: list[str] = Field(default_factory=list)


# ─── Section 4: Escalation ────────────────────────────────────────────────


class EscalationTrigger(BaseModel):
    """Condition that triggers escalation (Section 4)."""

    trigger_type: EscalationTriggerType = Field(description="Type of escalation trigger")
    threshold: float = Field(default=0.5)
    description: str = Field(default="")


# ─── Section 5: Handoff ──────────────────────────────────────────────────


class HandoffPackage(BaseModel):
    """Context package for agent-to-agent handoff (Section 5)."""

    source_agent_id: str = Field(description="Agent handing off")
    target_agent_id: str = Field(description="Agent receiving handoff")
    task_summary: str = Field(description="Summary of the task")
    context: dict[str, Any] = Field(default_factory=dict)
    progress: dict[str, Any] = Field(default_factory=dict)
    artifacts: list[str] = Field(default_factory=list)
    reason: str = Field(default="")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ─── Section 7: Error Classification ─────────────────────────────────────


class ErrorClassification(BaseModel):
    """Structured error classification with retry policy (Section 7)."""

    error_type: ErrorType = Field(description="Classification of the error")
    severity: Severity = Field(default=Severity.MEDIUM)
    retryable: bool = Field(default=False)
    max_retries: int = Field(default=0)
    backoff_strategy: str = Field(default="none")
    message: str = Field(description="Human-readable error message")
    agent_id: str | None = Field(default=None)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ─── Section 8: Confidence Scoring ───────────────────────────────────────


class ConfidenceScore(BaseModel):
    """Output confidence score with reasoning (Section 8)."""

    score: float = Field(ge=0.0, le=1.0)
    reasoning: str = Field(default="")
    factors: dict[str, float] = Field(default_factory=dict)


# ─── Section 13: Protocol Versioning ─────────────────────────────────────


class ProtocolVersion(BaseModel):
    """Protocol version tracking (Section 13)."""

    major: int = Field(default=1)
    minor: int = Field(default=0)
    patch: int = Field(default=0)

    def __str__(self) -> str:
        return f"{self.major}.{self.minor}.{self.patch}"

    @classmethod
    def current(cls) -> "ProtocolVersion":
        return cls(major=1, minor=0, patch=0)


# Update forward references
AgentCard.model_rebuild()
