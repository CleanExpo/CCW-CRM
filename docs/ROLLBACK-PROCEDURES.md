# Rollback Procedures

**Phase 5 - Week 2: Autonomous Development Rollback Mechanism**

This guide explains how to use the automatic rollback system to recover from failed deployments and merges.

---

## Overview

The rollback system consists of:
- **RollbackAgent**: Autonomous agent that plans and executes rollbacks
- **DeploymentService**: Deployment orchestration with automatic rollback integration
- **Prometheus Metrics**: Real-time rollback tracking and alerting
- **Trigger Detection**: Automatic detection of failures requiring rollback

---

## Quick Start

### Automatic Rollback (Default)

Rollbacks trigger automatically on:
- ✅ **Test Failures** - Critical test suite failures
- ✅ **Build Failures** - Compilation or build errors
- ✅ **Runtime Errors** - Error rate exceeds 5%
- ✅ **Health Check Failures** - 3+ consecutive health check failures
- ✅ **Manual Triggers** - Operator-initiated rollbacks

No manual intervention required for automatic rollbacks.

### Manual Rollback

```python
from src.ai.agents.rollback_agent import get_rollback_agent, RollbackTrigger

rollback_agent = get_rollback_agent()

# Create rollback plan
plan = await rollback_agent.create_rollback_plan(
    trigger=RollbackTrigger.MANUAL,
    current_commit="abc123def456",
    target_commit="xyz789uvw123",  # Optional, defaults to previous commit
    affected_components=["backend", "frontend"],
)

# Execute rollback
result = await rollback_agent.execute_rollback(
    plan=plan,
    rollback_id="rollback-123",
    dry_run=False,  # Set to True to simulate without changes
)

print(f"Rollback status: {result.status}")
print(f"Duration: {result.duration_seconds}s")
```

---

## Rollback Triggers

### 1. Test Failure Rollback

**Trigger Condition**: Critical test failures detected post-deployment

**Criteria**:
```python
failure_details = {
    "critical_test_failures": 5  # Must be > 0
}
```

**Automatic Actions**:
1. Stop deployment pipeline
2. Create rollback plan
3. Execute git revert to previous passing commit
4. Re-run test suite
5. Verify all tests pass

**Metrics Recorded**:
- `rollbacks_triggered_total{trigger_reason="test_failure"}`
- `rollback_duration_seconds`
- `test_executions_total{suite="rollback_verification"}`

---

### 2. Build Failure Rollback

**Trigger Condition**: Build or compilation fails

**Criteria**: Any build failure triggers immediate rollback

**Automatic Actions**:
1. Stop deployment pipeline
2. Revert to last successful build
3. Re-run build process
4. Verify build succeeds
5. Deploy previous version

**Metrics Recorded**:
- `rollbacks_triggered_total{trigger_reason="build_failure"}`
- `deployment_failures_total{stage="build"}`

---

### 3. Runtime Error Rollback

**Trigger Condition**: Error rate exceeds threshold

**Criteria**:
```python
failure_details = {
    "error_rate": 0.10  # 10% error rate (threshold: 5%)
}
```

**Requires Manual Approval**: Yes (due to potential false positives)

**Automatic Actions**:
1. Alert operators
2. Create rollback plan
3. Wait for approval
4. Execute rollback if approved
5. Monitor error rates

**Metrics Recorded**:
- `rollbacks_triggered_total{trigger_reason="runtime_error"}`
- `autonomous_system_errors_total{component="deployment"}`

---

### 4. Health Check Failure Rollback

**Trigger Condition**: Service health checks fail repeatedly

**Criteria**:
```python
failure_details = {
    "consecutive_failures": 3  # Must be >= 3
}
```

**Automatic Actions**:
1. Stop sending traffic to unhealthy instances
2. Create rollback plan
3. Execute rollback
4. Verify health checks pass
5. Resume normal traffic

**Metrics Recorded**:
- `rollbacks_triggered_total{trigger_reason="health_check_failure"}`
- `deployment_failures_total{stage="verify"}`

---

### 5. Manual Rollback

**Trigger Condition**: Operator manually initiates rollback

**Use Cases**:
- Unexpected behavior not caught by automated checks
- Performance degradation
- Customer-reported critical issues
- Preventive rollback before issue escalates

