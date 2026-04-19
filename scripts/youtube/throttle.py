"""Exponential-backoff retry helper for YouTube uploads (UNI-1933).

Extracted from ``upload_video`` in the original monolithic script. Callers
pass a ``next_chunk`` callable (or any zero-arg producer) and the helper
retries transient errors with exponential backoff, surfacing a final
failure after ``max_retries`` attempts.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")


def retry_with_backoff(
    fn: Callable[[], T],
    *,
    max_retries: int = 5,
    base_delay_seconds: float = 2.0,
    label: str = "request",
) -> T:
    """Run ``fn`` with exponential backoff on failure.

    Delay schedule: ``base_delay_seconds`` doubles each retry, so the default
    (5 retries × base 2s) waits 2, 4, 8, 16, 32 seconds — total ~62s max.

    Args:
        fn: Zero-arg callable to invoke.
        max_retries: Retry cap (default 5).
        base_delay_seconds: First delay, doubled each attempt (default 2.0).
        label: Short description used only for log output.

    Returns:
        The result of the first successful ``fn()`` call.

    Raises:
        The last exception when ``max_retries`` is exceeded.
    """
    last_error: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            return fn()
        except Exception as error:
            last_error = error
            if attempt >= max_retries:
                break
            wait = base_delay_seconds * (2 ** attempt)
            print(f"\n  Retry {attempt + 1}/{max_retries} in {int(wait)}s: {error}")
            time.sleep(wait)

    assert last_error is not None  # nosec — invariant: we never exit the loop without an error
    print(f"\n  ERROR after {max_retries} retries on {label}: {last_error}")
    raise last_error
