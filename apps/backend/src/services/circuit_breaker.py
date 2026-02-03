"""
Circuit Breaker Service for Autonomous Development.

Prevents cascading failures by automatically disabling components after repeated failures.
Part of Phase 5 (Autonomous Development Framework) - Week 2 implementation.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Callable

import structlog

from src.monitoring.metrics import (
    circuit_breaker_closes,
    circuit_breaker_opens,
    circuit_breaker_state,
)

logger = structlog.get_logger(__name__)


class CircuitState(str, Enum):
    """Circuit breaker states."""

    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, requests blocked
    HALF_OPEN = "half_open"  # Testing recovery


@dataclass
class CircuitBreakerConfig:
    """Configuration for a circuit breaker."""

    failure_threshold: int = 5  # Failures before opening circuit
    success_threshold: int = 2  # Successes to close from half-open
    timeout_seconds: int = 60  # Time before trying half-open
    half_open_max_calls: int = 3  # Max calls in half-open state
    rolling_window_seconds: int = 300  # Window for counting failures (5 min)


@dataclass
class CircuitBreakerMetrics:
    """Metrics for a circuit breaker."""

    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    rejected_calls: int = 0  # Calls rejected while open
    last_failure_time: datetime | None = None
    last_success_time: datetime | None = None
    consecutive_failures: int = 0
    consecutive_successes: int = 0
    state_transitions: list[tuple[CircuitState, datetime]] = field(default_factory=list)


class CircuitBreakerException(Exception):
    """Exception raised when circuit breaker is open."""

    def __init__(self, component: str, state: CircuitState):
        self.component = component
        self.state = state
        super().__init__(f"Circuit breaker for {component} is {state.value}")


class CircuitBreaker:
    """
    Circuit breaker for a specific component.

    Implements the circuit breaker pattern to prevent cascading failures:
    - CLOSED: Normal operation, all requests pass through
    - OPEN: Too many failures, all requests fail fast
    - HALF_OPEN: Testing if system recovered, limited requests allowed
    """

    def __init__(
        self,
        name: str,
        config: CircuitBreakerConfig | None = None,
    ):
        """
        Initialize a circuit breaker.

        Args:
            name: Name of the component being protected
            config: Circuit breaker configuration
        """
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self.state = CircuitState.CLOSED
        self.metrics = CircuitBreakerMetrics()
        self.opened_at: datetime | None = None
        self.half_open_calls: int = 0
        self._lock = asyncio.Lock()

        logger.info(
            "Circuit breaker initialized",
            component=name,
            failure_threshold=self.config.failure_threshold,
            timeout=self.config.timeout_seconds,
        )

        # Record initial state
        self._record_state_change(CircuitState.CLOSED)

    async def call(
        self,
        func: Callable,
        *args: Any,
        **kwargs: Any,
    ) -> Any:
        """
        Execute a function with circuit breaker protection.

        Args:
            func: The async function to execute
            *args: Positional arguments for the function
            **kwargs: Keyword arguments for the function

        Returns:
            The result of the function call

        Raises:
            CircuitBreakerException: If circuit is open
            Exception: If the function call fails
        """
        async with self._lock:
            # Check if we should transition states
            await self._check_state_transition()

            # If open, reject immediately
            if self.state == CircuitState.OPEN:
                self.metrics.rejected_calls += 1
                logger.warning(
                    "Circuit breaker open, rejecting call",
                    component=self.name,
                    rejected_calls=self.metrics.rejected_calls,
                )
                raise CircuitBreakerException(self.name, self.state)

            # If half-open, check call limit
            if self.state == CircuitState.HALF_OPEN:
                if self.half_open_calls >= self.config.half_open_max_calls:
                    logger.debug(
                        "Half-open call limit reached",
                        component=self.name,
                        calls=self.half_open_calls,
                    )
                    raise CircuitBreakerException(self.name, self.state)
                self.half_open_calls += 1

        # Execute the function
        try:
            self.metrics.total_calls += 1
            result = await func(*args, **kwargs)

            # Success!
            await self._record_success()
            return result

        except Exception as e:
            # Failure
            await self._record_failure(e)
            raise

    async def _check_state_transition(self) -> None:
        """Check if circuit breaker should transition states."""
        if self.state == CircuitState.OPEN:
            # Check if timeout expired, try half-open
            if self.opened_at:
                time_open = (datetime.now(timezone.utc) - self.opened_at).total_seconds()
                if time_open >= self.config.timeout_seconds:
                    await self._transition_to_half_open()

    async def _record_success(self) -> None:
        """Record a successful call."""
        async with self._lock:
            self.metrics.successful_calls += 1
            self.metrics.consecutive_successes += 1
            self.metrics.consecutive_failures = 0
            self.metrics.last_success_time = datetime.now(timezone.utc)

            logger.debug(
                "Circuit breaker call succeeded",
                component=self.name,
                consecutive_successes=self.metrics.consecutive_successes,
            )

            # State transitions based on success
            if self.state == CircuitState.HALF_OPEN:
                # Check if enough successes to close
                if self.metrics.consecutive_successes >= self.config.success_threshold:
                    await self._transition_to_closed()

    async def _record_failure(self, error: Exception) -> None:
        """Record a failed call."""
        async with self._lock:
            self.metrics.failed_calls += 1
            self.metrics.consecutive_failures += 1
            self.metrics.consecutive_successes = 0
            self.metrics.last_failure_time = datetime.now(timezone.utc)

            logger.warning(
                "Circuit breaker call failed",
                component=self.name,
                consecutive_failures=self.metrics.consecutive_failures,
                error=str(error),
            )

            # State transitions based on failure
            if self.state == CircuitState.CLOSED:
                # Check if threshold reached
                if self.metrics.consecutive_failures >= self.config.failure_threshold:
                    await self._transition_to_open()

            elif self.state == CircuitState.HALF_OPEN:
                # Any failure in half-open reopens circuit
                await self._transition_to_open()

    async def _transition_to_open(self) -> None:
        """Transition to OPEN state."""
        self.state = CircuitState.OPEN
        self.opened_at = datetime.now(timezone.utc)
        self.half_open_calls = 0

        logger.error(
            "Circuit breaker opened",
            component=self.name,
            consecutive_failures=self.metrics.consecutive_failures,
            timeout=self.config.timeout_seconds,
        )

        self._record_state_change(CircuitState.OPEN)

        # Record metric
        circuit_breaker_opens.labels(component=self.name).inc()

    async def _transition_to_half_open(self) -> None:
        """Transition to HALF_OPEN state."""
        self.state = CircuitState.HALF_OPEN
        self.half_open_calls = 0
        self.metrics.consecutive_failures = 0
        self.metrics.consecutive_successes = 0

        logger.info(
            "Circuit breaker half-open",
            component=self.name,
            max_calls=self.config.half_open_max_calls,
        )

        self._record_state_change(CircuitState.HALF_OPEN)

    async def _transition_to_closed(self) -> None:
        """Transition to CLOSED state."""
        self.state = CircuitState.CLOSED
        self.opened_at = None
        self.half_open_calls = 0
        self.metrics.consecutive_failures = 0

        logger.info(
            "Circuit breaker closed",
            component=self.name,
            consecutive_successes=self.metrics.consecutive_successes,
        )

        self._record_state_change(CircuitState.CLOSED)

        # Record metric
        circuit_breaker_closes.labels(component=self.name).inc()

    def _record_state_change(self, new_state: CircuitState) -> None:
        """Record a state transition."""
        self.metrics.state_transitions.append((new_state, datetime.now(timezone.utc)))

        # Update Prometheus gauge
        state_value = {"closed": 0, "open": 1, "half_open": 2}[new_state.value]
        circuit_breaker_state.labels(component=self.name).set(state_value)

    async def force_open(self) -> None:
        """Manually force circuit to OPEN state."""
        async with self._lock:
            logger.warning("Circuit breaker manually opened", component=self.name)
            await self._transition_to_open()

    async def force_close(self) -> None:
        """Manually force circuit to CLOSED state."""
        async with self._lock:
            logger.warning("Circuit breaker manually closed", component=self.name)
            await self._transition_to_closed()

    def get_metrics(self) -> CircuitBreakerMetrics:
        """Get current metrics."""
        return self.metrics

    def get_state(self) -> CircuitState:
        """Get current state."""
        return self.state

    def is_available(self) -> bool:
        """Check if circuit breaker allows calls."""
        return self.state != CircuitState.OPEN


class CircuitBreakerManager:
    """
    Manager for multiple circuit breakers.

    Manages circuit breakers for different components in the autonomous system.
    """

    def __init__(self):
        """Initialize the circuit breaker manager."""
        self.breakers: dict[str, CircuitBreaker] = {}
        self._lock = asyncio.Lock()
        logger.info("Circuit breaker manager initialized")

    def get_breaker(
        self,
        component: str,
        config: CircuitBreakerConfig | None = None,
    ) -> CircuitBreaker:
        """
        Get or create a circuit breaker for a component.

        Args:
            component: Name of the component
            config: Optional configuration (uses default if not provided)

        Returns:
            CircuitBreaker instance
        """
        if component not in self.breakers:
            self.breakers[component] = CircuitBreaker(component, config)
            logger.info("Circuit breaker created", component=component)

        return self.breakers[component]

    async def protect(
        self,
        component: str,
        func: Callable,
        *args: Any,
        **kwargs: Any,
    ) -> Any:
        """
        Execute a function with circuit breaker protection.

        Args:
            component: Name of the component
            func: The async function to execute
            *args: Positional arguments for the function
            **kwargs: Keyword arguments for the function

        Returns:
            The result of the function call

        Raises:
            CircuitBreakerException: If circuit is open
            Exception: If the function call fails
        """
        breaker = self.get_breaker(component)
        return await breaker.call(func, *args, **kwargs)

    def get_all_states(self) -> dict[str, CircuitState]:
        """
        Get states of all circuit breakers.

        Returns:
            Dictionary mapping component names to their states
        """
        return {name: breaker.get_state() for name, breaker in self.breakers.items()}

    def get_all_metrics(self) -> dict[str, CircuitBreakerMetrics]:
        """
        Get metrics for all circuit breakers.

        Returns:
            Dictionary mapping component names to their metrics
        """
        return {name: breaker.get_metrics() for name, breaker in self.breakers.items()}

    async def force_open(self, component: str) -> None:
        """
        Manually force a circuit breaker to OPEN state.

        Args:
            component: Name of the component
        """
        if component in self.breakers:
            await self.breakers[component].force_open()
        else:
            logger.warning(
                "Cannot force open non-existent circuit breaker",
                component=component,
            )

    async def force_close(self, component: str) -> None:
        """
        Manually force a circuit breaker to CLOSED state.

        Args:
            component: Name of the component
        """
        if component in self.breakers:
            await self.breakers[component].force_close()
        else:
            logger.warning(
                "Cannot force close non-existent circuit breaker",
                component=component,
            )

    def reset_all(self) -> None:
        """Reset all circuit breakers (for testing)."""
        self.breakers.clear()
        logger.info("All circuit breakers reset")


# Singleton instance
_circuit_breaker_manager: CircuitBreakerManager | None = None


def get_circuit_breaker_manager() -> CircuitBreakerManager:
    """Get the singleton circuit breaker manager instance."""
    global _circuit_breaker_manager
    if _circuit_breaker_manager is None:
        _circuit_breaker_manager = CircuitBreakerManager()
    return _circuit_breaker_manager
