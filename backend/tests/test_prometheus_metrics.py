"""Tests for Prometheus metrics endpoint and autonomous development metrics."""

import pytest
from httpx import AsyncClient

from src.monitoring.metrics import (
    # Autonomous Development Metrics
    agent_task_execution_time,
    agent_task_failure_total,
    agent_task_success_total,
    agent_verification_required,
    approval_decisions_total,
    auto_merge_duration,
    auto_merges_attempted,
    auto_merges_failed,
    auto_merges_successful,
    autonomous_system_errors,
    circuit_breaker_closes,
    circuit_breaker_opens,
    circuit_breaker_state,
    code_files_changed,
    code_lines_changed,
    deployment_duration,
    deployment_failures_total,
    deployments_total,
    protected_files_modified,
    risk_assessment_duration,
    risk_assessments_total,
    rollback_duration,
    rollbacks_failed,
    rollbacks_successful,
    rollbacks_triggered,
    test_coverage_percentage,
    test_execution_duration,
    test_executions_total,
    test_failures_total,
)


class TestPrometheusMetricsEndpoint:
    """Test the /metrics endpoint."""

    async def test_metrics_endpoint_exists(self, client: AsyncClient):
        """Test that /metrics endpoint is accessible."""
        response = await client.get("/metrics")
        assert response.status_code == 200

    async def test_metrics_endpoint_content_type(self, client: AsyncClient):
        """Test that /metrics returns Prometheus format."""
        response = await client.get("/metrics")
        assert "text/plain" in response.headers["content-type"]

    async def test_metrics_endpoint_contains_help_text(self, client: AsyncClient):
        """Test that metrics contain Prometheus help text."""
        response = await client.get("/metrics")
        content = response.text

        # Should contain HELP comments
        assert "# HELP" in content
        assert "# TYPE" in content

    async def test_metrics_endpoint_contains_autonomous_metrics(
        self, client: AsyncClient
    ):
        """Test that autonomous development metrics are exposed."""
        response = await client.get("/metrics")
        content = response.text

        # Check for key autonomous development metrics
        assert "risk_assessments_total" in content
        assert "auto_merges_attempted_total" in content
        assert "rollbacks_triggered_total" in content
        assert "circuit_breaker_state" in content

    async def test_metrics_endpoint_no_authentication_required(
        self, client: AsyncClient
    ):
        """Test that /metrics is publicly accessible (for Prometheus scraper)."""
        # Try without auth token
        response = await client.get("/metrics")
        assert response.status_code == 200


class TestRiskAssessmentMetrics:
    """Test risk assessment metrics collection."""

    def test_risk_assessment_counter_labels(self):
        """Test that risk assessment counter has correct labels."""
        # Increment with different risk levels
        risk_assessments_total.labels(risk_level="LOW").inc()
        risk_assessments_total.labels(risk_level="MEDIUM").inc()
        risk_assessments_total.labels(risk_level="HIGH").inc()
        risk_assessments_total.labels(risk_level="CRITICAL").inc()

        # Should not raise any errors

    def test_approval_decisions_counter_labels(self):
        """Test that approval decisions counter has correct labels."""
        approval_decisions_total.labels(policy="AUTO_MERGE").inc()
        approval_decisions_total.labels(policy="ONE_REVIEWER").inc()
        approval_decisions_total.labels(policy="TWO_REVIEWERS").inc()
        approval_decisions_total.labels(policy="SECURITY_AUDIT").inc()

    def test_risk_assessment_duration_histogram(self):
        """Test that risk assessment duration can be observed."""
        # Simulate risk assessment timing
        risk_assessment_duration.observe(0.5)
        risk_assessment_duration.observe(1.2)
        risk_assessment_duration.observe(2.8)


class TestAutoMergeMetrics:
    """Test auto-merge metrics collection."""

    def test_auto_merge_attempted_counter(self):
        """Test that auto-merge attempts are tracked."""
        auto_merges_attempted.labels(risk_level="LOW").inc()
        auto_merges_attempted.labels(risk_level="MEDIUM").inc()

    def test_auto_merge_success_counter(self):
        """Test that successful auto-merges are tracked."""
        auto_merges_successful.labels(risk_level="LOW").inc()

    def test_auto_merge_failure_counter(self):
        """Test that failed auto-merges are tracked with reason."""
        auto_merges_failed.labels(risk_level="MEDIUM", failure_reason="test_failure").inc()
        auto_merges_failed.labels(risk_level="HIGH", failure_reason="build_failure").inc()

    def test_auto_merge_duration_histogram(self):
        """Test that auto-merge duration is tracked."""
        auto_merge_duration.observe(5.0)
        auto_merge_duration.observe(15.3)
        auto_merge_duration.observe(45.7)


class TestRollbackMetrics:
    """Test rollback metrics collection."""

    def test_rollback_triggered_counter(self):
        """Test that rollbacks are tracked with trigger reason."""
        rollbacks_triggered.labels(trigger_reason="test_failure").inc()
        rollbacks_triggered.labels(trigger_reason="build_failure").inc()
        rollbacks_triggered.labels(trigger_reason="runtime_error").inc()
        rollbacks_triggered.labels(trigger_reason="manual").inc()

    def test_rollback_duration_histogram(self):
        """Test that rollback duration is tracked."""
        rollback_duration.observe(2.3)
        rollback_duration.observe(8.1)

    def test_rollback_success_failure_counters(self):
        """Test that rollback outcomes are tracked."""
        rollbacks_successful.inc()
        rollbacks_failed.inc()


