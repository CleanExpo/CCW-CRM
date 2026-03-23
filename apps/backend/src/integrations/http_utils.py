"""
Shared HTTP utilities for integration clients.

Provides retry with exponential backoff and 429 Retry-After handling
for use across Xero, AP2, SendGrid, and other integration clients.
"""

import asyncio
import random
from collections.abc import Callable, Coroutine
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

# Status codes that are transient and worth retrying
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


async def retry_with_backoff[T](
    func: Callable[[], Coroutine[Any, Any, T]],
    *,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    jitter: bool = True,
    integration_name: str = "integration",
) -> T:
    """
    Execute an async callable with exponential backoff retry.

    Handles:
    - httpx.HTTPStatusError with 429 (reads Retry-After header)
    - httpx.HTTPStatusError with 5xx (transient server errors)
    - httpx.TransportError (network-level failures)

    Non-retryable errors (4xx except 429) are re-raised immediately.

    Args:
        func: Zero-argument async callable to execute.
        max_retries: Maximum number of retry attempts (not counting the first try).
        base_delay: Base delay in seconds for exponential backoff.
        max_delay: Maximum delay cap in seconds.
        jitter: Add random jitter to avoid thundering-herd issues.
        integration_name: Name used in log messages.

    Returns:
        The return value of func() on success.

    Raises:
        The last exception if all retries are exhausted.
    """
    last_exc: Exception | None = None  # noqa: F841

    for attempt in range(max_retries + 1):
        try:
            return await func()

        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code

            if status_code not in RETRYABLE_STATUS_CODES:
                # Non-retryable client error — fail immediately
                raise

            last_exc = exc

            if attempt >= max_retries:
                logger.warning(
                    "Integration request failed — retries exhausted",
                    integration=integration_name,
                    status_code=status_code,
                    attempts=attempt + 1,
                )
                raise

            # 429: respect Retry-After header if present
            if status_code == 429:
                retry_after = _parse_retry_after(exc.response)
                delay = min(retry_after, max_delay)
            else:
                delay = _backoff_delay(attempt, base_delay, max_delay, jitter)

            logger.warning(
                "Integration request failed — retrying",
                integration=integration_name,
                status_code=status_code,
                attempt=attempt + 1,
                retry_in_seconds=round(delay, 2),
            )
            await asyncio.sleep(delay)

        except httpx.TransportError as exc:
            # Network-level failure (connection refused, timeout, etc.)
            last_exc = exc

            if attempt >= max_retries:
                logger.warning(
                    "Integration transport error — retries exhausted",
                    integration=integration_name,
                    error=str(exc),
                    attempts=attempt + 1,
                )
                raise

            delay = _backoff_delay(attempt, base_delay, max_delay, jitter)
            logger.warning(
                "Integration transport error — retrying",
                integration=integration_name,
                error=str(exc),
                attempt=attempt + 1,
                retry_in_seconds=round(delay, 2),
            )
            await asyncio.sleep(delay)

    # Should not reach here, but satisfy type checker
    if last_exc is not None:
        raise last_exc
    raise RuntimeError("retry_with_backoff: unreachable")


def _backoff_delay(attempt: int, base: float, maximum: float, jitter: bool) -> float:
    """Calculate exponential backoff delay with optional jitter."""
    delay = min(base * (2**attempt), maximum)
    if jitter:
        delay *= 0.5 + random.random() * 0.5  # noqa: S311 — not cryptographic
    return delay


def _parse_retry_after(response: httpx.Response) -> float:
    """Parse Retry-After header value (seconds or HTTP-date). Returns seconds as float."""
    header = response.headers.get("Retry-After", "")
    if not header:
        return 5.0  # Default fallback

    try:
        return max(0.0, float(header))
    except ValueError:
        # Could be an HTTP-date; fall back to default rather than failing
        return 5.0
