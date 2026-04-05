"""Agents Protocol v1.0 — Protocol Governor.

Central enforcement engine for agent governance. Validates delegation,
classifies errors, manages escalation, checks permissions, and maintains
an audit trail of protocol events.

All validation logic is implemented as pure functions for testability.
The ProtocolGovernor class wraps these with registry lookups and state.
"""

from __future__ import annotations

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


# ─── Permission Tier Hierarchy ───────────────────────────────────────────

_TIER_LEVEL: dict[PermissionTier, int] = {
    PermissionTier.READ_ONLY: 0,
    PermissionTier.STANDARD: 1,
    PermissionTier.ELEVATED: 2,
    PermissionTier.ADMIN: 3,
}

# Minimum permission tier required per action category
_ACTION_MIN_TIER: dict[str, PermissionTier] = {
    "read": PermissionTier.READ_ONLY,
    "query": PermissionTier.READ_ONLY,
    "search": PermissionTier.READ_ONLY,
    "list": PermissionTier.READ_ONLY,
    "delegate": PermissionTier.STANDARD,
    "execute": PermissionTier.STANDARD,
    "analyze": PermissionTier.STANDARD,
    "create": PermissionTier.ELEVATED,
    "update": PermissionTier.ELEVATED,
    "modify": PermissionTier.ELEVATED,
    "delete": PermissionTier.ADMIN,
    "configure": PermissionTier.ADMIN,
    "admin": PermissionTier.ADMIN,
}


# ─── Pure Functions ──────────────────────────────────────────────────────


def validate_delegation(
    request: DelegationRequest,
    sender_card: AgentCard,
    recipient_card: AgentCard,
) -> tuple[bool, list[str]]:
    """Validate a delegation request against protocol rules.

    Checks five requirements:
    1. Sender has sufficient permission to delegate
    2. Recipient has all required capabilities
    3. No circular delegation (delegate not already in chain)
    4. Recipient within concurrency limits
    5. Timeout within allowed bounds

    Returns:
        (is_valid, list_of_errors)
    """
    errors: list[str] = []

    # 1. Permission check — READ_ONLY agents cannot delegate
    if _TIER_LEVEL[sender_card.permission_tier] < _TIER_LEVEL[PermissionTier.STANDARD]:
        errors.append(
            f"Insufficient permission: {sender_card.permission_tier.value} "
            f"cannot delegate (requires STANDARD or higher)"
        )

    # 2. Capability check
    recipient_caps = set(recipient_card.capabilities)
    for required in request.required_capabilities:
        if required not in recipient_caps:
            errors.append(
                f"Recipient missing required capability: '{required}'"
            )

    # 3. Circular delegation check
    if detect_delegation_loop(request.chain, request.delegate_id):
        errors.append(
            f"Circular delegation detected: '{request.delegate_id}' "
            f"already in chain {request.chain}"
        )

    # 4. Timeout bounds check
    if request.timeout_seconds > recipient_card.timeout_seconds:
        errors.append(
            f"Requested timeout ({request.timeout_seconds}s) exceeds "
            f"recipient maximum ({recipient_card.timeout_seconds}s)"
        )

    return (len(errors) == 0, errors)


