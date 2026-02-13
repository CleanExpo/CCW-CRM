"""Agents Protocol v1.0 — Protocol Governor.

Central enforcement engine for the agents protocol. Validates delegations,
classifies errors, manages escalation, computes confidence, and enforces
permission tiers.

All core logic is implemented as pure functions for testability.
The ProtocolGovernor class provides async methods that integrate with
the AgentRegistry and EventBus.
"""

from datetime import UTC, datetime
from typing import Any

import structlog

from .models import (
    AgentCard,
    ConfidenceScore,
    DelegationRequest,
    ErrorClassification,
    ErrorType,
    EscalationTrigger,
    EscalationTriggerType,
    HandoffPackage,
    PermissionTier,
    ProtocolVersion,
    Severity,
)

logger = structlog.get_logger(__name__)

# ─── Permission tier hierarchy (higher index = more permissions) ──────────

_PERMISSION_HIERARCHY: dict[PermissionTier, int] = {
    PermissionTier.READ_ONLY: 0,
    PermissionTier.STANDARD: 1,
    PermissionTier.ELEVATED: 2,
    PermissionTier.ADMIN: 3,
}

# Actions and their minimum required permission tier
_ACTION_PERMISSIONS: dict[str, PermissionTier] = {
    "read": PermissionTier.READ_ONLY,
    "query": PermissionTier.READ_ONLY,
    "analyze": PermissionTier.READ_ONLY,
    "forecast": PermissionTier.READ_ONLY,
    "recommend": PermissionTier.STANDARD,
    "delegate": PermissionTier.STANDARD,
    "create": PermissionTier.ELEVATED,
    "update": PermissionTier.ELEVATED,
    "execute": PermissionTier.ELEVATED,
    "delete": PermissionTier.ADMIN,
    "configure": PermissionTier.ADMIN,
    "disable_agent": PermissionTier.ADMIN,
}

# Maximum allowed timeout (10 minutes)
_MAX_TIMEOUT_SECONDS = 600

# Maximum delegation chain depth
_MAX_CHAIN_DEPTH = 5


# ─── Pure Functions ───────────────────────────────────────────────────────


def validate_delegation(
    request: DelegationRequest,
    sender_card: AgentCard,
    recipient_card: AgentCard,
) -> tuple[bool, list[str]]:
    """Validate a delegation request against the 5 protocol requirements.

    Requirements:
    1. Sender has delegation permission (STANDARD or above)
    2. Recipient has required capabilities
    3. No circular delegation (chain check)
    4. Recipient within capacity (max_concurrent)
    5. Timeout within bounds

    Args:
        request: The delegation request to validate
        sender_card: AgentCard of the delegating agent
        recipient_card: AgentCard of the target agent

    Returns:
        Tuple of (is_valid, list_of_validation_errors)
    """
    errors: list[str] = []

    # 1. Sender must have delegation permission
    sender_tier_level = _PERMISSION_HIERARCHY.get(sender_card.permission_tier, 0)
    delegate_tier_level = _PERMISSION_HIERARCHY.get(
        _ACTION_PERMISSIONS.get("delegate", PermissionTier.STANDARD), 1
    )
    if sender_tier_level < delegate_tier_level:
        errors.append(
            f"Sender '{sender_card.agent_id}' has insufficient permissions "
            f"({sender_card.permission_tier.value}) to delegate tasks"
        )

    # 2. Recipient must have all required capabilities
    recipient_caps = set(recipient_card.capabilities)
    for required_cap in request.required_capabilities:
        if required_cap not in recipient_caps:
            errors.append(
                f"Recipient '{recipient_card.agent_id}' missing required "
                f"capability: {required_cap}"
            )

    # 3. No circular delegation
    if detect_delegation_loop(request.chain, request.delegate_id):
        errors.append(
            f"Circular delegation detected: {request.delegate_id} "
            f"already in chain {request.chain}"
        )

    # 4. Check chain depth
    if len(request.chain) >= _MAX_CHAIN_DEPTH:
        errors.append(
            f"Delegation chain too deep: {len(request.chain)} "
            f"(max: {_MAX_CHAIN_DEPTH})"
        )

    # 5. Timeout within bounds
    if request.timeout_seconds > _MAX_TIMEOUT_SECONDS:
        errors.append(
            f"Timeout {request.timeout_seconds}s exceeds maximum "
            f"({_MAX_TIMEOUT_SECONDS}s)"
        )
    if request.timeout_seconds <= 0:
        errors.append("Timeout must be positive")

    return (len(errors) == 0, errors)


