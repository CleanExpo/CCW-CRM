"""
Test suite for Circuit Breaker Service.

Tests the circuit breaker pattern implementation for autonomous development.
Part of Phase 5 (Autonomous Development Framework) - Week 2 tests.
"""

import asyncio

import pytest

from src.services.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerConfig,
    CircuitBreakerException,
    CircuitBreakerManager,
    CircuitState,
)

# ============================================================
# HELPER FUNCTIONS
# ============================================================


async def successful_operation() -> str:
    """Simulated successful operation."""
    await asyncio.sleep(0.01)
    return "success"


async def failing_operation() -> None:
    """Simulated failing operation."""
    await asyncio.sleep(0.01)
    raise RuntimeError("Operation failed")


# ============================================================
# CIRCUIT BREAKER TESTS
# ============================================================


class TestCircuitBreaker:
    """Test suite for CircuitBreaker."""

    @pytest.fixture
    def circuit_breaker(self):
        """Create a circuit breaker with custom config."""
        config = CircuitBreakerConfig(
            failure_threshold=3,
            success_threshold=2,
            timeout_seconds=2,
            half_open_max_calls=2,
        )
        return CircuitBreaker(name="test-component", config=config)

    @pytest.mark.asyncio
    async def test_initialization(self, circuit_breaker):
        """Test circuit breaker initialization."""
        assert circuit_breaker.name == "test-component"
        assert circuit_breaker.state == CircuitState.CLOSED
        assert circuit_breaker.metrics.total_calls == 0
        assert circuit_breaker.metrics.failed_calls == 0
        assert circuit_breaker.metrics.successful_calls == 0

    @pytest.mark.asyncio
    async def test_successful_call_in_closed_state(self, circuit_breaker):
        """Test successful call when circuit is closed."""
        result = await circuit_breaker.call(successful_operation)

        assert result == "success"
        assert circuit_breaker.state == CircuitState.CLOSED
        assert circuit_breaker.metrics.total_calls == 1
        assert circuit_breaker.metrics.successful_calls == 1
        assert circuit_breaker.metrics.failed_calls == 0

    @pytest.mark.asyncio
    async def test_failed_call_in_closed_state(self, circuit_breaker):
        """Test failed call when circuit is closed."""
        with pytest.raises(RuntimeError, match="Operation failed"):
            await circuit_breaker.call(failing_operation)

        assert circuit_breaker.state == CircuitState.CLOSED
        assert circuit_breaker.metrics.total_calls == 1
        assert circuit_breaker.metrics.successful_calls == 0
        assert circuit_breaker.metrics.failed_calls == 1
        assert circuit_breaker.metrics.consecutive_failures == 1

    @pytest.mark.asyncio
    async def test_circuit_opens_after_threshold_failures(self, circuit_breaker):
        """Test circuit opens after reaching failure threshold."""
        # Fail 3 times (threshold)
        for _ in range(3):
            with pytest.raises(RuntimeError):
                await circuit_breaker.call(failing_operation)

        # Circuit should now be open
        assert circuit_breaker.state == CircuitState.OPEN
        assert circuit_breaker.metrics.consecutive_failures == 3
        assert circuit_breaker.opened_at is not None

    @pytest.mark.asyncio
    async def test_calls_rejected_when_open(self, circuit_breaker):
        """Test calls are rejected when circuit is open."""
        # Force circuit open
        await circuit_breaker.force_open()

        # Try to call - should be rejected
        with pytest.raises(CircuitBreakerException) as exc_info:
            await circuit_breaker.call(successful_operation)

        assert "test-component" in str(exc_info.value)
        assert circuit_breaker.metrics.rejected_calls == 1

    @pytest.mark.asyncio
    async def test_circuit_transitions_to_half_open_after_timeout(self, circuit_breaker):
        """Test circuit transitions to half-open after timeout."""
        # Force circuit open
        await circuit_breaker.force_open()
        assert circuit_breaker.state == CircuitState.OPEN

        # Wait for timeout (2 seconds)
        await asyncio.sleep(2.1)

        # Next call attempt should transition to half-open
        try:
            await circuit_breaker.call(successful_operation)
        except CircuitBreakerException:
            pass

        # Should have transitioned to half-open
        assert circuit_breaker.state == CircuitState.HALF_OPEN

    @pytest.mark.asyncio
    async def test_half_open_limits_calls(self, circuit_breaker):
        """Test half-open state limits number of calls."""
        # Force to half-open
        circuit_breaker.state = CircuitState.HALF_OPEN

        # First call allowed
        result = await circuit_breaker.call(successful_operation)
        assert result == "success"
        # After first success, still in half-open (needs 2 successes to close)
        assert circuit_breaker.state == CircuitState.HALF_OPEN

        # Second call allowed and closes circuit (threshold reached)
        result = await circuit_breaker.call(successful_operation)
        assert result == "success"
        # Circuit should close after 2 successes (success_threshold=2)
        assert circuit_breaker.state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_half_open_closes_after_success_threshold(self, circuit_breaker):
        """Test circuit closes after success threshold in half-open."""
        # Force to half-open
        circuit_breaker.state = CircuitState.HALF_OPEN

        # 2 successful calls (threshold)
        await circuit_breaker.call(successful_operation)
        await circuit_breaker.call(successful_operation)

        # Circuit should close
        assert circuit_breaker.state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_half_open_reopens_on_failure(self, circuit_breaker):
        """Test circuit reopens if failure occurs in half-open."""
        # Force to half-open
        circuit_breaker.state = CircuitState.HALF_OPEN

        # One success
        await circuit_breaker.call(successful_operation)
        assert circuit_breaker.state == CircuitState.HALF_OPEN

        # One failure - should reopen
        with pytest.raises(RuntimeError):
            await circuit_breaker.call(failing_operation)

        assert circuit_breaker.state == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_consecutive_failures_tracked(self, circuit_breaker):
        """Test consecutive failures are tracked correctly."""
        # Fail twice
        for _ in range(2):
            with pytest.raises(RuntimeError):
                await circuit_breaker.call(failing_operation)

        assert circuit_breaker.metrics.consecutive_failures == 2

        # Success resets counter
        await circuit_breaker.call(successful_operation)
        assert circuit_breaker.metrics.consecutive_failures == 0
        assert circuit_breaker.metrics.consecutive_successes == 1

    @pytest.mark.asyncio
    async def test_consecutive_successes_tracked(self, circuit_breaker):
        """Test consecutive successes are tracked correctly."""
        # Succeed twice
        await circuit_breaker.call(successful_operation)
        await circuit_breaker.call(successful_operation)

        assert circuit_breaker.metrics.consecutive_successes == 2

        # Failure resets counter
        with pytest.raises(RuntimeError):
            await circuit_breaker.call(failing_operation)

        assert circuit_breaker.metrics.consecutive_successes == 0
        assert circuit_breaker.metrics.consecutive_failures == 1

    @pytest.mark.asyncio
    async def test_force_open(self, circuit_breaker):
        """Test manually forcing circuit open."""
        assert circuit_breaker.state == CircuitState.CLOSED

        await circuit_breaker.force_open()

        assert circuit_breaker.state == CircuitState.OPEN
        assert circuit_breaker.opened_at is not None

    @pytest.mark.asyncio
    async def test_force_close(self, circuit_breaker):
        """Test manually forcing circuit closed."""
        # Open the circuit
        await circuit_breaker.force_open()
        assert circuit_breaker.state == CircuitState.OPEN

        # Force close
        await circuit_breaker.force_close()

        assert circuit_breaker.state == CircuitState.CLOSED
        assert circuit_breaker.opened_at is None

    @pytest.mark.asyncio
    async def test_get_metrics(self, circuit_breaker):
        """Test retrieving circuit breaker metrics."""
        # Make some calls
        await circuit_breaker.call(successful_operation)
        with pytest.raises(RuntimeError):
            await circuit_breaker.call(failing_operation)

        metrics = circuit_breaker.get_metrics()

        assert metrics.total_calls == 2
        assert metrics.successful_calls == 1
        assert metrics.failed_calls == 1
        assert metrics.last_success_time is not None
        assert metrics.last_failure_time is not None

    @pytest.mark.asyncio
    async def test_get_state(self, circuit_breaker):
        """Test retrieving circuit breaker state."""
        assert circuit_breaker.get_state() == CircuitState.CLOSED

        await circuit_breaker.force_open()
        assert circuit_breaker.get_state() == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_is_available(self, circuit_breaker):
        """Test checking if circuit breaker is available."""
        assert circuit_breaker.is_available() is True

        await circuit_breaker.force_open()
        assert circuit_breaker.is_available() is False

        await circuit_breaker.force_close()
        assert circuit_breaker.is_available() is True

    @pytest.mark.asyncio
    async def test_state_transitions_recorded(self, circuit_breaker):
        """Test state transitions are recorded."""
        # Initial state
        assert len(circuit_breaker.metrics.state_transitions) == 1
        assert circuit_breaker.metrics.state_transitions[0][0] == CircuitState.CLOSED

        # Open circuit
        await circuit_breaker.force_open()
        assert len(circuit_breaker.metrics.state_transitions) == 2
        assert circuit_breaker.metrics.state_transitions[1][0] == CircuitState.OPEN

        # Close circuit
        await circuit_breaker.force_close()
        assert len(circuit_breaker.metrics.state_transitions) == 3
        assert circuit_breaker.metrics.state_transitions[2][0] == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_metrics_record_prometheus_state(self, circuit_breaker):
        """Test that state changes are recorded to Prometheus metrics."""
        # Initial state (CLOSED = 0)
        await circuit_breaker.force_open()  # OPEN = 1
        await circuit_breaker.force_close()  # CLOSED = 0

        # Metrics should be recorded (can't directly assert, but execution should not fail)
        assert circuit_breaker.state == CircuitState.CLOSED


