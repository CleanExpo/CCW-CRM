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
    """Rule governing when an agent can delegate tasks (Section 3).

    Defines which capabilities can be delegated and to which agents.
    """

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
    """Full agent manifest defining identity, capabilities, and boundaries (Section 1).

    The AgentCard is the structured declaration of what an agent is, what it can do,
    what it cannot do, and how it participates in the protocol.
    """

    agent_id: str = Field(description="Unique agent identifier")
    name: str = Field(description="Human-readable agent name")
    version: str = Field(default="1.0.0", description="Agent version")
    description: str = Field(default="", description="What this agent does")

    # Capabilities and boundaries
    capabilities: list[str] = Field(
        default_factory=list,
        description="What this agent can do",
    )
    boundaries: list[str] = Field(
        default_factory=list,
        description="What this agent cannot/should not do",
    )

    # Input/output schema descriptions
    inputs: dict[str, str] = Field(
        default_factory=dict,
        description="Expected inputs (key=name, value=description)",
    )
    outputs: dict[str, str] = Field(
        default_factory=dict,
        description="Expected outputs (key=name, value=description)",
    )

    # Delegation
    delegation_rules: list[DelegationRule] = Field(
        default_factory=list,
        description="Rules governing task delegation",
    )

    # Permissions
    permission_tier: PermissionTier = Field(
        default=PermissionTier.STANDARD,
        description="Permission level for this agent",
    )

    # Operational limits
    max_concurrent: int = Field(
        default=5,
        description="Maximum concurrent executions",
    )
    timeout_seconds: int = Field(
        default=120,
        description="Default execution timeout in seconds",
    )

    # Escalation configuration
    escalation_triggers: list["EscalationTrigger"] = Field(
        default_factory=list,
        description="Conditions that trigger escalation",
    )


# ─── Section 2: Agent Messages ────────────────────────────────────────────


class AgentMessage(BaseModel):
    """Structured inter-agent message (Section 2).

    All agent-to-agent communication uses this format for traceability,
    correlation tracking, and TTL enforcement.
    """

    message_id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Unique message identifier",
    )
    correlation_id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Traces the full request chain across agents",
    )
    sender_id: str = Field(description="ID of the sending agent")
    recipient_id: str = Field(description="ID of the receiving agent")
    message_type: MessageType = Field(description="Type of message")
    payload: dict[str, Any] = Field(
        default_factory=dict,
        description="Message payload data",
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When the message was created",
    )
    priority: Priority = Field(
        default=Priority.NORMAL,
        description="Message priority",
    )
    ttl_seconds: int | None = Field(
        default=None,
        description="Time-to-live in seconds (None = no expiry)",
    )


# ─── Section 3: Delegation ────────────────────────────────────────────────


class DelegationRequest(BaseModel):
    """Formal delegation request between agents (Section 3).

    Encapsulates the 5 delegation requirements:
    1. Sender has delegation permission
    2. Recipient has required capabilities
    3. No circular delegation (chain check)
    4. Recipient within capacity
    5. Timeout within bounds
    """

    delegator_id: str = Field(description="Agent requesting delegation")
    delegate_id: str = Field(description="Target agent for delegation")
    task: str = Field(description="Task to be delegated")
    context: dict[str, Any] = Field(
        default_factory=dict,
        description="Execution context for the delegated task",
    )
    required_capabilities: list[str] = Field(
        default_factory=list,
        description="Capabilities needed to execute the task",
    )
    timeout_seconds: int = Field(
        default=120,
        description="Timeout for the delegated task",
    )
    fallback_agent_id: str | None = Field(
        default=None,
        description="Agent to use if primary delegate fails",
    )
    chain: list[str] = Field(
        default_factory=list,
        description="Delegation chain for loop detection",
    )


# ─── Section 4: Escalation ────────────────────────────────────────────────


class EscalationTrigger(BaseModel):
    """Condition that triggers escalation to a higher authority (Section 4).

    When an agent detects one of these conditions, it escalates the task
    rather than attempting further processing.
    """

    trigger_type: EscalationTriggerType = Field(
        description="Type of escalation trigger",
    )
    threshold: float = Field(
        default=0.5,
        description="Threshold value for the trigger (meaning varies by type)",
    )
    description: str = Field(
        default="",
        description="Human-readable description of this trigger",
    )


# ─── Section 5: Handoff ──────────────────────────────────────────────────


class HandoffPackage(BaseModel):
    """Context package for agent-to-agent handoff (Section 5).

    When one agent transfers a task to another, this package ensures
    all necessary context, progress, and artifacts are preserved.
    """

    source_agent_id: str = Field(description="Agent handing off")
    target_agent_id: str = Field(description="Agent receiving handoff")
    task_summary: str = Field(description="Summary of the task being handed off")
    context: dict[str, Any] = Field(
        default_factory=dict,
        description="Full execution context",
    )
    progress: dict[str, Any] = Field(
        default_factory=dict,
        description="Progress made so far (steps completed, partial results)",
    )
    artifacts: list[str] = Field(
        default_factory=list,
        description="References to outputs produced so far",
    )
    reason: str = Field(
        default="",
        description="Why the handoff is occurring",
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When the handoff was created",
    )


# ─── Section 7: Error Classification ─────────────────────────────────────


class ErrorClassification(BaseModel):
    """Structured error classification with retry policy (Section 7).

    Provides consistent error handling across all agents with
    automatic retry logic based on error type.
    """

    error_type: ErrorType = Field(description="Classification of the error")
    severity: Severity = Field(
        default=Severity.MEDIUM,
        description="Error severity level",
    )
    retryable: bool = Field(
        default=False,
        description="Whether this error can be retried",
    )
    max_retries: int = Field(
        default=0,
        description="Maximum number of retry attempts",
    )
    backoff_strategy: str = Field(
        default="none",
        description="Backoff strategy: none, linear, exponential",
    )
    message: str = Field(description="Human-readable error message")
    agent_id: str | None = Field(
        default=None,
        description="Agent that encountered the error",
    )
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When the error occurred",
    )


# ─── Section 8: Confidence Scoring ───────────────────────────────────────


class ConfidenceScore(BaseModel):
    """Output confidence score with reasoning (Section 8).

    Agents attach confidence scores to their outputs to help
    downstream consumers and the escalation system make decisions.
    """

    score: float = Field(
        ge=0.0,
        le=1.0,
        description="Confidence score from 0.0 (no confidence) to 1.0 (full confidence)",
    )
    reasoning: str = Field(
        default="",
        description="Explanation of the confidence score",
    )
    factors: dict[str, float] = Field(
        default_factory=dict,
        description="Individual factor scores that contributed to the overall score",
    )


# ─── Section 13: Protocol Versioning ─────────────────────────────────────


class ProtocolVersion(BaseModel):
    """Protocol version tracking (Section 13).

    Enables protocol evolution while maintaining backward compatibility.
    """

    major: int = Field(default=1, description="Major version (breaking changes)")
    minor: int = Field(default=0, description="Minor version (new features)")
    patch: int = Field(default=0, description="Patch version (bug fixes)")

    def __str__(self) -> str:
        """Format as semver string."""
        return f"{self.major}.{self.minor}.{self.patch}"

    @classmethod
    def current(cls) -> "ProtocolVersion":
        """Get the current protocol version."""
        return cls(major=1, minor=0, patch=0)


# Update forward references
AgentCard.model_rebuild()