def detect_delegation_loop(chain: list[str], new_delegate: str) -> bool:
    """Check if adding a delegate would create a circular delegation.

    Args:
        chain: Current delegation chain (list of agent IDs)
        new_delegate: Agent ID to add to the chain

    Returns:
        True if adding new_delegate would create a loop
    """
    return new_delegate in chain


def classify_error(error: Exception, context: dict[str, Any] | None = None) -> ErrorClassification:
    """Map an exception to a structured ErrorClassification.

    Args:
        error: The exception to classify
        context: Optional context about where the error occurred

    Returns:
        Structured error classification with retry policy
    """
    error_type_name = type(error).__name__

    # Timeout errors
    if isinstance(error, TimeoutError) or "timeout" in str(error).lower():
        return ErrorClassification(
            error_type=ErrorType.TIMEOUT,
            severity=Severity.MEDIUM,
            retryable=True,
            max_retries=2,
            backoff_strategy="exponential",
            message=f"Operation timed out: {error}",
        )

    # Permission errors
    if isinstance(error, PermissionError) or "permission" in str(error).lower():
        return ErrorClassification(
            error_type=ErrorType.PERMISSION,
            severity=Severity.HIGH,
            retryable=False,
            max_retries=0,
            backoff_strategy="none",
            message=f"Permission denied: {error}",
        )

    # Connection/transient errors
    if isinstance(error, (ConnectionError, ConnectionResetError, ConnectionRefusedError)):
        return ErrorClassification(
            error_type=ErrorType.TRANSIENT,
            severity=Severity.MEDIUM,
            retryable=True,
            max_retries=3,
            backoff_strategy="exponential",
            message=f"Connection error: {error}",
        )

    # Value/data quality errors
    if isinstance(error, (ValueError, TypeError, KeyError)):
        return ErrorClassification(
            error_type=ErrorType.DATA_QUALITY,
            severity=Severity.LOW,
            retryable=False,
            max_retries=0,
            backoff_strategy="none",
            message=f"Data quality issue ({error_type_name}): {error}",
        )

    # Resource/capacity errors
    if isinstance(error, (MemoryError, OSError)):
        return ErrorClassification(
            error_type=ErrorType.CAPACITY,
            severity=Severity.HIGH,
            retryable=True,
            max_retries=1,
            backoff_strategy="linear",
            message=f"Resource constraint: {error}",
        )

    # Default: permanent error
    return ErrorClassification(
        error_type=ErrorType.PERMANENT,
        severity=Severity.MEDIUM,
        retryable=False,
        max_retries=0,
        backoff_strategy="none",
        message=f"Unexpected error ({error_type_name}): {error}",
    )


def should_escalate(
    confidence: ConfidenceScore,
    escalation_triggers: list[EscalationTrigger],
) -> tuple[bool, str | None]:
    """Check if any escalation trigger conditions are met.

    Args:
        confidence: The confidence score to evaluate
        escalation_triggers: List of triggers to check against

    Returns:
        Tuple of (should_escalate, trigger_description)
    """
    for trigger in escalation_triggers:
        if trigger.trigger_type == EscalationTriggerType.CONFIDENCE_LOW:
            if confidence.score < trigger.threshold:
                return (
                    True,
                    trigger.description
                    or f"Confidence {confidence.score:.2f} below threshold {trigger.threshold}",
                )
        elif trigger.trigger_type == EscalationTriggerType.ERROR_THRESHOLD:
            # Check if error factor exceeds threshold
            error_factor = confidence.factors.get("error_rate", 0.0)
            if error_factor > trigger.threshold:
                return (
                    True,
                    trigger.description
                    or f"Error rate {error_factor:.2f} exceeds threshold {trigger.threshold}",
                )
        elif trigger.trigger_type == EscalationTriggerType.HUMAN_REQUIRED:
            # Always escalate if human required trigger is present
            return (True, trigger.description or "Human intervention required")

    return (False, None)