**How to Trigger**:

**Option 1: Via Python API** (see Quick Start above)

**Option 2: Via CLI** (coming soon)
```bash
python -m src.cli.rollback trigger --commit abc123 --reason manual
```

**Option 3: Via Dashboard** (coming soon)
- Navigate to Deployments → Recent Deployments
- Select deployment to rollback
- Click "Trigger Rollback"
- Confirm action

---

## Rollback Process

### Phase 1: Detection (Automatic)

```
┌─────────────────────────────────────┐
│ Deployment Monitoring                │
├─────────────────────────────────────┤
│ • Test results                      │
│ • Build status                      │
│ • Error rates                       │
│ • Health checks                     │
└──────────┬──────────────────────────┘
           │
           ▼
     Failure Detected
           │
           ▼
┌─────────────────────────────────────┐
│ Should Trigger Rollback?            │
├─────────────────────────────────────┤
│ • Check trigger criteria            │
│ • Verify cooldown period            │
│ • Check approval requirements       │
└──────────┬──────────────────────────┘
           │
           ▼
      Rollback Initiated
```

### Phase 2: Planning

```python
# Rollback plan includes:
plan = RollbackPlan(
    trigger=RollbackTrigger.TEST_FAILURE,
    target_commit="xyz789",  # Previous known-good commit
    affected_components=["backend", "frontend"],
    strategy=RollbackStrategy.GIT_REVERT,
    estimated_duration_seconds=60,
    requires_manual_approval=False,
    safety_checks=[
        "Verify target commit exists",
        "Check for uncommitted changes",
        "Backup current state",
        "Verify no ongoing deployments",
    ],
    rollback_steps=[
        "Git checkout xyz789",
        "Run database migration rollback (if needed)",
        "Restart affected services",
        "Clear caches",
        "Run smoke tests",
    ],
    verification_steps=[
        "Health check all services",
        "Verify critical endpoints responding",
        "Check error rates < 1%",
        "Verify database integrity",
    ],
)
```

### Phase 3: Execution

```
┌─────────────────────────────────────┐
│ 1. Safety Checks                    │
├─────────────────────────────────────┤
│ ✓ Target commit exists              │
│ ✓ No uncommitted changes            │
│ ✓ Current state backed up           │
│ ✓ No ongoing deployments            │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ 2. Execute Rollback Steps           │
├─────────────────────────────────────┤
│ ✓ Git revert to target commit       │
│ ✓ Rollback database migrations      │
│ ✓ Restart services                  │
│ ✓ Clear caches                      │
│ ✓ Run smoke tests                   │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ 3. Verification                     │
├─────────────────────────────────────┤
│ ✓ Health checks pass                │
│ ✓ Endpoints responding              │
│ ✓ Error rates normal                │
│ ✓ Database integrity intact         │
└──────────┬──────────────────────────┘
           │
           ▼
     Rollback Complete
```

### Phase 4: Verification & Monitoring

After rollback completes:
1. **Immediate Checks** (0-5 minutes)
   - Service health endpoints
   - Critical API endpoints
   - Error rates
   - Response times

2. **Short-term Monitoring** (5-30 minutes)
   - User traffic patterns
   - Business metrics
   - Database query performance
   - Cache hit rates

3. **Long-term Validation** (30+ minutes)
   - No new errors introduced
   - Performance baselines restored
   - All features functional
   - Customer reports

---

## Rollback Cooldown

**Purpose**: Prevent rollback loops and cascading failures

**Duration**: 60 seconds between rollbacks

**Behavior**:
- If rollback triggered within cooldown period, it's rejected
- Logs warning: `"Rollback cooldown active, skipping"`
- Operators can override for manual rollbacks

**Example**:
```python
# First rollback at 10:00:00
result1 = await rollback_agent.execute_rollback(plan1, "rollback-1")
# Success, last_rollback_time = 10:00:05

# Second rollback at 10:00:20 (only 15 seconds later)
should_trigger = await rollback_agent.should_trigger_rollback(trigger, details)
# Returns False due to cooldown (45 seconds remaining)

# Third rollback at 10:01:30 (90 seconds later)
should_trigger = await rollback_agent.should_trigger_rollback(trigger, details)
# Returns True, cooldown expired
```

---

