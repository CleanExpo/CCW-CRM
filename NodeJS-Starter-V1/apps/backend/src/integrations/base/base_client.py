"""
Base Integration Client with resilience patterns.

Provides foundation for all external integrations with:
- Retry logic with exponential backoff
- Circuit breaker pattern
- Rate limiting
- Demo/Live mode abstraction
- Structured logging
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from collections.abc import Callable
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Generic, TypeVar

import httpx
from circuitbreaker import circuit
from pydantic_settings import BaseSettings
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseSettings)


class IntegrationMode(str, Enum):
    """Integration operating mode."""

    DEMO = "demo"
    LIVE = "live"


class CircuitState(str, Enum):
    """Circuit breaker state."""

    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Blocking calls
    HALF_OPEN = "half_open"  # Testing recovery


class BaseIntegrationClient(ABC, Generic[T]):
    """
    Abstract base class for all integration clients.

    Provides common functionality:
    - HTTP client management
    - Retry logic (3 attempts, exponential backoff)
    - Circuit breaker (opens after 5 failures, recovers after 60s)
    - Rate limiting per integration
    - Demo/live mode switching
    - Request/response logging

    Subclasses must implement:
    - _get_auth_headers() for authentication
    - _demo_request() for mock responses in demo mode
    """

    def __init__(
        self,
        settings: T,
        base_url: str,
        is_demo_mode: bool = False,
        rate_limit_per_second: int = 10,
    ) -> None:
        """
        Initialize integration client.

        Args:
            settings: Integration-specific settings (Pydantic BaseSettings)
            base_url: API base URL
            is_demo_mode: Whether to use demo/mock responses
            rate_limit_per_second: Max requests per second
        """
        self.settings = settings
        self.base_url = base_url
        self.is_demo_mode = is_demo_mode
        self.rate_limit_per_second = rate_limit_per_second

        # HTTP client (lazy initialization)
        self._client: httpx.AsyncClient | None = None

        # Rate limiting
        self._last_request_time = datetime.min
        self._request_interval = timedelta(seconds=1 / rate_limit_per_second)

        # Circuit breaker state
        self._circuit_state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time: datetime | None = None
        self._circuit_open_until: datetime | None = None

        # Metrics
        self.total_requests = 0
        self.failed_requests = 0
        self.retried_requests = 0

    async def __aenter__(self) -> "BaseIntegrationClient":
        """Async context manager entry."""
        await self._ensure_client()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """Async context manager exit."""
        await self.close()

    async def _ensure_client(self) -> None:
        """Ensure HTTP client is initialized."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=httpx.Timeout(30.0, connect=10.0),
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
                follow_redirects=True,
            )

    async def close(self) -> None:
        """Close HTTP client."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    @abstractmethod
    def _get_auth_headers(self) -> dict[str, str]:
        """
        Get authentication headers for API requests.

        Must be implemented by subclasses.

        Returns:
            Dictionary of HTTP headers
        """
        pass

    @abstractmethod
    async def _demo_request(
        self, method: str, endpoint: str, **kwargs: Any
    ) -> dict[str, Any]:
        """
        Handle demo mode requests with mock responses.

        Must be implemented by subclasses.

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            **kwargs: Additional request parameters

        Returns:
            Mock response data
        """
        pass

    async def _apply_rate_limit(self) -> None:
        """Apply rate limiting by sleeping if needed."""
        now = datetime.utcnow()
        time_since_last = now - self._last_request_time

        if time_since_last < self._request_interval:
            sleep_time = (self._request_interval - time_since_last).total_seconds()
            await asyncio.sleep(sleep_time)

        self._last_request_time = datetime.utcnow()

    def _check_circuit_breaker(self) -> None:
        """Check circuit breaker state and raise exception if open."""
        now = datetime.utcnow()

        # Check if circuit should close (recovery period passed)
        if (
            self._circuit_state == CircuitState.OPEN
            and self._circuit_open_until
            and now >= self._circuit_open_until
        ):
            self._circuit_state = CircuitState.HALF_OPEN
            logger.info(
                f"{self.__class__.__name__}: Circuit breaker entering HALF_OPEN state"
            )

        # Block requests if circuit is open
        if self._circuit_state == CircuitState.OPEN:
            raise CircuitBreakerOpenError(
                f"{self.__class__.__name__}: Circuit breaker is OPEN"
            )

    def _record_success(self) -> None:
        """Record successful request for circuit breaker."""
        if self._circuit_state == CircuitState.HALF_OPEN:
            # Successful request in half-open state - close circuit
            self._circuit_state = CircuitState.CLOSED
            self._failure_count = 0
            logger.info(
                f"{self.__class__.__name__}: Circuit breaker closed after successful recovery"
            )

    def _record_failure(self) -> None:
        """Record failed request for circuit breaker."""
        self._failure_count += 1
        self._last_failure_time = datetime.utcnow()
        self.failed_requests += 1

        # Open circuit after threshold failures
        if self._failure_count >= 5:
            self._circuit_state = CircuitState.OPEN
            self._circuit_open_until = datetime.utcnow() + timedelta(seconds=60)
            logger.error(
                f"{self.__class__.__name__}: Circuit breaker OPENED after {self._failure_count} failures"
            )

    async def _request(
        self,
        method: str,
        endpoint: str,
        retries: int = 3,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """
        Make HTTP request with retry logic and circuit breaker.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE, PATCH)
            endpoint: API endpoint path
            retries: Number of retry attempts (default: 3)
            **kwargs: Additional httpx request parameters

        Returns:
            Response data as dictionary

        Raises:
            CircuitBreakerOpenError: If circuit breaker is open
            httpx.HTTPStatusError: If request fails after retries
        """
        # Demo mode - return mock response
        if self.is_demo_mode:
            logger.debug(f"[DEMO] {method} {endpoint}")
            return await self._demo_request(method, endpoint, **kwargs)

        # Check circuit breaker
        self._check_circuit_breaker()

        # Apply rate limiting
        await self._apply_rate_limit()

        # Ensure client initialized
        await self._ensure_client()

        # Add authentication headers
        headers = {**self._get_auth_headers(), **kwargs.pop("headers", {})}

        self.total_requests += 1

        # Retry logic with exponential backoff
        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(retries),
            wait=wait_exponential(multiplier=1, min=2, max=30),
            retry=retry_if_exception_type(
                (httpx.TimeoutException, httpx.NetworkError, httpx.ConnectError)
            ),
            reraise=True,
        ):
            with attempt:
                try:
                    response = await self._client.request(
                        method=method,
                        url=endpoint,
                        headers=headers,
                        **kwargs,
                    )
                    response.raise_for_status()

                    # Record success
                    self._record_success()

                    # Parse JSON response
                    return response.json()

                except (
                    httpx.TimeoutException,
                    httpx.NetworkError,
                    httpx.ConnectError,
                ) as e:
                    # Transient errors - will be retried
                    self.retried_requests += 1
                    logger.warning(
                        f"{self.__class__.__name__}: Transient error on attempt {attempt.retry_state.attempt_number}: {e}"
                    )
                    self._record_failure()
                    raise

                except httpx.HTTPStatusError as e:
                    # HTTP errors - record and raise
                    self._record_failure()
                    logger.error(
                        f"{self.__class__.__name__}: HTTP {e.response.status_code} error: {e}"
                    )
                    raise

                except Exception as e:
                    # Unexpected errors
                    self._record_failure()
                    logger.error(
                        f"{self.__class__.__name__}: Unexpected error: {e}",
                        exc_info=True,
                    )
                    raise

    async def get(self, endpoint: str, **kwargs: Any) -> dict[str, Any]:
        """Make GET request."""
        return await self._request("GET", endpoint, **kwargs)

    async def post(self, endpoint: str, **kwargs: Any) -> dict[str, Any]:
        """Make POST request."""
        return await self._request("POST", endpoint, **kwargs)

    async def put(self, endpoint: str, **kwargs: Any) -> dict[str, Any]:
        """Make PUT request."""
        return await self._request("PUT", endpoint, **kwargs)

    async def patch(self, endpoint: str, **kwargs: Any) -> dict[str, Any]:
        """Make PATCH request."""
        return await self._request("PATCH", endpoint, **kwargs)

    async def delete(self, endpoint: str, **kwargs: Any) -> dict[str, Any]:
        """Make DELETE request."""
        return await self._request("DELETE", endpoint, **kwargs)

    def get_metrics(self) -> dict[str, Any]:
        """Get client metrics for monitoring."""
        return {
            "total_requests": self.total_requests,
            "failed_requests": self.failed_requests,
            "retried_requests": self.retried_requests,
            "success_rate": (
                (self.total_requests - self.failed_requests) / self.total_requests
                if self.total_requests > 0
                else 0
            ),
            "circuit_state": self._circuit_state.value,
            "failure_count": self._failure_count,
        }


class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is open and blocking requests."""

    pass
