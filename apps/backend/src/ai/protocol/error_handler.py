"""Agents Protocol v1.0 — Error Handler.

Structured error classification with retry policies and backoff strategies.
Section 7 (Error Handling).

All functions are pure for testability.
"""

import math
from datetime import UTC, datetime
from typing import Any

from .models import ErrorClassification, ErrorType, Severity


# ─── Exception → ErrorType mapping ────────────────────────────────────────

_EXCEPTION_MAP: dict[type, tuple[ErrorType, Severity, bool, int, str]] = {
    # (ErrorType, Severity, retryable, max_retries, backoff)
    TimeoutError: (ErrorType.TIMEOUT, Severity.MEDIUM, True, 2, "exponential"),
    ConnectionError: (ErrorType.TRANSIENT, Severity.MEDIUM, True, 3, "exponential"),
    ConnectionResetError: (ErrorType.TRANSIENT, Severity.MEDIUM, True, 3, "exponential"),
    ConnectionRefusedError: (ErrorType.TRANSIENT, Severity.HIGH, True, 2, "exponential"),
    PermissionError: (ErrorType.PERMISSION, Severity.HIGH, False, 0, "none"),
    ValueError: (ErrorType.DATA_QUALITY, Severity.LOW, False, 0, "none"),
    TypeError: (ErrorType.DATA_QUALITY, Severity.LOW, False, 0, "none"),
    KeyError: (ErrorType.DATA_QUALITY, Severity.LOW, False, 0, "none"),
    MemoryError: (ErrorType.CAPACITY, Severity.CRITICAL, True, 1, "linear"),
    OSError: (ErrorType.CAPACITY, Severity.HIGH, True, 1, "linear"),
    FileNotFoundError: (ErrorType.PERMANENT, Severity.MEDIUM, False, 0, "none"),
    NotImplementedError: (ErrorType.PERMANENT, Severity.LOW, False, 0, "none"),
}


def classify_exception(error: Exception) -> ErrorClassification:
    """Classify an exception into a structured ErrorClassification.

    Uses the exception type to determine error type, severity,
    retry policy, and backoff strategy.

    Args:
        error: The exception to classify

    Returns:
        Structured ErrorClassification
    """
    error_class = type(error)

    # Check direct mapping
    if error_class in _EXCEPTION_MAP:
        error_type, severity, retryable, max_retries, backoff = _EXCEPTION_MAP[error_class]
        return ErrorClassification(
            error_type=error_type,
            severity=severity,
            retryable=retryable,
            max_retries=max_retries,
            backoff_strategy=backoff,
            message=f"{error_class.__name__}: {error}",
        )

    # Check parent classes (MRO)
    for parent_class in error_class.__mro__:
        if parent_class in _EXCEPTION_MAP:
            error_type, severity, retryable, max_retries, backoff = _EXCEPTION_MAP[parent_class]
            return ErrorClassification(
                error_type=error_type,
                severity=severity,
                retryable=retryable,
                max_retries=max_retries,
                backoff_strategy=backoff,
                message=f"{error_class.__name__}: {error}",
            )

    # Check string-based hints
    error_str = str(error).lower()
    if "timeout" in error_str:
        return ErrorClassification(
            error_type=ErrorType.TIMEOUT,
            severity=Severity.MEDIUM,
            retryable=True,
            max_retries=2,
            backoff_strategy="exponential",
            message=f"{error_class.__name__}: {error}",
        )
    if "permission" in error_str or "denied" in error_str:
        return ErrorClassification(
            error_type=ErrorType.PERMISSION,
            severity=Severity.HIGH,
            retryable=False,
            max_retries=0,
            backoff_strategy="none",
            message=f"{error_class.__name__}: {error}",
        )

    # Default: permanent, non-retryable
    return ErrorClassification(
        error_type=ErrorType.PERMANENT,
        severity=Severity.MEDIUM,
        retryable=False,
        max_retries=0,
        backoff_strategy="none",
        message=f"{error_class.__name__}: {error}",
    )


def should_retry(classification: ErrorClassification, attempt: int) -> bool:
    """Determine if an operation should be retried.

    Args:
        classification: The error classification
        attempt: Current attempt number (0-based)

    Returns:
        True if retry should be attempted
    """
    if not classification.retryable:
        return False
    return attempt < classification.max_retries


def calculate_backoff(strategy: str, attempt: int, base_delay: float = 1.0) -> float:
    """Calculate delay before next retry attempt.

    Strategies:
    - "none": No delay (0.0)
    - "linear": base_delay * (attempt + 1)
    - "exponential": base_delay * 2^attempt

    Args:
        strategy: Backoff strategy name
        attempt: Current attempt number (0-based)
        base_delay: Base delay in seconds

    Returns:
        Delay in seconds before next retry
    """
    if strategy == "none":
        return 0.0
    elif strategy == "linear":
        return base_delay * (attempt + 1)
    elif strategy == "exponential":
        return base_delay * math.pow(2, attempt)
    else:
        # Unknown strategy, fall back to no delay
        return 0.0


def format_error_response(
    classification: ErrorClassification,
    agent_id: str,
) -> dict[str, Any]:
    """Format an error classification into a standardized response dict.

    Args:
        classification: The error classification
        agent_id: ID of the agent that encountered the error

    Returns:
        Standardized error response dictionary
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
