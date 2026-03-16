"""
Autonomy Metrics API Endpoints.

Provides REST API endpoints for querying autonomy metrics and audit logs.
Used by Grafana dashboard and monitoring tools.

Part of Phase 5 (Autonomous Development Framework) - Week 3 monitoring.
"""


from datetime import UTC

from fastapi import APIRouter, Query

from src.services.autonomy_audit import (
    AuditAction,
    AuditResult,
    AutonomyMetrics,
    get_audit_service,
)

router = APIRouter(prefix="/api/autonomy", tags=["Autonomy Metrics"])


@router.get("/metrics")
async def get_metrics(
    window_hours: int = Query(24, ge=1, le=168, description="Time window in hours (1-168)")
) -> AutonomyMetrics:
    """
    Get autonomy metrics for a time window.

    Returns aggregated metrics including success rates, error rates,
    violation counts, and anomaly detection results.

    **Query Parameters:**
    - `window_hours`: Time window in hours (default: 24, max: 168 = 1 week)

    **Returns:**
    - `total_actions`: Total autonomous actions
    - `total_prs_created`: Total PRs created
    - `total_auto_merged`: Total PRs auto-merged
    - `total_rejected`: Total PRs rejected
    - `total_blocked`: Total actions blocked
    - `auto_merge_success_rate`: Success rate (0.0-1.0)
    - `test_pass_rate`: Test pass rate (0.0-1.0)
    - `protected_file_violations`: Number of violations
    - `rate_limit_hits`: Number of rate limit hits
    - `circuit_breaker_trips`: Number of circuit breaker trips
    - `auto_merge_reversions`: Number of reversions
    - `risk_distribution`: Distribution of risk levels
    - `avg_duration_ms`: Average action duration

    **Example:**
    ```
    GET /api/autonomy/metrics?window_hours=24
    ```
    """
    audit_service = get_audit_service()
    metrics = audit_service.get_metrics(window_hours=window_hours)
    return metrics