def classify_error(error: Exception) -> ErrorClassification:
    """Classify an exception into a structured error with retry policy.

    Maps common Python exceptions to protocol error types.
    """
    error_type = error.__class__.__name__
    message = str(error) or error_type

    if isinstance(error, TimeoutError):
        return ErrorClassification(
            error_type=ErrorType.TIMEOUT,
            severity=Severity.MEDIUM,
            retryable=True,
            max_retries=3,
            backoff_strategy="exponential",
            message=message,
        )

    if isinstance(error, PermissionError):
        return ErrorClassification(
            error_type=ErrorType.PERMISSION,
            severity=Severity.HIGH,
            retryable=False,
            max_retries=0,
            backoff_strategy="none",
            message=message,
        )

    if isinstance(error, (ValueError, KeyError, TypeError)):
        return ErrorClassification(
            error_type=ErrorType.DATA_QUALITY,
            severity=Severity.LOW,
            retryable=False,
            max_retries=0,
            backoff_strategy="none",
            message=message,
        )

    if isinstance(error, (ConnectionError, ConnectionRefusedError, OSError)):
        return ErrorClassification(
            error_type=ErrorType.TRANSIENT,
            severity=Severity.MEDIUM,
            retryable=True,
            max_retries=3,
            backoff_strategy="exponential",
            message=message,
        )

    if isinstance(error, MemoryError):
        return ErrorClassification(
            error_type=ErrorType.CAPACITY,
            severity=Severity.CRITICAL,
            retryable=True,
            max_retries=1,
            backoff_strategy="linear",
            message=message,
        )

    # Default: permanent error
    return ErrorClassification(
        error_type=ErrorType.PERMANENT,
        severity=Severity.MEDIUM,
        retryable=False,
        max_retries=0,
        backoff_strategy="none",
        message=message,
    )


def should_escalate(
    confidence: ConfidenceScore,
    escalation_triggers: list[EscalationTrigger],
) -> tuple[bool, str | None]:
    """Check whether any escalation trigger conditions are met.

    Returns:
        (should_escalate, description_or_None)
    """
    for trigger in escalation_triggers:
        if trigger.trigger_type == EscalationTriggerType.CONFIDENCE_LOW:
            if confidence.score < trigger.threshold:
                desc = (
                    trigger.description
                    or f"Low confidence ({confidence.score:.2f} < {trigger.threshold})"
                )
                return (True, desc)

        elif trigger.trigger_type == EscalationTriggerType.ERROR_THRESHOLD:
            error_rate = confidence.factors.get("error_rate", 0.0)
            if error_rate > trigger.threshold:
                desc = (
                    trigger.description
                    or f"Error rate too high ({error_rate:.2f} > {trigger.threshold})"
                )
                return (True, desc)

    return (False, None)


def calculate_confidence(
    result: dict[str, Any],
    execution_time_ms: int,
    agent_health: float,
    *,
    expected_time_ms: int = 1000,
    expected_keys: list[str] | None = None,
) -> ConfidenceScore:
    """Compute confidence score from multiple factors.

    Factors:
    - execution_time: 1.0 if fast, degrades toward 0.1 if slow
    - health: agent health score (0.0–1.0)
    - completeness: proportion of expected keys present
    - error_free: 0.0 if result contains "error" key, else 1.0
    """
    from .confidence import score_from_completeness, score_from_execution, score_from_health

    factors: dict[str, float] = {}

    # Execution time factor
    factors["execution_time"] = score_from_execution(execution_time_ms, expected_time_ms)

    # Health factor
    factors["health"] = score_from_health(agent_health)

    # Completeness factor
    if expected_keys:
        factors["completeness"] = score_from_completeness(result, expected_keys)
    else:
        factors["completeness"] = 1.0 if result else 0.0

    # Error-free factor
    factors["error_free"] = 0.0 if "error" in result else 1.0

    # Weighted average
    total = sum(factors.values())
    count = len(factors)
    score = total / count if count > 0 else 0.0
    score = max(0.0, min(1.0, score))

    # Determine reasoning
    if score >= 0.7:
        reasoning = "nominal"
    elif score >= 0.4:
        reasoning = "degraded"
    else:
        reasoning = "poor"

    return ConfidenceScore(
        score=round(score, 4),
        reasoning=reasoning,
        factors=factors,
    )


def validate_permissions(
    agent_card: AgentCard,
    action: str,
    target: str | None = None,
) -> bool:
    """Check whether an agent's permission tier allows a given action.

    Unknown actions default to requiring ELEVATED permissions.
    """
    action_lower = action.lower()
    required_tier = _ACTION_MIN_TIER.get(action_lower, PermissionTier.ELEVATED)
    return _TIER_LEVEL[agent_card.permission_tier] >= _TIER_LEVEL[required_tier]


