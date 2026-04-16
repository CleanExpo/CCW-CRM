# Circuit Breaker Guide

**Phase 5 - Week 2: Autonomous Development Circuit Breakers**

This guide explains how to use circuit breakers to prevent cascading failures in the autonomous development system.

---

## Overview

Circuit breakers protect the system from cascading failures by automatically disabling components that are repeatedly failing. They implement the **Circuit Breaker Pattern** with three states:

- **CLOSED** (Normal): All requests pass through
- **OPEN** (Failing): All requests fail fast (no execution)
- **HALF_OPEN** (Testing): Limited requests allowed to test recovery

---

## Quick Start

### Basic Usage

```python
from src.services.circuit_breaker import get_circuit_breaker_manager

manager = get_circuit_breaker_manager()

# Protect a function call
async def deploy_to_production():
    # Your deployment logic
    pass

try:
    result = await manager.protect("autonomous-deployment", deploy_to_production)
    print(f"Deployment successful: {result}")
except CircuitBreakerException as e:
    print(f"Circuit breaker open: {e}")
```

### Custom Configuration

```python
from src.services.circuit_breaker import CircuitBreakerConfig

config = CircuitBreakerConfig(
    failure_threshold=5,      # Open after 5 failures
    success_threshold=2,      # Close after 2 successes
    timeout_seconds=60,       # Wait 60s before trying half-open
    half_open_max_calls=3,    # Allow 3 calls in half-open
)

breaker = manager.get_breaker("my-component", config)
result = await breaker.call(my_function)
```

---

## Circuit Breaker States

### CLOSED (Normal Operation)

**Behavior:**

- All requests pass through to the protected function
- Failures are counted
- When failure threshold reached → transition to OPEN

**Example:**

```
Request → Circuit Breaker (CLOSED) → Function → Success/Failure
```

**Metrics:**

- `consecutive_failures`: Increments on each failure
- `consecutive_successes`: Resets to 0 on failure

---

### OPEN (Failing)

**Behavior:**

- All requests fail immediately (fast-fail)
- Protected function is NOT called
- After timeout period → transition to HALF_OPEN

**Example:**

```
Request → Circuit Breaker (OPEN) → CircuitBreakerException (no function call)
```

**Metrics:**

- `rejected_calls`: Increments for each rejected request
- Opens after `failure_threshold` consecutive failures

**Prometheus Alert:**

```promql
circuit_breaker_state{component="deployment"} == 1
```

---

### HALF_OPEN (Testing Recovery)

**Behavior:**

- Limited number of requests allowed through
- If all succeed → transition to CLOSED
- If any fail → transition to OPEN

**Example:**

```
Request 1 → Circuit Breaker (HALF_OPEN) → Function → Success (1/2)
Request 2 → Circuit Breaker (HALF_OPEN) → Function → Success (2/2) → CLOSED
```

**Metrics:**

- `half_open_calls`: Tracks calls in half-open state
- Max calls controlled by `half_open_max_calls` config

---

## Configuration

### CircuitBreakerConfig Parameters

| Parameter                | Default | Description                                   |
| ------------------------ | ------- | --------------------------------------------- |
| `failure_threshold`      | 5       | Consecutive failures before opening circuit   |
| `success_threshold`      | 2       | Consecutive successes to close from half-open |
| `timeout_seconds`        | 60      | Seconds to wait before trying half-open       |
| `half_open_max_calls`    | 3       | Max calls allowed in half-open state          |
| `rolling_window_seconds` | 300     | Window for counting failures (future use)     |

### Recommended Configurations

**Autonomous Deployment:**

```python
CircuitBreakerConfig(
    failure_threshold=3,      # Open after 3 failed deployments
    success_threshold=2,      # Close after 2 successful deployments
    timeout_seconds=300,      # Wait 5 minutes before retry
)
```

**AI Agent Calls:**

```python
CircuitBreakerConfig(
    failure_threshold=10,     # More tolerance for AI failures
    success_threshold=3,      # Require 3 successes to recover
    timeout_seconds=60,       # Retry after 1 minute
)
```

**External API Calls:**

```python
CircuitBreakerConfig(
    failure_threshold=5,      # Standard threshold
    success_threshold=2,      # Quick recovery
    timeout_seconds=30,       # Fast retry
)
```