## Rollback Strategies

### 1. Git Revert (Default)

**When Used**: Most deployments

**How It Works**:
1. `git checkout <target_commit>`
2. Rebuild application
3. Restart services

**Pros**:
- Simple and fast
- Preserves git history
- Easy to verify

**Cons**:
- Requires rebuild
- May need database migration rollback

---

### 2. Previous Deployment

**When Used**: Production deployments with artifacts

**How It Works**:
1. Deploy previous known-good artifact (Docker image, tarball, etc.)
2. Restart services
3. No rebuild needed

**Pros**:
- Fastest rollback (no build)
- Predictable state

**Cons**:
- Requires artifact storage
- Database state may be inconsistent

---

### 3. Snapshot Restore

**When Used**: Database-heavy rollbacks

**How It Works**:
1. Restore database snapshot from before deployment
2. Restore application code
3. Restart services

**Pros**:
- Complete state restoration
- Handles complex database changes

**Cons**:
- Slowest rollback
- May lose recent data
- Requires snapshot infrastructure

---

### 4. Manual Intervention

**When Used**: Automated rollback fails

**How It Works**:
1. Alert operators
2. Provide rollback plan and logs
3. Operators manually execute rollback
4. Update rollback status

**Pros**:
- Human judgment for complex situations

**Cons**:
- Requires on-call engineer
- Slower response time
- Manual effort

---

## Monitoring Rollbacks

### Grafana Dashboard

Navigate to: **Autonomous Execution Overview** → **Rollbacks**

**Key Panels**:
1. **Rollbacks (24h)** - Total rollback count
2. **Rollback Reasons** - Pie chart of trigger reasons
3. **Rollback Duration** - Time to complete rollbacks
4. **Rollback Success Rate** - Percentage of successful rollbacks

### Prometheus Queries

```promql
# Total rollbacks by trigger reason (24h)
sum by (trigger_reason) (increase(rollbacks_triggered_total[24h]))

# Average rollback duration
histogram_quantile(0.5, rollback_duration_seconds_bucket)

# Rollback success rate
rate(rollbacks_successful_total[1h]) / rate(rollbacks_triggered_total[1h])

# Failed rollbacks requiring manual intervention
rate(rollbacks_failed_total[1h])
```

### Alerts

**Critical Alerts**:
- `rollbacks_failed_total > 0` → Manual intervention needed
- Rollback success rate < 90% → Investigate rollback issues

**Warning Alerts**:
- Rollbacks > 3 in 1 hour → Possible instability
- Rollback duration p95 > 120s → Rollback performance degraded

---

## Troubleshooting

### Rollback Failed

**Symptoms**:
- `rollback_status = FAILED`
- `requires_manual_intervention = True`
- Alert: "Rollback failed requiring manual intervention"

**Steps**:
1. Check rollback logs:
   ```python
   result = await rollback_agent.execute_rollback(...)
   print("\n".join(result.logs))
   ```

2. Identify failed step:
   - Safety checks failed? (uncommitted changes, missing commit)
   - Execution failed? (git conflicts, service restart issues)
   - Verification failed? (health checks, error rates)

3. Manually execute failed step:
   ```bash
   # Example: Manual git revert
   git checkout <target_commit>
   git reset --hard

   # Restart services
   docker-compose restart backend frontend

   # Verify health
   curl http://localhost:8000/health
   ```

4. Update rollback status:
   ```python
   # Mark as manually resolved
   # (API coming in Week 3)
   ```

---

### Rollback Partially Succeeded

**Symptoms**:
- `rollback_status = PARTIAL`
- Some components rolled back, others failed
- Services in mixed state

**Steps**:
1. Check which components failed:
   ```python
   print(f"Rolled back: {result.components_rolled_back}")
   print(f"Failed: {result.components_failed}")
   ```

2. Manually rollback failed components:
   ```bash
   # Example: Backend succeeded, frontend failed
   cd apps/frontend
   git checkout <target_commit>
   pnpm install
   pnpm build
   docker-compose restart frontend
   ```

3. Verify all components:
   ```bash
   # Health check each service
   curl http://localhost:8000/health  # Backend
   curl http://localhost:3000/health  # Frontend
   ```

---

### Rollback Cooldown Blocking

