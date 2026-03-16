"""Agents Protocol v1.0 — Error Handler.

Provides structured error classification, retry policy determination,
and backoff calculation for the agent protocol.

All functions are pure (no side effects) for testability.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from .models import ErrorClassification, ErrorType, Severity

# ─── Error Classification Map ────────────────────────────────────────────

# Maps exception types to (ErrorType, Severity, retryable, max_retries, backoff)
_EXCEPTION_MAP: dict[type, tuple[ErrorType, Severity, bool, int, str]] = {
    TimeoutError: (ErrorType.TIMEOUT, Severity.MEDIUM, True, 3, "exponential"),
    PermissionError: (ErrorType.PERMISSION, Severity.HIGH, False, 0, "none"),
    ValueError: (ErrorType.DATA_QUALITY, Severity.LOW, False, 0, "none"),
    TypeError: (ErrorType.DATA_QUALITY, Severity.LOW, False, 0, "none"),
    KeyError: (ErrorType.DATA_QUALITY, Severity.LOW, False, 0, "none"),
    ConnectionError: (ErrorType.TRANSIENT, Severity.MEDIUM, True, 3, "exponential"),
    ConnectionRefusedError: (ErrorType.TRANSIENT, Severity.MEDIUM, True, 3, "exponential"),
    ConnectionResetError: (ErrorType.TRANSIENT, Severity.MEDIUM, True, 3, "exponential"),
    OSError: (ErrorType.TRANSIENT, Severity.MEDIUM, True, 2, "linear"),
    MemoryError: (ErrorType.CAPACITY, Severity.CRITICAL, True, 1, "linear"),
}


# ─── Pure Functions ──────────────────────────────────────────────────────


def classify_exception(error: Exception) -> ErrorClassification:
    """Classify a Python exception into a structured protocol error.

    Walks the MRO to find the best matching exception type.
    Falls back to PERMANENT for unknown exceptions.
    """
    # Check exact type first, then walk MRO for base classes
    for exc_type in type(error).__mro__:
        if exc_type in _EXCEPTION_MAP:
            error_type, severity, retryable, max_retries, backoff = _EXCEPTION_MAP[exc_type]
            return ErrorClassification(
                error_type=error_type,
                severity=severity,
                retryable=retryable,
                max_retries=max_retries,
                backoff_strategy=backoff,
                message=str(error) or type(error).__name__,
            )

    # Default: permanent error
    return ErrorClassification(
        error_type=ErrorType.PERMANENT,
        severity=Severity.MEDIUM,
        retryable=False,
        max_retries=0,
        backoff_strategy="none",
        message=str(error) or type(error).__name__,
    )


def should_retry(classification: ErrorClassification, attempt: int) -> bool:
    """Determine whether to retry based on classification and attempt count.

    Args:
        classification: The error classification
        attempt: Zero-based attempt number (0 = first attempt)

    Returns:
        True if a retry should be attempted
    """
    if not classification.retryable:
        return False
    return attempt < classification.max_retries


def calculate_backoff(
    strategy: str,
    attempt: int,
    base_delay: float = 1.0,
) -> float:
    """Calculate retry backoff delay in seconds.

    Strategies:
    - "none": Always 0.0 (no delay)
    - "linear": base_delay * (attempt + 1)
    - "exponential": base_delay * 2^attempt

    Args:
        strategy: Backoff strategy name
        attempt: Zero-based attempt number
        base_delay: Base delay in seconds

    Returns:
        Delay in seconds before next retry
    """
    if strategy == "none":
        return 0.0
    elif strategy == "linear":
        return base_delay * (attempt + 1)
    elif strategy == "exponential":
        return base_delay * (2 ** attempt)
    else:
        return 0.0


def format_error_response(
    classification: ErrorClassification,
    agent_id: str,
) -> dict[str, Any]:
    """Format a structured error response for API consumers.

    Returns a dictionary suitable for JSON serialization.
    """
    return {
        "error": True,
        "error_type": classification.error_type.value,
        "severity": classification.severity.value,
        "message": classification.message,
        "retryable": classification.retryable,
        "max_retries": classification.max_retries,
        "backoff_strategy": classification.backoff_strategy,
        "agent_id": agent_id,
        "timestamp": datetime.now(UTC).isoformat(),
    }