**Database Operations:**

```python
CircuitBreakerConfig(
    failure_threshold=2,      # Low tolerance for DB failures
    success_threshold=3,      # Conservative recovery
    timeout_seconds=120,      # Wait 2 minutes
)
```

---

## Usage Patterns

### Pattern 1: Protecting Deployment Operations

```python
from src.services.circuit_breaker import get_circuit_breaker_manager
from src.ai.agents.rollback_agent import get_rollback_agent

manager = get_circuit_breaker_manager()
rollback_agent = get_rollback_agent()

async def deploy_with_circuit_breaker(commit_hash: str):
    """Deploy with circuit breaker protection."""

    try:
        result = await manager.protect(
            "autonomous-deployment",
            deploy_to_production,
            commit_hash=commit_hash,
        )
        return result

    except CircuitBreakerException:
        # Circuit open - too many deployment failures
        logger.error("Deployment circuit breaker open")

        # Trigger rollback
        await rollback_agent.trigger_rollback(
            trigger=RollbackTrigger.MANUAL,
            reason="Circuit breaker open",
        )

        raise
```

### Pattern 2: Protecting AI Agent Calls

```python
async def call_ai_agent_with_protection(task: str):
    """Call AI agent with circuit breaker protection."""

    manager = get_circuit_breaker_manager()

    async def ai_task():
        # Your AI agent logic
        return await agent.execute(task)

    try:
        return await manager.protect("ai-agent", ai_task)

    except CircuitBreakerException:
        # Circuit open - use fallback behavior
        logger.warning("AI agent circuit open, using fallback")
        return fallback_response(task)
```

### Pattern 3: Protecting External API Calls

```python
async def call_external_api_with_protection(endpoint: str):
    """Call external API with circuit breaker protection."""

    manager = get_circuit_breaker_manager()

    async def api_call():
        async with httpx.AsyncClient() as client:
            response = await client.get(endpoint, timeout=10)
            response.raise_for_status()
            return response.json()

    try:
        return await manager.protect("external-api", api_call)

    except CircuitBreakerException:
        # Circuit open - use cached data
        return get_cached_data(endpoint)
```

### Pattern 4: Manual Circuit Control

```python
# Manually open circuit (e.g., during maintenance)
await manager.force_open("component-name")

# Manually close circuit (e.g., after manual fix)
await manager.force_close("component-name")

# Check if circuit is available
breaker = manager.get_breaker("component-name")
if breaker.is_available():
    # Safe to call
    await breaker.call(my_function)
```

---

## Monitoring

### Grafana Dashboard

Navigate to: **System Health** → **Circuit Breakers**

**Key Panels:**

1. **Circuit Breaker Status** - Real-time state of all breakers
2. **Circuit Opens/Closes** - Frequency of state changes
3. **Rejected Calls** - Calls rejected while open
4. **Failure Rate by Component** - Component-specific failure tracking

### Prometheus Queries

```promql
# Circuit breaker states (0=CLOSED, 1=OPEN, 2=HALF_OPEN)
circuit_breaker_state{component="autonomous-deployment"}

# Circuit opens (last 24h)
sum by (component) (increase(circuit_breaker_opens_total[24h]))

# Circuit closes (last 24h)
sum by (component) (increase(circuit_breaker_closes_total[24h]))

# Components with open circuits
count(circuit_breaker_state == 1) by (component)

# Flip rate (opens + closes per hour)
rate(circuit_breaker_opens_total[1h]) + rate(circuit_breaker_closes_total[1h])
```

### Alerts

**Critical Alerts:**

- `circuit_breaker_state{component="deployment"} == 1` → Deployment circuit open
- `circuit_breaker_state{component="ai-agent"} == 1` → AI agent circuit open

**Warning Alerts:**

- `circuit_breaker_opens_total` > 5 in 1 hour → Unstable component
- Circuit open for > 10 minutes → Investigate root cause

---

## Troubleshooting

### Circuit Breaker Stuck Open

**Symptoms:**

- Circuit state = OPEN
- Timeout has passed but circuit not transitioning to HALF_OPEN
- Calls continue to be rejected

**Diagnosis:**