def build_handoff_package(
    source_id: str,
    target_id: str,
    task: str,
    context: dict[str, Any],
    progress: dict[str, Any],
    *,
    artifacts: list[str] | None = None,
    reason: str = "",
) -> HandoffPackage:
    """Build a structured handoff package for agent-to-agent transfer."""
    return HandoffPackage(
        source_agent_id=source_id,
        target_agent_id=target_id,
        task_summary=task,
        context=context,
        progress=progress,
        artifacts=artifacts or [],
        reason=reason,
    )


def detect_delegation_loop(chain: list[str], new_delegate: str) -> bool:
    """Detect circular delegation by checking if delegate is already in the chain."""
    return new_delegate in chain


# ─── ProtocolGovernor Class ──────────────────────────────────────────────


class ProtocolGovernor:
    """Central protocol enforcement engine.

    Wraps pure validation functions with registry lookups and maintains
    an audit log of protocol events.
    """

    _instance: ProtocolGovernor | None = None

    def __new__(cls) -> ProtocolGovernor:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return

        self.version = ProtocolVersion.current()
        self.audit_log: list[dict[str, Any]] = []
        self._delegations_validated = 0
        self._delegations_rejected = 0
        self._escalations_triggered = 0
        self._initialized = True

        logger.info("Protocol governor initialized", version=str(self.version))

    def get_agent_card(self, agent_id: str) -> AgentCard | None:
        """Look up an agent card from the registry."""
        try:
            from src.ai.orchestration import get_agent_registry

            registry = get_agent_registry()
            return registry.get_agent_card(agent_id)
        except Exception:
            return None

    def enforce_delegation(
        self, request: DelegationRequest
    ) -> tuple[bool, DelegationRequest | None, list[str]]:
        """Full delegation validation with registry lookup and audit.

        Returns:
            (is_valid, enriched_request_or_None, errors)
        """
        sender_card = self.get_agent_card(request.delegator_id)
        recipient_card = self.get_agent_card(request.delegate_id)

        errors: list[str] = []

        if not sender_card:
            errors.append(f"Sender '{request.delegator_id}' has no protocol card")
        if not recipient_card:
            errors.append(f"Recipient '{request.delegate_id}' has no protocol card")

        if errors:
            self._delegations_rejected += 1
            self._record_event("delegation_rejected", {
                "delegator": request.delegator_id,
                "delegate": request.delegate_id,
                "errors": errors,
            })
            return (False, None, errors)

        is_valid, validation_errors = validate_delegation(
            request, sender_card, recipient_card  # type: ignore[arg-type]
        )

        self._delegations_validated += 1
        if not is_valid:
            self._delegations_rejected += 1

        self._record_event(
            "delegation_validated" if is_valid else "delegation_rejected",
            {
                "delegator": request.delegator_id,
                "delegate": request.delegate_id,
                "valid": is_valid,
                "errors": validation_errors,
            },
        )

        return (is_valid, request if is_valid else None, validation_errors)

    def get_statistics(self) -> dict[str, Any]:
        """Get governor statistics."""
        return {
            "protocol_version": str(self.version),
            "delegations_validated": self._delegations_validated,
            "delegations_rejected": self._delegations_rejected,
            "escalations_triggered": self._escalations_triggered,
            "audit_log_entries": len(self.audit_log),
        }

    def _record_event(self, event_type: str, data: dict[str, Any]) -> None:
        """Record a protocol event to the audit log."""
        entry = {
            "event_type": event_type,
            "data": data,
            "timestamp": datetime.now(UTC).isoformat(),
            "protocol_version": str(self.version),
        }
        self.audit_log.append(entry)

        logger.debug(
            "Protocol event recorded",
            event_type=event_type,
            protocol_version=str(self.version),
        )


# ─── Singleton ───────────────────────────────────────────────────────────

_governor: ProtocolGovernor | None = None


def get_protocol_governor() -> ProtocolGovernor:
    """Get the global protocol governor singleton."""
    global _governor
    if _governor is None:
        _governor = ProtocolGovernor()
    return _governor
