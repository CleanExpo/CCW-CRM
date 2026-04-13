"""Agents Protocol v1.0 — Governance layer for multi-agent system.

Provides structured communication, delegation, escalation, error handling,
permissions, and coordination for the AI agent ecosystem.

Protocol version: 1.0.0
"""

from .confidence import (
    aggregate_confidence,
    score_from_completeness,
    score_from_execution,
    score_from_health,
)
from .error_handler import (
    calculate_backoff,
    classify_exception,
    format_error_response,
    should_retry,
)
from .governor import ProtocolGovernor, get_protocol_governor
from .message_bus import (
    AgentMessageBus,
    create_message,
    create_response,
    get_message_bus,
    is_expired,
)
from .models import (
    AgentCard,
    AgentMessage,
    ConfidenceScore,
    DelegationRequest,
    DelegationRule,
    ErrorClassification,
    ErrorType,
    EscalationTrigger,
    EscalationTriggerType,
    HandoffPackage,
    MessageType,
    PermissionTier,
    Priority,
    ProtocolVersion,
    Severity,
)

try:
    from .cards import ALL_CARDS, load_all_cards
except ImportError:
    ALL_CARDS = {}  # type: ignore[assignment]

    def load_all_cards() -> dict:  # type: ignore[misc]
        """Fallback when cards module is unavailable."""
        return {}


__all__ = [
    # Cards
    "ALL_CARDS",
    "load_all_cards",
    # Models
    "AgentCard",
    "AgentMessage",
    "ConfidenceScore",
    "DelegationRequest",
    "DelegationRule",
    "ErrorClassification",
    "ErrorType",
    "EscalationTrigger",
    "EscalationTriggerType",
    "HandoffPackage",
    "MessageType",
    "PermissionTier",
    "Priority",
    "ProtocolVersion",
    "Severity",
    # Governor
    "ProtocolGovernor",
    "get_protocol_governor",
    # Message Bus
    "AgentMessageBus",
    "create_message",
    "create_response",
    "get_message_bus",
    "is_expired",
    # Error Handler
    "classify_exception",
    "should_retry",
    "calculate_backoff",
    "format_error_response",
    # Confidence
    "score_from_execution",
    "score_from_health",
    "score_from_completeness",
    "aggregate_confidence",
]