```python
breaker = manager.get_breaker("component-name")
print(f"State: {breaker.state}")
print(f"Opened at: {breaker.opened_at}")
print(f"Timeout: {breaker.config.timeout_seconds}s")

# Check if timeout passed
if breaker.opened_at:
    time_open = (datetime.now(timezone.utc) - breaker.opened_at).total_seconds()
    print(f"Time open: {time_open}s")
```

**Solution:**

```python
# Option 1: Wait for timeout
await asyncio.sleep(timeout_remaining)

# Option 2: Manually force close (if root cause fixed)
await manager.force_close("component-name")
```

---

### Circuit Flapping (Opening/Closing Repeatedly)

**Symptoms:**

- Circuit alternates between OPEN and CLOSED frequently
- High rate of `circuit_breaker_opens_total` and `circuit_breaker_closes_total`

**Diagnosis:**

```python
metrics = breaker.get_metrics()
print(f"State transitions: {len(metrics.state_transitions)}")
for state, timestamp in metrics.state_transitions[-10:]:
    print(f"  {state.value} at {timestamp}")
```

**Solution:**

1. **Increase failure threshold:**

   ```python
   config = CircuitBreakerConfig(failure_threshold=10)  # More tolerance
   ```

2. **Increase timeout:**

   ```python
   config = CircuitBreakerConfig(timeout_seconds=300)  # 5 minutes
   ```

3. **Increase success threshold:**
   ```python
   config = CircuitBreakerConfig(success_threshold=5)  # Require more successes
   ```

---

### Too Many Rejected Calls

**Symptoms:**

- High `rejected_calls` metric
- Users experiencing failures
- Circuit open for extended period

**Diagnosis:**

```python
metrics = breaker.get_metrics()
print(f"Rejected calls: {metrics.rejected_calls}")
print(f"Last failure: {metrics.last_failure_time}")
print(f"Consecutive failures: {metrics.consecutive_failures}")
```

**Solution:**

1. **Investigate root cause:**
   - Check logs for failure reasons
   - Review recent deployments
   - Check external dependencies

2. **Implement fallback:**

   ```python
   try:
       result = await manager.protect("component", operation)
   except CircuitBreakerException:
       result = fallback_operation()
   ```

3. **Manual intervention:**
   ```python
   # Fix the issue, then close circuit
   await manager.force_close("component-name")
   ```

---

### Circuit Not Opening When Expected

**Symptoms:**

- Component failing repeatedly
- Circuit remains CLOSED
- No automatic protection

**Diagnosis:**

```python
metrics = breaker.get_metrics()
print(f"Consecutive failures: {metrics.consecutive_failures}")
print(f"Failure threshold: {breaker.config.failure_threshold}")
print(f"Failed calls: {metrics.failed_calls}")
```

**Possible Causes:**

1. **Successes between failures reset counter:**
   - Circuit requires _consecutive_ failures
   - Intermittent successes reset the counter

2. **Threshold not reached:**
   - Not enough consecutive failures yet

3. **Exception not raised:**
   - Function returns without raising exception
   - Circuit doesn't count as failure

**Solution:**

```python
# Lower threshold
config = CircuitBreakerConfig(failure_threshold=2)

# Manually open if needed
await manager.force_open("component-name")
```

---

## Best Practices

### 1. Use Appropriate Thresholds

```python
# LOW-RISK OPERATIONS (docs, UI, non-critical)
CircuitBreakerConfig(failure_threshold=10, timeout_seconds=30)

# MEDIUM-RISK OPERATIONS (APIs, integrations)
CircuitBreakerConfig(failure_threshold=5, timeout_seconds=60)

# HIGH-RISK OPERATIONS (deployments, database)
CircuitBreakerConfig(failure_threshold=3, timeout_seconds=300)

# CRITICAL OPERATIONS (auth, billing)
CircuitBreakerConfig(failure_threshold=2, timeout_seconds=600)
```

### 2. Implement Fallbacks

Always provide fallback behavior when circuit opens:

```python
try:
    result = await manager.protect("component", operation)
except CircuitBreakerException:
    # Fallback options:
    # 1. Use cached data
    # 2. Return default value
    # 3. Degrade functionality gracefully
    # 4. Queue for later processing
    result = get_fallback_value()
```

