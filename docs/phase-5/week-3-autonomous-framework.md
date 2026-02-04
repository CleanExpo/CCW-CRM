# Phase 5 Week 3: Autonomous Development Framework

> **Status**: ✅ Complete
> **Completion Date**: February 4, 2026
> **PR**: [#5](https://github.com/CleanExpo/CCW-CRM/pull/5)

## Overview

Week 3 delivers the core autonomous development framework, enabling AI agents to automatically create, review, and merge pull requests based on configurable autonomy levels with comprehensive safety mechanisms.

## What Was Built

### 1. Autonomy Configuration System (`autonomy.py`)

A flexible configuration system that controls what types of changes can be auto-merged.

**Features:**
- **5 Progressive Autonomy Levels**:
  - `NONE`: Shadow mode - all PRs require human approval
  - `DOCUMENTATION`: Auto-merge documentation changes only (*.md files)
  - `TESTS`: Auto-merge docs + test additions
  - `LOW_RISK`: Auto-merge docs + tests + UI components
  - `FULL`: Auto-merge any LOW risk change (relies on RiskAssessor)

- **File Pattern Matching**: Glob-based patterns for determining auto-merge eligibility
- **Protected Files**: 20+ critical file patterns that can never be auto-merged
- **Environment Configuration**: Full configuration via environment variables
- **Rate Limiting**: Configurable max PRs per hour with cooldown periods
- **Circuit Breaker**: Automatic disable on error threshold

**Protected File Categories:**
- Authentication & Security (`middleware.ts`, `auth.py`)
- Database Schema (`demo_models.py`, migrations)
- Billing & Payments
- CI/CD Workflows (`.github/workflows/**`)
- Package Management (`package.json`, `requirements.txt`)
- Core Configuration (`.env`, `docker-compose.yml`)

### 2. Audit & Monitoring Service (`autonomy_audit.py`)

Complete audit logging and monitoring for all autonomous operations.

**Features:**
- **10 Action Types**: PR creation, auto-merge, rejection, risk assessment, circuit breaker, rate limiting, violations, reversions
- **Complete Audit Trail**: Immutable records with timestamps, agent IDs, file changes, outcomes
- **Real-Time Metrics**: Success rates, error rates, test pass rates, risk distribution
- **Anomaly Detection**: Automatic alerts for:
  - High error rate (>10%)
  - Multiple auto-merge reversions (>2)
  - Protected file violation attempts
  - Circuit breaker trips
  - Low test pass rate (<90%)
- **In-Memory Storage**: Last 10,000 entries for fast access
- **Queryable Logs**: Filter by action type, result, time window
- **Structured Logging**: Integration with structlog for production

### 3. End-to-End Integration Tests

Comprehensive testing suite validating the complete autonomous workflow.

**Coverage:**
- 72 tests total (100% passing)
  - 30 autonomy config tests
  - 30 autonomy audit tests
  - 12 integration workflow tests
- All autonomy levels tested
- Protected file blocking verified
- Rate limiting and circuit breaker validated
- Environment configuration tested

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Autonomous PR Workflow                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Autonomy Configuration (autonomy.py)                    │
│     • Load config from environment                           │
│     • Determine autonomy level                               │
│     • Check if enabled                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. File Validation                                          │
│     • Check for protected files                              │
│     • Match files against autonomy level patterns            │
│     • Determine if auto-merge allowed                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Rate Limiting Check                                      │
│     • Check current PR count in time window                  │
│     • Enforce max PRs per hour                               │
│     • Apply cooldown if needed                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Circuit Breaker Check                                    │
│     • Calculate error rate                                   │
│     • Check against threshold                                │
│     • Block if circuit is open                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  5. Decision: Auto-Merge or Reject                          │
│     • Log decision with full context                         │
│     • Update audit trail                                     │
│     • Calculate metrics                                      │
│     • Check for anomalies                                    │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Master Switch
AGENT_AUTONOMY_ENABLED=false          # Enable/disable autonomy

# Autonomy Level
AGENT_AUTONOMY_LEVEL=none             # none|documentation|tests|low_risk|full

# Rate Limiting
AGENT_MAX_PRS_PER_HOUR=5              # Max auto-merges per hour
AGENT_COOLDOWN_SECONDS=60             # Cooldown between merges

# Circuit Breaker
AGENT_CIRCUIT_BREAKER_THRESHOLD=0.05  # 5% error rate threshold
AGENT_CIRCUIT_BREAKER_TIMEOUT=300     # 5 minute timeout after trip
```

### Progressive Rollout Strategy

**Recommended approach for enabling autonomy:**

1. **Week 1: Shadow Mode** (`NONE`)
   - Autonomy disabled, all PRs require human review
   - Monitor audit logs and metrics
   - Validate that system correctly identifies auto-mergeable PRs

2. **Week 2: Documentation Only** (`DOCUMENTATION`)
   - Enable auto-merge for documentation changes
   - Monitor for false positives
   - Verify protected files are blocked

3. **Week 3: Tests Included** (`TESTS`)
   - Add test file auto-merge
   - Monitor test pass rates
   - Check for test quality issues

4. **Week 4: Low-Risk Changes** (`LOW_RISK`)
   - Add UI component auto-merge
   - Monitor for integration issues
   - Verify component tests are adequate

5. **Week 5+: Full Autonomy** (`FULL`)
   - Enable full autonomy (with RiskAssessor)
   - Close monitoring of metrics
   - Be ready to revert to lower level

## Usage Examples

### 1. Basic Configuration

```python
from src.config.autonomy import AutonomyConfig, AutonomyLevel, AUTONOMY_RULES_BY_LEVEL

# Create config
config = AutonomyConfig(
    enabled=True,
    level=AutonomyLevel.DOCUMENTATION,
    rules=AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.DOCUMENTATION],
    max_prs_per_hour=5,
    circuit_breaker_threshold=0.05,
)