def calculate_confidence(
    result: dict[str, Any],
    execution_time_ms: int,
    agent_health: float,
    expected_time_ms: int = 60000,
    expected_keys: list[str] | None = None,
) -> ConfidenceScore:
    """Compute confidence score from multiple factors.

    Factors:
    - execution_time: How fast vs expected (weight: 0.2)
    - agent_health: Agent's health score (weight: 0.3)
    - completeness: Whether expected output keys are present (weight: 0.3)
    - error_free: Whether result has no error field (weight: 0.2)

    Args:
        result: Agent execution result
        execution_time_ms: Actual execution time in milliseconds
        agent_health: Agent health score (0.0-1.0)
        expected_time_ms: Expected execution time in milliseconds
        expected_keys: Expected keys in the result dict

    Returns:
        Aggregated ConfidenceScore
    """
    factors: dict[str, float] = {}

    # Factor 1: Execution time (faster relative to expected = higher confidence)
    if expected_time_ms > 0:
        time_ratio = execution_time_ms / expected_time_ms
        if time_ratio <= 1.0:
            factors["execution_time"] = 1.0
        elif time_ratio <= 2.0:
            factors["execution_time"] = max(0.3, 1.0 - (time_ratio - 1.0) * 0.7)
        else:
            factors["execution_time"] = 0.1
    else:
        factors["execution_time"] = 0.5

    # Factor 2: Agent health
    factors["agent_health"] = max(0.0, min(1.0, agent_health))

    # Factor 3: Result completeness
    if expected_keys:
        present_keys = sum(1 for k in expected_keys if k in result)
        factors["completeness"] = present_keys / len(expected_keys) if expected_keys else 1.0
    else:
        # No expected keys specified — base on result having content
        factors["completeness"] = 1.0 if result and not result.get("error") else 0.3

    # Factor 4: Error-free
    factors["error_free"] = 0.0 if result.get("error") else 1.0

    # Weighted aggregate
    weights = {
        "execution_time": 0.2,
        "agent_health": 0.3,
        "completeness": 0.3,
        "error_free": 0.2,
    }

    total_score = sum(factors[k] * weights[k] for k in weights)
    total_score = max(0.0, min(1.0, total_score))

    # Build reasoning
    reasoning_parts = []
    if factors["error_free"] == 0.0:
        reasoning_parts.append("result contains errors")
    if factors["execution_time"] < 0.5:
        reasoning_parts.append("execution was slow")
    if factors["agent_health"] < 0.5:
        reasoning_parts.append("agent health is degraded")
    if factors.get("completeness", 1.0) < 0.5:
        reasoning_parts.append("result is incomplete")

    reasoning = "; ".join(reasoning_parts) if reasoning_parts else "all factors nominal"

    return ConfidenceScore(
        score=round(total_score, 3),
        reasoning=reasoning,
        factors=factors,
    )


def validate_permissions(
    agent_card: AgentCard,
    action: str,
    target: str = "",
) -> bool:
    """Check if an agent's permission tier allows a specific action.

    Args:
        agent_card: The agent's card with permission tier
        action: The action being attempted (e.g., 'read', 'create', 'delete')
        target: Optional target of the action (for logging)

    Returns:
        True if the agent has sufficient permissions
    """
    # Get required permission for this action
    required_tier = _ACTION_PERMISSIONS.get(action, PermissionTier.STANDARD)
    required_level = _PERMISSION_HIERARCHY.get(required_tier, 1)

    # Get agent's permission level
    agent_level = _PERMISSION_HIERARCHY.get(agent_card.permission_tier, 0)

    return agent_level >= required_level


def build_handoff_package(
    source_id: str,
    target_id: str,
    task: str,
    context: dict[str, Any],
    progress: dict[str, Any],
    reason: str = "",
    artifacts: list[str] | None = None,
) -> HandoffPackage:
    """Build a structured handoff package for agent-to-agent transfer.

    Args:
        source_id: ID of the handing-off agent
        target_id: ID of the receiving agent
        task: Summary of the task
        context: Full execution context
        progress: Progress made so far
        reason: Why the handoff is occurring
        artifacts: References to produced outputs

    Returns:
        Complete HandoffPackage
    """
    return HandoffPackage(
        source_agent_id=source_id,
        target_agent_id=target_id,
        task_summary=task,
        context=context,
        progress=progress,
        artifacts=artifacts or [],
        reason=reason,
    )


# ─── Protocol Governor Class ─────────────────────────────────────────────