class TestCircuitBreakerMetrics:
    """Test circuit breaker metrics collection."""

    def test_circuit_breaker_state_gauge(self):
        """Test that circuit breaker state is tracked."""
        # 0 = CLOSED, 1 = OPEN, 2 = HALF_OPEN
        circuit_breaker_state.labels(component="auto_merge").set(0)
        circuit_breaker_state.labels(component="deployment").set(1)
        circuit_breaker_state.labels(component="integration_sync").set(2)

    def test_circuit_breaker_open_close_counters(self):
        """Test that circuit breaker transitions are tracked."""
        circuit_breaker_opens.labels(component="auto_merge").inc()
        circuit_breaker_closes.labels(component="auto_merge").inc()


class TestTestExecutionMetrics:
    """Test execution metrics collection."""

    def test_test_execution_counter(self):
        """Test that test executions are tracked by suite."""
        test_executions_total.labels(suite="unit").inc()
        test_executions_total.labels(suite="integration").inc()
        test_executions_total.labels(suite="e2e").inc()
        test_executions_total.labels(suite="security").inc()

    def test_test_failure_counter(self):
        """Test that test failures are tracked."""
        test_failures_total.labels(suite="unit", test_name="test_risk_assessor").inc()
        test_failures_total.labels(suite="e2e", test_name="test_order_flow").inc()

    def test_test_execution_duration_histogram(self):
        """Test that test execution time is tracked."""
        test_execution_duration.labels(suite="unit").observe(5.2)
        test_execution_duration.labels(suite="e2e").observe(45.7)
        test_execution_duration.labels(suite="security").observe(25.3)

    def test_test_coverage_gauge(self):
        """Test that test coverage percentage is tracked."""
        test_coverage_percentage.labels(module="src/ai/agents").set(85.5)
        test_coverage_percentage.labels(module="src/api/routes").set(72.3)


class TestDeploymentMetrics:
    """Test deployment metrics collection."""

    def test_deployment_counter(self):
        """Test that deployments are tracked by environment."""
        deployments_total.labels(environment="development").inc()
        deployments_total.labels(environment="staging").inc()
        deployments_total.labels(environment="production").inc()

    def test_deployment_duration_histogram(self):
        """Test that deployment duration is tracked."""
        deployment_duration.labels(environment="staging").observe(120.5)
        deployment_duration.labels(environment="production").observe(180.3)

    def test_deployment_failure_counter(self):
        """Test that deployment failures are tracked by stage."""
        deployment_failures_total.labels(environment="staging", stage="build").inc()
        deployment_failures_total.labels(environment="production", stage="test").inc()
        deployment_failures_total.labels(environment="production", stage="deploy").inc()


class TestAgentPerformanceMetrics:
    """Test agent performance metrics collection."""

    def test_agent_task_execution_time(self):
        """Test that agent task execution time is tracked."""
        agent_task_execution_time.labels(
            agent_id="risk_assessor", task_type="assess_change"
        ).observe(1.5)
        agent_task_execution_time.labels(
            agent_id="rollback_agent", task_type="rollback"
        ).observe(5.2)

    def test_agent_task_success_failure_counters(self):
        """Test that agent task outcomes are tracked."""
        agent_task_success_total.labels(
            agent_id="risk_assessor", task_type="assess_change"
        ).inc()
        agent_task_failure_total.labels(
            agent_id="deployment_agent",
            task_type="deploy",
            error_type="connection_error",
        ).inc()

    def test_agent_verification_required_counter(self):
        """Test that manual verification requirements are tracked."""
        agent_verification_required.labels(
            agent_id="code_generator", verification_reason="high_risk_change"
        ).inc()


class TestCodeQualityMetrics:
    """Test code quality metrics collection."""

    def test_code_lines_changed_histogram(self):
        """Test that lines of code changed are tracked."""
        code_lines_changed.observe(15)
        code_lines_changed.observe(250)
        code_lines_changed.observe(1500)

    def test_code_files_changed_histogram(self):
        """Test that number of files changed are tracked."""
        code_files_changed.observe(2)
        code_files_changed.observe(12)
        code_files_changed.observe(45)

    def test_protected_files_modified_counter(self):
        """Test that protected file modifications are tracked."""
        protected_files_modified.labels(file_pattern="**/middleware.ts").inc()
        protected_files_modified.labels(file_pattern="**/demo_auth.py").inc()
        protected_files_modified.labels(file_pattern="**/demo_models.py").inc()


class TestSystemHealthMetrics:
    """Test system health metrics for autonomous operations."""

    def test_autonomous_system_errors_counter(self):
        """Test that system errors are tracked."""
        autonomous_system_errors.labels(
            component="risk_assessor", error_type="assessment_timeout"
        ).inc()
        autonomous_system_errors.labels(
            component="deployment_service", error_type="connection_failed"
        ).inc()