# Check if files can be auto-merged
files = ["README.md", "docs/INSTALL.md"]
can_merge, reason = config.can_auto_merge(files)

if can_merge:
    print(f"✅ Can auto-merge: {reason}")
else:
    print(f"❌ Cannot auto-merge: {reason}")
```

### 2. Audit Logging

```python
from src.services.autonomy_audit import get_audit_service, AuditAction, AuditResult

audit = get_audit_service()

# Log PR creation
audit.log_pr_created(
    pr_number=123,
    branch_name="docs/update-readme",
    files_changed=["README.md"],
    agent_id="orchestrator",
)

# Log auto-merge
audit.log_auto_merge(
    pr_number=123,
    files_changed=["README.md"],
    agent_id="orchestrator",
    risk_level="LOW",
    tests_passed=True,
)

# Get metrics
metrics = audit.get_metrics(window_hours=24)
print(f"Success rate: {metrics.auto_merge_success_rate:.1%}")
print(f"Total PRs: {metrics.total_prs_created}")
print(f"Auto-merged: {metrics.total_auto_merged}")

# Check for anomalies
anomalies = audit.check_for_anomalies(metrics)
if anomalies:
    for anomaly in anomalies:
        print(f"⚠️  Anomaly: {anomaly}")
```

### 3. Protected File Checking

```python
config = AutonomyConfig(enabled=True, level=AutonomyLevel.FULL)

# Check if file is protected
if config.is_protected_file("apps/web/middleware.ts"):
    print("❌ Protected file - requires human review")
else:
    print("✅ File can be auto-merged")
```

## Testing

### Running Tests

```bash
# All autonomy tests
cd apps/backend
pytest tests/test_autonomy_config.py -v
pytest tests/test_autonomy_audit.py -v
pytest tests/integration/test_autonomous_pr_workflow.py -v

# Or run all together
pytest tests/test_autonomy_*.py tests/integration/ -v