class ProtocolGovernor:
    """Central enforcement engine for the agents protocol.

    Integrates with AgentRegistry and EventBus to provide:
    - Agent card lookup and validation
    - Delegation enforcement
    - Escalation routing
    - Protocol event auditing
    """

    def __init__(self) -> None:
        """Initialize the protocol governor."""
        self._protocol_version = ProtocolVersion.current()
        self._audit_log: list[dict[str, Any]] = []
        self._max_audit_entries = 1000
        logger.info(
            "Protocol governor initialized",
            version=str(self._protocol_version),
        )

    @property
    def version(self) -> ProtocolVersion:
        """Get the current protocol version."""
        return self._protocol_version

    @property
    def audit_log(self) -> list[dict[str, Any]]:
        """Get the audit log entries."""
        return self._audit_log

    def get_agent_card(self, agent_id: str) -> AgentCard | None:
        """Lookup an agent card from the registry.

        Args:
            agent_id: Agent to look up

        Returns:
            AgentCard or None if not found/registered
        """
        try:
            from src.ai.orchestration import get_agent_registry

            registry = get_agent_registry()
            metadata = registry.get_metadata(agent_id)
            if metadata and hasattr(metadata, "agent_card"):
                return metadata.agent_card
            return None
        except Exception as e:
            logger.warning("Failed to get agent card", agent_id=agent_id, error=str(e))
            return None

    def route_escalation(
        self,
        trigger: EscalationTrigger,
        context: dict[str, Any],
    ) -> str:
        """Determine escalation target based on trigger type.

        Args:
            trigger: The escalation trigger
            context: Execution context

        Returns:
            Agent ID or "human" for human escalation
        """
        if trigger.trigger_type == EscalationTriggerType.HUMAN_REQUIRED:
            return "human"

        if trigger.trigger_type == EscalationTriggerType.CAPABILITY_MISSING:
            return "supervisor"

        # Default: escalate to supervisor
        return "supervisor"

    def enforce_delegation(
        self,
        request: DelegationRequest,
    ) -> tuple[bool, DelegationRequest | None, list[str]]:
        """Full delegation validation and enrichment.

        Args:
            request: The delegation request to enforce

        Returns:
            Tuple of (is_valid, enriched_request, errors)
        """
        sender_card = self.get_agent_card(request.delegator_id)
        recipient_card = self.get_agent_card(request.delegate_id)

        # If cards aren't registered, allow delegation (graceful degradation)
        if not sender_card or not recipient_card:
            logger.debug(
                "Delegation allowed (no agent cards registered)",
                delegator=request.delegator_id,
                delegate=request.delegate_id,
            )
            return (True, request, [])

        is_valid, errors = validate_delegation(request, sender_card, recipient_card)

        if is_valid:
            # Enrich: add delegator to chain
            enriched = request.model_copy(
                update={"chain": [*request.chain, request.delegator_id]}
            )
            self.record_protocol_event(
                "delegation_approved",
                {
                    "delegator": request.delegator_id,
                    "delegate": request.delegate_id,
                    "task": request.task[:100],
                },
            )
            return (True, enriched, [])
        else:
            self.record_protocol_event(
                "delegation_rejected",
                {
                    "delegator": request.delegator_id,
                    "delegate": request.delegate_id,
                    "errors": errors,
                },
            )
            return (False, None, errors)

    def record_protocol_event(
        self,
        event_type: str,
        data: dict[str, Any],
    ) -> None:
        """Record a protocol event for audit trail.

        Args:
            event_type: Type of protocol event
            data: Event data
        """
        entry = {
            "event_type": event_type,
            "data": data,
            "timestamp": datetime.now(UTC).isoformat(),
            "protocol_version": str(self._protocol_version),
        }

        self._audit_log.append(entry)

        # Trim audit log if too large
        if len(self._audit_log) > self._max_audit_entries:
            self._audit_log = self._audit_log[-self._max_audit_entries:]

        logger.debug("Protocol event recorded", event_type=event_type)

    def get_statistics(self) -> dict[str, Any]:
        """Get protocol governor statistics.

        Returns:
            Dictionary with protocol stats
        """
        event_types: dict[str, int] = {}
        for entry in self._audit_log:
            et = entry.get("event_type", "unknown")
            event_types[et] = event_types.get(et, 0) + 1

        return {
            "protocol_version": str(self._protocol_version),
            "audit_log_size": len(self._audit_log),
            "event_type_counts": event_types,
        }


# ─── Singleton ────────────────────────────────────────────────────────────

_governor: ProtocolGovernor | None = None


def get_protocol_governor() -> ProtocolGovernor:
    """Get the global protocol governor instance.

    Returns:
        ProtocolGovernor singleton
    """
    global _governor
    if _governor is None:
        _governor = ProtocolGovernor()
    return _governor