### 3. Monitor Circuit Health

```python
# Regularly check circuit states
states = manager.get_all_states()
for component, state in states.items():
    if state == CircuitState.OPEN:
        logger.error(f"Circuit open: {component}")
        alert_operations_team(component)
```

### 4. Test Circuit Behavior

```python
# Test circuit opening
for _ in range(config.failure_threshold):
    with pytest.raises(Exception):
        await manager.protect("test", failing_operation)

assert breaker.state == CircuitState.OPEN

# Test circuit recovery
await asyncio.sleep(config.timeout_seconds + 0.1)
for _ in range(config.success_threshold):
    await manager.protect("test", successful_operation)

assert breaker.state == CircuitState.CLOSED
```

### 5. Log Circuit Events

```python
# Circuit events are automatically logged with structlog
# Review logs for patterns:
# - "Circuit breaker opened"
# - "Circuit breaker closed"
# - "Circuit breaker open, rejecting call"
```

---

## Integration with Autonomous Development

### Deployment Pipeline Integration

```python
from src.services.circuit_breaker import get_circuit_breaker_manager
from src.services.deployment_service import get_deployment_service

async def autonomous_deploy(config: DeploymentConfig):
    """Deploy with circuit breaker protection."""

    manager = get_circuit_breaker_manager()
    deployment_service = get_deployment_service()

    try:
        result = await manager.protect(
            "autonomous-deployment",
            deployment_service.deploy,
            config,
        )
        return result

    except CircuitBreakerException:
        # Deployment circuit open - alert and halt autonomous deployments
        logger.error("Autonomous deployment circuit open")
        await alert_team("Autonomous deployments halted due to repeated failures")
        raise
```

### Rollback Integration

```python
# If deployment circuit opens, trigger rollback of all recent deployments
breaker = manager.get_breaker("autonomous-deployment")

if breaker.state == CircuitState.OPEN:
    rollback_agent = get_rollback_agent()

    # Rollback last 3 deployments
    recent_deployments = get_recent_deployments(limit=3)
    for deployment in recent_deployments:
        await rollback_agent.rollback(deployment.id)
```

### AI Agent Integration

```python
# Protect AI agent calls with circuit breaker
async def ai_agent_with_protection(task: str):
    manager = get_circuit_breaker_manager()

    config = CircuitBreakerConfig(
        failure_threshold=10,  # AI can be flaky
        timeout_seconds=60,
    )

    breaker = manager.get_breaker("ai-agent", config)

    try:
        return await breaker.call(ai_agent.execute, task)
    except CircuitBreakerException:
        # Fall back to simpler logic without AI
        return simple_rule_based_handler(task)
```

---

## API Reference

### CircuitBreaker Class

```python
class CircuitBreaker:
    def __init__(self, name: str, config: CircuitBreakerConfig | None = None)

    async def call(self, func: Callable, *args, **kwargs) -> Any
    async def force_open(self) -> None
    async def force_close(self) -> None

    def get_metrics(self) -> CircuitBreakerMetrics
    def get_state(self) -> CircuitState
    def is_available(self) -> bool
```

### CircuitBreakerManager Class

```python
class CircuitBreakerManager:
    def get_breaker(self, component: str, config: CircuitBreakerConfig | None = None) -> CircuitBreaker

    async def protect(self, component: str, func: Callable, *args, **kwargs) -> Any
    async def force_open(self, component: str) -> None
    async def force_close(self, component: str) -> None

    def get_all_states(self) -> dict[str, CircuitState]
    def get_all_metrics(self) -> dict[str, CircuitBreakerMetrics]
    def reset_all(self) -> None
```

### CircuitBreakerConfig Class

```python
@dataclass
class CircuitBreakerConfig:
    failure_threshold: int = 5
    success_threshold: int = 2
    timeout_seconds: int = 60
    half_open_max_calls: int = 3
    rolling_window_seconds: int = 300
```

---

## Support

For issues or questions:

1. Check Grafana circuit breaker dashboard
2. Review Prometheus circuit breaker metrics
3. Check circuit breaker logs with structlog
4. Create issue in project repository with component name

---

**Last Updated**: February 4, 2026
**Author**: Phase 5 Autonomous Development Team
**Version**: 1.0