# ============================================================
# CIRCUIT BREAKER MANAGER TESTS
# ============================================================


class TestCircuitBreakerManager:
    """Test suite for CircuitBreakerManager."""

    @pytest.fixture
    def manager(self):
        """Create a circuit breaker manager."""
        mgr = CircuitBreakerManager()
        # Reset for clean state
        mgr.reset_all()
        return mgr

    @pytest.mark.asyncio
    async def test_manager_initialization(self, manager):
        """Test circuit breaker manager initialization."""
        assert len(manager.breakers) == 0

    @pytest.mark.asyncio
    async def test_get_breaker_creates_new(self, manager):
        """Test getting a breaker creates it if it doesn't exist."""
        breaker = manager.get_breaker("component-a")

        assert breaker is not None
        assert breaker.name == "component-a"
        assert "component-a" in manager.breakers

    @pytest.mark.asyncio
    async def test_get_breaker_returns_existing(self, manager):
        """Test getting a breaker returns existing instance."""
        breaker1 = manager.get_breaker("component-a")
        breaker2 = manager.get_breaker("component-a")

        assert breaker1 is breaker2

    @pytest.mark.asyncio
    async def test_get_breaker_with_custom_config(self, manager):
        """Test creating breaker with custom configuration."""
        config = CircuitBreakerConfig(failure_threshold=10)
        breaker = manager.get_breaker("component-b", config)

        assert breaker.config.failure_threshold == 10

    @pytest.mark.asyncio
    async def test_protect_successful_call(self, manager):
        """Test protecting a successful call."""
        result = await manager.protect("component-a", successful_operation)

        assert result == "success"
        breaker = manager.get_breaker("component-a")
        assert breaker.metrics.successful_calls == 1

    @pytest.mark.asyncio
    async def test_protect_failed_call(self, manager):
        """Test protecting a failed call."""
        with pytest.raises(RuntimeError):
            await manager.protect("component-a", failing_operation)

        breaker = manager.get_breaker("component-a")
        assert breaker.metrics.failed_calls == 1

    @pytest.mark.asyncio
    async def test_protect_multiple_components(self, manager):
        """Test protecting calls for multiple components."""
        # Component A succeeds
        await manager.protect("component-a", successful_operation)

        # Component B fails
        with pytest.raises(RuntimeError):
            await manager.protect("component-b", failing_operation)

        # Check separate breakers
        breaker_a = manager.get_breaker("component-a")
        breaker_b = manager.get_breaker("component-b")

        assert breaker_a.metrics.successful_calls == 1
        assert breaker_a.metrics.failed_calls == 0
        assert breaker_b.metrics.successful_calls == 0
        assert breaker_b.metrics.failed_calls == 1

    @pytest.mark.asyncio
    async def test_get_all_states(self, manager):
        """Test getting states of all circuit breakers."""
        # Create two breakers
        await manager.protect("component-a", successful_operation)
        await manager.protect("component-b", successful_operation)

        # Open one
        await manager.force_open("component-a")

        states = manager.get_all_states()

        assert states["component-a"] == CircuitState.OPEN
        assert states["component-b"] == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_get_all_metrics(self, manager):
        """Test getting metrics for all circuit breakers."""
        # Make some calls
        await manager.protect("component-a", successful_operation)
        with pytest.raises(RuntimeError):
            await manager.protect("component-b", failing_operation)

        metrics = manager.get_all_metrics()

        assert "component-a" in metrics
        assert "component-b" in metrics
        assert metrics["component-a"].successful_calls == 1
        assert metrics["component-b"].failed_calls == 1

    @pytest.mark.asyncio
    async def test_force_open_component(self, manager):
        """Test manually forcing a component's circuit open."""
        # Create breaker
        manager.get_breaker("component-a")

        # Force open
        await manager.force_open("component-a")

        breaker = manager.get_breaker("component-a")
        assert breaker.state == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_force_close_component(self, manager):
        """Test manually forcing a component's circuit closed."""
        # Create and open breaker
        await manager.force_open("component-a")

        # Force close
        await manager.force_close("component-a")

        breaker = manager.get_breaker("component-a")
        assert breaker.state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_force_open_nonexistent_component(self, manager):
        """Test forcing open a non-existent component doesn't error."""
        # Should not raise exception
        await manager.force_open("nonexistent")

        # Should not create the breaker
        assert "nonexistent" not in manager.breakers

    @pytest.mark.asyncio
    async def test_force_close_nonexistent_component(self, manager):
        """Test forcing close a non-existent component doesn't error."""
        # Should not raise exception
        await manager.force_close("nonexistent")

        # Should not create the breaker
        assert "nonexistent" not in manager.breakers

    @pytest.mark.asyncio
    async def test_reset_all(self, manager):
        """Test resetting all circuit breakers."""
        # Create some breakers
        manager.get_breaker("component-a")
        manager.get_breaker("component-b")
        assert len(manager.breakers) == 2

        # Reset
        manager.reset_all()

        assert len(manager.breakers) == 0