# Expected output: 72 passed
```

### Test Coverage

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| Autonomy Config | 30 | File patterns, autonomy levels, protected files, env config |
| Autonomy Audit | 30 | Audit logging, metrics, anomaly detection, queries |
| Integration | 12 | End-to-end workflows, all levels, rate limiting, circuit breaker |
| **Total** | **72** | **Complete workflow coverage** |

## Monitoring

### Key Metrics to Monitor

1. **Success Rate**: Percentage of PRs successfully auto-merged
   - Target: >95%
   - Alert if: <90%

2. **Error Rate**: Percentage of actions that fail or require reversion
   - Target: <5%
   - Alert if: >10%

3. **Test Pass Rate**: Percentage of auto-merged PRs where tests pass
   - Target: 100%
   - Alert if: <95%

4. **Protected File Violations**: Number of attempts to auto-merge protected files
   - Target: 0
   - Alert if: >0

5. **Circuit Breaker Trips**: Number of times circuit breaker opened
   - Target: 0
   - Alert if: >1 per day

6. **Auto-Merge Rate**: PRs auto-merged vs total PRs created
   - Varies by autonomy level
   - Monitor for unexpected changes

### Accessing Metrics

```python
from src.services.autonomy_audit import get_audit_service

audit = get_audit_service()

# Get 24-hour metrics
metrics = audit.get_metrics(window_hours=24)

# Display key metrics
print(f"Total PRs: {metrics.total_prs_created}")
print(f"Auto-merged: {metrics.total_auto_merged}")
print(f"Rejected: {metrics.total_rejected}")
print(f"Success rate: {metrics.auto_merge_success_rate:.1%}")
print(f"Error rate: {metrics.calculate_error_rate():.1%}")
print(f"Test pass rate: {metrics.test_pass_rate:.1%}")

# Check for anomalies
anomalies = audit.check_for_anomalies(metrics)
for anomaly in anomalies:
    print(f"⚠️  {anomaly}")
```

## Safety Features

### 1. Protected Files

**Never Auto-Merged:**
- Authentication code
- Database schemas
- Billing logic
- CI/CD workflows
- Package management
- Core configuration

**Why**: These files are too critical to change without human review.

### 2. Rate Limiting

**Purpose**: Prevent runaway automation

**Mechanism**:
- Track PRs auto-merged per hour
- Block when limit exceeded
- Apply cooldown period
- Log rate limit hits

**Default**: 5 PRs per hour with 60-second cooldown

### 3. Circuit Breaker

**Purpose**: Automatic disable on high error rates

**Mechanism**:
- Calculate error rate (failures + reversions / total actions)
- Compare against threshold (default: 5%)
- Open circuit if exceeded
- Block all auto-merges while open
- Auto-close after timeout (default: 5 minutes)

**Example**: If 3 out of 10 PRs fail or are reverted (30% error rate), circuit breaker opens and blocks all auto-merges for 5 minutes.

### 4. Audit Trail

**Purpose**: Complete accountability and debugging

**What's Logged**:
- Every autonomous action
- Timestamp and duration
- Agent ID
- Files changed
- Risk level
- Test results
- Outcome and reason

**Benefits**:
- Debug issues quickly
- Understand system behavior
- Compliance and auditing
- Performance analysis

## Integration

### With PR Automation (Week 2)

```python
# In PR automation workflow
from src.config.autonomy import get_autonomy_config
from src.services.autonomy_audit import get_audit_service

config = get_autonomy_config()
audit = get_audit_service()

# Check if PR can be auto-merged
if config.enabled:
    can_merge, reason = config.can_auto_merge(pr_files)

    if can_merge:
        # Auto-merge
        merge_pr(pr_number)
        audit.log_auto_merge(pr_number, pr_files, agent_id, "LOW", True)
    else:
        # Requires review
        audit.log_rejection(pr_number, reason, pr_files, agent_id)
else:
    # Autonomy disabled - shadow mode
    audit.log_pr_created(pr_number, branch, pr_files, agent_id)