@router.get("/metrics/prometheus")
async def get_prometheus_metrics(
    window_hours: int = Query(24, ge=1, le=168)
) -> str:
    """
    Get metrics in Prometheus format.

    Returns metrics as plain text in Prometheus exposition format,
    suitable for scraping by Prometheus or Grafana.

    **Query Parameters:**
    - `window_hours`: Time window in hours (default: 24)

    **Returns:**
    Plain text in Prometheus format:
    ```
    # HELP autonomy_actions_total Total autonomous actions
    # TYPE autonomy_actions_total counter
    autonomy_actions_total 150

    # HELP autonomy_auto_merge_rate Auto-merge success rate
    # TYPE autonomy_auto_merge_rate gauge
    autonomy_auto_merge_rate 0.95
    ```

    **Example:**
    ```
    GET /api/autonomy/metrics/prometheus?window_hours=24
    ```
    """
    audit_service = get_audit_service()
    metrics = audit_service.get_metrics(window_hours=window_hours)

    # Build Prometheus format
    lines = []

    # Total actions
    lines.append("# HELP autonomy_actions_total Total autonomous actions")
    lines.append("# TYPE autonomy_actions_total counter")
    lines.append(f"autonomy_actions_total {metrics.total_actions}")
    lines.append("")

    # PRs created
    lines.append("# HELP autonomy_prs_created_total Total PRs created")
    lines.append("# TYPE autonomy_prs_created_total counter")
    lines.append(f"autonomy_prs_created_total {metrics.total_prs_created}")
    lines.append("")

    # PRs auto-merged
    lines.append("# HELP autonomy_prs_auto_merged_total Total PRs auto-merged")
    lines.append("# TYPE autonomy_prs_auto_merged_total counter")
    lines.append(f"autonomy_prs_auto_merged_total {metrics.total_auto_merged}")
    lines.append("")

    # PRs rejected
    lines.append("# HELP autonomy_prs_rejected_total Total PRs rejected")
    lines.append("# TYPE autonomy_prs_rejected_total counter")
    lines.append(f"autonomy_prs_rejected_total {metrics.total_rejected}")
    lines.append("")

    # Actions blocked
    lines.append("# HELP autonomy_actions_blocked_total Total actions blocked")
    lines.append("# TYPE autonomy_actions_blocked_total counter")
    lines.append(f"autonomy_actions_blocked_total {metrics.total_blocked}")
    lines.append("")

    # Success rate
    lines.append("# HELP autonomy_auto_merge_success_rate Auto-merge success rate (0-1)")
    lines.append("# TYPE autonomy_auto_merge_success_rate gauge")
    lines.append(f"autonomy_auto_merge_success_rate {metrics.auto_merge_success_rate}")
    lines.append("")

    # Test pass rate
    lines.append("# HELP autonomy_test_pass_rate Test pass rate (0-1)")
    lines.append("# TYPE autonomy_test_pass_rate gauge")
    lines.append(f"autonomy_test_pass_rate {metrics.test_pass_rate}")
    lines.append("")

    # Error rate
    error_rate = metrics.calculate_error_rate()
    lines.append("# HELP autonomy_error_rate Error rate (0-1)")
    lines.append("# TYPE autonomy_error_rate gauge")
    lines.append(f"autonomy_error_rate {error_rate}")
    lines.append("")

    # Violations
    lines.append("# HELP autonomy_protected_file_violations_total Protected file violations")
    lines.append("# TYPE autonomy_protected_file_violations_total counter")
    lines.append(f"autonomy_protected_file_violations_total {metrics.protected_file_violations}")
    lines.append("")

    # Rate limit hits
    lines.append("# HELP autonomy_rate_limit_hits_total Rate limit hits")
    lines.append("# TYPE autonomy_rate_limit_hits_total counter")
    lines.append(f"autonomy_rate_limit_hits_total {metrics.rate_limit_hits}")
    lines.append("")

    # Circuit breaker trips
    lines.append("# HELP autonomy_circuit_breaker_trips_total Circuit breaker trips")
    lines.append("# TYPE autonomy_circuit_breaker_trips_total counter")
    lines.append(f"autonomy_circuit_breaker_trips_total {metrics.circuit_breaker_trips}")
    lines.append("")

    # Reversions
    lines.append("# HELP autonomy_reversions_total Auto-merge reversions")
    lines.append("# TYPE autonomy_reversions_total counter")
    lines.append(f"autonomy_reversions_total {metrics.auto_merge_reversions}")
    lines.append("")

    # Risk distribution (as separate metrics)
    for risk_level, count in metrics.risk_distribution.items():
        lines.append(f"# HELP autonomy_risk_{risk_level.lower()}_total Risk level: {risk_level}")
        lines.append(f"# TYPE autonomy_risk_{risk_level.lower()}_total counter")
        lines.append(f"autonomy_risk_{risk_level.lower()}_total {count}")
        lines.append("")

    # Average duration
    lines.append("# HELP autonomy_avg_duration_ms Average action duration in milliseconds")
    lines.append("# TYPE autonomy_avg_duration_ms gauge")
    lines.append(f"autonomy_avg_duration_ms {metrics.avg_duration_ms}")
    lines.append("")

    return "\n".join(lines)


@router.get("/audit/recent")
async def get_recent_audit_entries(
    limit: int = Query(100, ge=1, le=1000, description="Max entries to return"),
    action: AuditAction | None = Query(None, description="Filter by action type"),
    result: AuditResult | None = Query(None, description="Filter by result type"),
):
    """
    Get recent audit log entries.

    Returns the most recent audit entries, optionally filtered by action or result type.

    **Query Parameters:**
    - `limit`: Maximum entries to return (default: 100, max: 1000)
    - `action`: Filter by action type (optional)
    - `result`: Filter by result type (optional)

    **Action Types:**
    - `pr_created`, `pr_auto_merged`, `pr_rejected`, `pr_requires_review`
    - `risk_assessment`, `file_validation`, `test_validation`
    - `circuit_opened`, `circuit_closed`, `rate_limit_hit`
    - `protected_file_violation`, `auto_merge_reverted`

    **Result Types:**
    - `success`, `failure`, `blocked`, `skipped`

    **Returns:**
    List of audit entries with:
    - `entry_id`, `timestamp`, `action`, `result`
    - `agent_id`, `pr_number`, `branch_name`
    - `files_changed`, `risk_level`, `tests_passed`
    - `auto_merged`, `reason`

    **Example:**
    ```
    GET /api/autonomy/audit/recent?limit=50&action=pr_auto_merged
    ```
    """
    audit_service = get_audit_service()
    entries = audit_service.get_recent_entries(
        limit=limit,
        action=action,
        result=result,
    )

    # Convert to dict for JSON serialization
    return [entry.to_dict() for entry in entries]