# ============================================================
# INTEGRATION TESTS
# ============================================================


class TestCircuitBreakerIntegration:
    """Integration tests for circuit breaker in real scenarios."""

    @pytest.fixture
    def manager(self):
        """Create a circuit breaker manager."""
        mgr = CircuitBreakerManager()
        mgr.reset_all()
        return mgr

    @pytest.mark.asyncio
    async def test_autonomous_deployment_circuit_breaker(self, manager):
        """Test circuit breaker for autonomous deployments."""
        config = CircuitBreakerConfig(
            failure_threshold=3,
            success_threshold=2,
            timeout_seconds=1,
        )
        manager.get_breaker("autonomous-deployment", config)

        # Simulate 3 failed deployments
        for _ in range(3):
            with pytest.raises(RuntimeError):
                await manager.protect("autonomous-deployment", failing_operation)

        # Circuit should be open
        breaker = manager.get_breaker("autonomous-deployment")
        assert breaker.state == CircuitState.OPEN

        # Further deployment attempts should be rejected
        with pytest.raises(CircuitBreakerException):
            await manager.protect("autonomous-deployment", successful_operation)

    @pytest.mark.asyncio
    async def test_ai_agent_circuit_breaker(self, manager):
        """Test circuit breaker for AI agent failures."""
        config = CircuitBreakerConfig(failure_threshold=5)
        manager.get_breaker("ai-agent", config)

        # Simulate 5 AI agent failures
        for _ in range(5):
            with pytest.raises(RuntimeError):
                await manager.protect("ai-agent", failing_operation)

        # Circuit should be open
        states = manager.get_all_states()
        assert states["ai-agent"] == CircuitState.OPEN

    @pytest.mark.asyncio
    async def test_external_api_circuit_breaker(self, manager):
        """Test circuit breaker for external API calls."""
        # Simulate external API with intermittent failures
        call_count = 0

        async def flaky_api():
            nonlocal call_count
            call_count += 1
            if call_count <= 3:
                raise RuntimeError("API timeout")
            return "success"

        config = CircuitBreakerConfig(
            failure_threshold=3,
            timeout_seconds=1,
        )
        manager.get_breaker("external-api", config)

        # First 3 calls fail - circuit opens
        for _ in range(3):
            with pytest.raises(RuntimeError):
                await manager.protect("external-api", flaky_api)

        breaker = manager.get_breaker("external-api")
        assert breaker.state == CircuitState.OPEN

        # Wait for timeout
        await asyncio.sleep(1.1)

        # Next call transitions to half-open and succeeds
        result = await manager.protect("external-api", flaky_api)
        assert result == "success"

    @pytest.mark.asyncio
    async def test_multiple_components_independent(self, manager):
        """Test circuit breakers for multiple components are independent."""
        # Create component A with low threshold
        config_a = CircuitBreakerConfig(failure_threshold=3)
        manager.get_breaker("component-a", config_a)

        # Component A fails and opens (3 failures, threshold=3)
        for _ in range(3):
            with pytest.raises(RuntimeError):
                await manager.protect("component-a", failing_operation)

        # Component B succeeds
        await manager.protect("component-b", successful_operation)

        states = manager.get_all_states()
        assert states["component-a"] == CircuitState.OPEN
        assert states["component-b"] == CircuitState.CLOSED

        # Component B should still work
        result = await manager.protect("component-b", successful_operation)
        assert result == "success"

        # Component A should be blocked
        with pytest.raises(CircuitBreakerException):
            await manager.protect("component-a", successful_operation)

    @pytest.mark.asyncio
    async def test_circuit_breaker_recovery_flow(self, manager):
        """Test complete recovery flow: CLOSED → OPEN → HALF_OPEN → CLOSED."""
        config = CircuitBreakerConfig(
            failure_threshold=2,
            success_threshold=2,
            timeout_seconds=1,
        )
        manager.get_breaker("test-component", config)

        # 1. CLOSED: Fail twice to open
        for _ in range(2):
            with pytest.raises(RuntimeError):
                await manager.protect("test-component", failing_operation)

        breaker = manager.get_breaker("test-component")
        assert breaker.state == CircuitState.OPEN

        # 2. OPEN: Wait for timeout
        await asyncio.sleep(1.1)

        # 3. HALF_OPEN: Two successful calls to close
        await manager.protect("test-component", successful_operation)
        assert breaker.state == CircuitState.HALF_OPEN

        await manager.protect("test-component", successful_operation)

        # 4. CLOSED: Circuit fully recovered
        assert breaker.state == CircuitState.CLOSED

        # Verify normal operation resumed
        result = await manager.protect("test-component", successful_operation)
        assert result == "success"