```

### With Risk Assessment (Future)

```python
from src.services.risk_assessment import assess_risk

# Get risk score
risk_level, risk_score = assess_risk(pr_files, pr_diff)

# Log risk assessment
audit.log_action(
    action=AuditAction.RISK_ASSESSMENT,
    result=AuditResult.SUCCESS,
    pr_number=pr_number,
    risk_level=risk_level,
    risk_score=risk_score,
)

# Use risk level in decision
if config.level == AutonomyLevel.FULL and risk_level == "LOW":
    # Can auto-merge
    pass
```

## Troubleshooting

### Issue: PRs Not Auto-Merging

**Check:**
1. Is autonomy enabled? `AGENT_AUTONOMY_ENABLED=true`
2. What's the autonomy level? Check `AGENT_AUTONOMY_LEVEL`
3. Do files match level patterns? Check audit logs
4. Are files protected? Run `config.is_protected_file(file)`
5. Rate limit hit? Check `metrics.rate_limit_hits`
6. Circuit breaker open? Check `metrics.circuit_breaker_trips`

**Debug:**
```python
config = get_autonomy_config()
files = ["your/file.py"]

# Check each condition
print(f"Enabled: {config.enabled}")
print(f"Level: {config.level}")

can_merge, reason = config.can_auto_merge(files)
print(f"Can merge: {can_merge}")
print(f"Reason: {reason}")

# Check protected
for file in files:
    print(f"{file}: Protected={config.is_protected_file(file)}")
```

### Issue: High Error Rate

**Actions:**
1. Check recent audit entries for patterns
2. Review failed PRs
3. Check test quality
4. Verify risk assessment accuracy
5. Consider lowering autonomy level

**Query Recent Failures:**
```python
audit = get_audit_service()

# Get recent rejections
failures = audit.get_recent_entries(
    limit=20,
    result=AuditResult.FAILURE
)

for failure in failures:
    print(f"PR #{failure.pr_number}: {failure.reason}")
```

### Issue: Protected File Violations

**Cause**: Agent attempting to modify protected files

**Actions:**
1. Review agent logic
2. Check if files should be protected
3. Update protected patterns if needed
4. Investigate why agent selected these files

**Query Violations:**
```python
violations = audit.get_recent_entries(
    action=AuditAction.PROTECTED_FILE_VIOLATION,
    limit=10
)

for v in violations:
    print(f"Files: {v.protected_files_detected}")
    print(f"PR: {v.pr_number}")
```

## Future Enhancements

### Week 4+
- **Risk Assessment Integration**: Use ML-based risk scoring
- **Grafana Dashboard**: Real-time monitoring UI
- **Database Persistence**: Store audit logs in database
- **Webhook Notifications**: Alert on anomalies
- **A/B Testing**: Compare autonomy levels
- **Auto-Rollback**: Automatic reversion of failed merges

### Long-Term
- **Learning System**: Improve patterns based on outcomes
- **Predictive Alerts**: Warn before circuit breaker trips
- **Cost Analysis**: Track time/money saved by autonomy
- **Compliance Reports**: Automated audit reports

## References

### Code Files
- `apps/backend/src/config/autonomy.py` - Configuration system
- `apps/backend/src/services/autonomy_audit.py` - Audit & monitoring
- `apps/backend/tests/test_autonomy_config.py` - Config tests
- `apps/backend/tests/test_autonomy_audit.py` - Audit tests
- `apps/backend/tests/integration/test_autonomous_pr_workflow.py` - Integration tests

### Related Documentation
- [Phase 5 Overview](./README.md)
- [Week 2: PR Automation](./week-2-pr-automation.md)
- [Week 4: AI Code Generation](./week-4-ai-code-generation.md) (coming soon)

---

**Implementation Date**: February 4, 2026
**Status**: ✅ Production Ready
**Tests**: 72 passing (100%)
**Lines of Code**: 2,822