@router.get("/anomalies")
async def get_anomalies(
    window_hours: int = Query(24, ge=1, le=168)
):
    """
    Get detected anomalies for a time window.

    Analyzes metrics and returns any anomalies detected, such as:
    - High error rate
    - Multiple reversions
    - Protected file violations
    - Circuit breaker trips
    - Low test pass rate

    **Query Parameters:**
    - `window_hours`: Time window in hours (default: 24)

    **Returns:**
    ```json
    {
        "window_hours": 24,
        "anomalies": [
            "High error rate: 15.0% (3 errors out of 20 actions)",
            "Protected file violation attempts: 2"
        ],
        "has_anomalies": true,
        "anomaly_count": 2
    }
    ```

    **Example:**
    ```
    GET /api/autonomy/anomalies?window_hours=24
    ```
    """
    audit_service = get_audit_service()
    metrics = audit_service.get_metrics(window_hours=window_hours)
    anomalies = audit_service.check_for_anomalies(metrics)

    return {
        "window_hours": window_hours,
        "anomalies": anomalies,
        "has_anomalies": len(anomalies) > 0,
        "anomaly_count": len(anomalies),
    }


@router.get("/health")
async def get_autonomy_health(
    window_hours: int = Query(1, ge=1, le=24)
):
    """
    Get overall health status of autonomous system.

    Returns a quick health check with status indicators.

    **Query Parameters:**
    - `window_hours`: Time window in hours (default: 1, max: 24)

    **Returns:**
    ```json
    {
        "status": "healthy",  // healthy, degraded, unhealthy
        "metrics": {
            "success_rate": 0.95,
            "error_rate": 0.05,
            "test_pass_rate": 1.0
        },
        "issues": [],
        "timestamp": "2026-02-04T10:00:00Z"
    }
    ```

    **Status Levels:**
    - `healthy`: All metrics within normal ranges
    - `degraded`: Some metrics outside normal ranges
    - `unhealthy`: Critical metrics outside acceptable ranges

    **Example:**
    ```
    GET /api/autonomy/health?window_hours=1
    ```
    """
    from datetime import datetime

    audit_service = get_audit_service()
    metrics = audit_service.get_metrics(window_hours=window_hours)
    anomalies = audit_service.check_for_anomalies(metrics)
    error_rate = metrics.calculate_error_rate()

    # Determine health status
    issues = []
    status = "healthy"

    # Check error rate
    if error_rate > 0.1:  # >10%
        status = "unhealthy"
        issues.append(f"High error rate: {error_rate:.1%}")
    elif error_rate > 0.05:  # >5%
        status = "degraded"
        issues.append(f"Elevated error rate: {error_rate:.1%}")

    # Check test pass rate
    if metrics.test_pass_rate < 0.9:  # <90%
        status = "unhealthy"
        issues.append(f"Low test pass rate: {metrics.test_pass_rate:.1%}")
    elif metrics.test_pass_rate < 0.95:  # <95%
        if status == "healthy":
            status = "degraded"
        issues.append(f"Test pass rate below target: {metrics.test_pass_rate:.1%}")

    # Check for anomalies
    if anomalies:
        if status == "healthy":
            status = "degraded"
        issues.extend(anomalies)

    return {
        "status": status,
        "metrics": {
            "success_rate": metrics.auto_merge_success_rate,
            "error_rate": error_rate,
            "test_pass_rate": metrics.test_pass_rate,
            "total_actions": metrics.total_actions,
            "total_auto_merged": metrics.total_auto_merged,
        },
        "issues": issues,
        "timestamp": datetime.now(UTC).isoformat(),
    }