**Symptoms**:
- `should_trigger_rollback()` returns False
- Logs: "Rollback cooldown active"
- Urgent rollback needed but blocked

**Steps**:
1. Check last rollback time:
   ```python
   agent = get_rollback_agent()
   if agent.last_rollback_time:
       time_since = datetime.now(timezone.utc) - agent.last_rollback_time
       print(f"Last rollback: {time_since.total_seconds()}s ago")
   ```

2. Override cooldown (manual rollback only):
   ```python
   # Reset cooldown
   agent.last_rollback_time = None

   # Trigger rollback
   should_trigger = await agent.should_trigger_rollback(
       trigger=RollbackTrigger.MANUAL,
       failure_details={},
   )
   # Now returns True
   ```

---

### Verification Failures

**Symptoms**:
- Rollback executes but verification fails
- Health checks fail
- Error rates still elevated

**Steps**:
1. Give services time to stabilize:
   ```bash
   # Wait 30-60 seconds for services to fully restart
   sleep 60
   ```

2. Check service logs:
   ```bash
   docker logs ccw-backend
   docker logs ccw-frontend
   ```

3. Manually verify critical endpoints:
   ```bash
   curl -I http://localhost:8000/api/health
   curl -I http://localhost:8000/api/products
   ```

4. If still failing, escalate to previous commit:
   ```python
   # Rollback to earlier commit
   plan = await agent.create_rollback_plan(
       trigger=RollbackTrigger.MANUAL,
       current_commit="xyz789",  # Current (failed rollback)
       target_commit="uvw456",   # Go back further
   )
   ```

---

## Best Practices

### 1. Test Rollbacks in Staging

```bash
# Practice rollback in staging environment
python -m src.cli.rollback trigger \
    --environment staging \
    --commit abc123 \
    --dry-run  # Simulate first
```

### 2. Keep Rollback Windows Small

- Deploy frequently (daily or more)
- Small changesets = easier rollbacks
- Avoid large refactors in single commit

### 3. Monitor Post-Rollback

- Watch metrics for 30+ minutes after rollback
- Check for new errors introduced
- Verify business metrics restored

### 4. Document Rollback Reasons

```python
# Add detailed failure_details
failure_details = {
    "critical_test_failures": 3,
    "failed_tests": [
        "test_user_authentication",
        "test_payment_processing",
        "test_order_creation",
    ],
    "test_suite": "e2e",
    "commit": "abc123",
    "deployed_at": "2026-02-04T10:30:00Z",
}
```

### 5. Review Rollback Patterns

- Weekly: Review all rollbacks in Grafana
- Monthly: Analyze rollback trends
- Quarterly: Update rollback procedures based on learnings

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Deploy with Auto-Rollback

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Production
        id: deploy
        run: |
          python -m src.cli.deploy \
            --environment production \
            --commit ${{ github.sha }} \
            --auto-rollback

      - name: Check Deployment Status
        if: failure()
        run: |
          echo "Deployment failed, rollback triggered automatically"
          python -m src.cli.rollback status --deployment-id ${{ steps.deploy.outputs.id }}
```

---

## API Reference

### RollbackAgent Methods

```python
# Check if rollback should trigger
should_trigger = await agent.should_trigger_rollback(
    trigger: RollbackTrigger,
    failure_details: dict[str, Any],
) -> bool

# Create rollback plan
plan = await agent.create_rollback_plan(
    trigger: RollbackTrigger,
    current_commit: str,
    target_commit: str | None = None,
    affected_components: list[str] | None = None,
) -> RollbackPlan

# Execute rollback
result = await agent.execute_rollback(
    plan: RollbackPlan,
    rollback_id: str,
    dry_run: bool = False,
) -> RollbackResult
```

### DeploymentService Methods

```python
# Deploy with automatic rollback
result = await service.deploy(
    config: DeploymentConfig,
) -> DeploymentResult

# Get active deployments
active = service.get_active_deployments() -> list[DeploymentResult]
```

---

## Support

For issues or questions:
1. Check Grafana rollback dashboard
2. Review Prometheus rollback metrics
3. Check rollback logs in `result.logs`
4. Create issue in project repository with rollback ID

---

**Last Updated**: February 4, 2026
**Author**: Phase 5 Autonomous Development Team
**Version**: 1.0
