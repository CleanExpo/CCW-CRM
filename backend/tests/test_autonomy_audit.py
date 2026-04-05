"""
Test suite for Autonomy Audit Service.

Tests audit logging, metrics calculation, and anomaly detection.
Part of Phase 5 (Autonomous Development Framework) - Week 3 tests.
"""

from datetime import datetime, timedelta, timezone

import pytest

from src.config.autonomy import AutonomyLevel
from src.services.autonomy_audit import (
    AuditAction,
    AuditEntry,
    AuditResult,
    AutonomyAuditService,
    AutonomyMetrics,
    get_audit_service,
)


# ============================================================
# AUDIT ENTRY TESTS
# ============================================================


class TestAuditEntry:
    """Test audit entry creation and serialization."""

    def test_audit_entry_creation(self):
        """Test creating an audit entry."""
        entry = AuditEntry(
            action=AuditAction.PR_CREATED,
            result=AuditResult.SUCCESS,
            agent_id="test-agent",
            pr_number=123,
            files_changed=["file1.py", "file2.py"],
        )

        assert entry.action == AuditAction.PR_CREATED
        assert entry.result == AuditResult.SUCCESS
        assert entry.agent_id == "test-agent"
        assert entry.pr_number == 123
        assert len(entry.files_changed) == 2
        assert entry.entry_id is not None
        assert entry.timestamp is not None

    def test_audit_entry_to_dict(self):
        """Test converting audit entry to dictionary."""
        entry = AuditEntry(
            action=AuditAction.PR_AUTO_MERGED,
            result=AuditResult.SUCCESS,
            agent_id="test-agent",
            pr_number=456,
            auto_merged=True,
            risk_level="LOW",
        )

        data = entry.to_dict()

        assert data["action"] == "pr_auto_merged"
        assert data["result"] == "success"
        assert data["agent_id"] == "test-agent"
        assert data["pr_number"] == 456
        assert data["auto_merged"] is True
        assert data["risk_level"] == "LOW"
        assert "timestamp" in data
        assert "entry_id" in data


# ============================================================
# AUDIT SERVICE TESTS
# ============================================================


class TestAutonomyAuditService:
    """Test audit service functionality."""

    @pytest.fixture
    def audit_service(self):
        """Create a fresh audit service for each test."""
        service = AutonomyAuditService()
        yield service
        service.clear_logs()

    def test_log_action(self, audit_service):
        """Test logging a generic action."""
        entry = audit_service.log_action(
            action=AuditAction.PR_CREATED,
            result=AuditResult.SUCCESS,
            agent_id="test-agent",
            pr_number=123,
        )

        assert entry.action == AuditAction.PR_CREATED
        assert entry.result == AuditResult.SUCCESS
        assert entry.agent_id == "test-agent"
        assert entry.pr_number == 123

        # Entry should be in log
        recent = audit_service.get_recent_entries(limit=10)
        assert len(recent) == 1
        assert recent[0].entry_id == entry.entry_id

    def test_log_pr_created(self, audit_service):
        """Test logging PR creation."""
        entry = audit_service.log_pr_created(
            pr_number=123,
            branch_name="feat/test-feature",
            files_changed=["file1.py", "file2.py"],
            agent_id="coder-agent",
        )

        assert entry.action == AuditAction.PR_CREATED
        assert entry.result == AuditResult.SUCCESS
        assert entry.pr_number == 123
        assert entry.branch_name == "feat/test-feature"
        assert len(entry.files_changed) == 2

    def test_log_auto_merge(self, audit_service):
        """Test logging auto-merge."""
        entry = audit_service.log_auto_merge(
            pr_number=123,
            files_changed=["README.md"],
            agent_id="orchestrator",
            risk_level="LOW",
            tests_passed=True,
        )

        assert entry.action == AuditAction.PR_AUTO_MERGED
        assert entry.result == AuditResult.SUCCESS
        assert entry.auto_merged is True
        assert entry.risk_level == "LOW"
        assert entry.tests_passed is True

    def test_log_rejection(self, audit_service):
        """Test logging PR rejection."""
        entry = audit_service.log_rejection(
            pr_number=123,
            reason="High risk changes require review",
            files_changed=["src/auth.py"],
            agent_id="orchestrator",
        )

        assert entry.action == AuditAction.PR_REJECTED
        assert entry.result == AuditResult.BLOCKED
        assert entry.auto_merged is False
        assert "High risk" in entry.reason

    def test_log_protected_file_violation(self, audit_service):
        """Test logging protected file violation."""
        protected_files = ["apps/web/middleware.ts", "apps/backend/src/db/demo_models.py"]
        entry = audit_service.log_protected_file_violation(
            files=protected_files,
            agent_id="orchestrator",
        )

        assert entry.action == AuditAction.PROTECTED_FILE_VIOLATION
        assert entry.result == AuditResult.BLOCKED
        assert len(entry.protected_files_detected) == 2
        assert "Protected files" in entry.reason

    def test_log_circuit_breaker_trip(self, audit_service):
        """Test logging circuit breaker trip."""
        entry = audit_service.log_circuit_breaker_trip(
            reason="Error rate exceeded 5% threshold",
            agent_id="orchestrator",
        )

        assert entry.action == AuditAction.CIRCUIT_OPENED
        assert entry.result == AuditResult.SUCCESS
        assert "threshold" in entry.reason

    def test_log_rate_limit_hit(self, audit_service):
        """Test logging rate limit hit."""
        entry = audit_service.log_rate_limit_hit(agent_id="orchestrator")

        assert entry.action == AuditAction.RATE_LIMIT_HIT
        assert entry.result == AuditResult.BLOCKED
        assert "Rate limit" in entry.reason

    def test_log_reversion(self, audit_service):
        """Test logging auto-merge reversion."""
        entry = audit_service.log_reversion(
            pr_number=123,
            reason="Tests failed in production",
            agent_id="orchestrator",
        )

        assert entry.action == AuditAction.AUTO_MERGE_REVERTED
        assert entry.result == AuditResult.SUCCESS
        assert entry.pr_number == 123
        assert "Tests failed" in entry.reason

    def test_get_recent_entries_limit(self, audit_service):
        """Test getting recent entries with limit."""
        # Create 10 entries
        for i in range(10):
            audit_service.log_pr_created(
                pr_number=i,
                branch_name=f"feat/test-{i}",
                files_changed=["file.py"],
                agent_id="test",
            )

        # Get last 5
        recent = audit_service.get_recent_entries(limit=5)
        assert len(recent) == 5

        # Should be most recent (9, 8, 7, 6, 5)
        assert recent[0].pr_number == 9
        assert recent[4].pr_number == 5

    def test_get_recent_entries_filter_by_action(self, audit_service):
        """Test filtering entries by action type."""
        # Create different action types
        audit_service.log_pr_created(
            pr_number=1, branch_name="feat/a", files_changed=["a.py"], agent_id="test"
        )
        audit_service.log_auto_merge(
            pr_number=1, files_changed=["a.py"], agent_id="test", risk_level="LOW", tests_passed=True
        )
        audit_service.log_rejection(
            pr_number=2, reason="High risk", files_changed=["b.py"], agent_id="test"
        )

        # Filter for auto-merges only
        auto_merges = audit_service.get_recent_entries(action=AuditAction.PR_AUTO_MERGED)
        assert len(auto_merges) == 1
        assert auto_merges[0].action == AuditAction.PR_AUTO_MERGED

    def test_get_recent_entries_filter_by_result(self, audit_service):
        """Test filtering entries by result type."""
        # Create different results
        audit_service.log_pr_created(
            pr_number=1, branch_name="feat/a", files_changed=["a.py"], agent_id="test"
        )
        audit_service.log_rejection(
            pr_number=2, reason="Risk", files_changed=["b.py"], agent_id="test"
        )

        # Filter for blocked only
        blocked = audit_service.get_recent_entries(result=AuditResult.BLOCKED)
        assert len(blocked) == 1
        assert blocked[0].result == AuditResult.BLOCKED

    def test_max_log_size_trimming(self, audit_service):
        """Test that log is trimmed when it exceeds max size."""
        audit_service._max_log_size = 10

        # Add 15 entries
        for i in range(15):
            audit_service.log_pr_created(
                pr_number=i,
                branch_name=f"feat/{i}",
                files_changed=["file.py"],
                agent_id="test",
            )

        # Should only have last 10
        assert len(audit_service._audit_log) == 10

        # First entry should be #5 (0-4 were trimmed)
        oldest = audit_service.get_recent_entries(limit=100)[-1]
        assert oldest.pr_number == 5


# ============================================================
# METRICS TESTS
# ============================================================


class TestAutonomyMetrics:
    """Test metrics calculation."""

    @pytest.fixture
    def audit_service(self):
        """Create audit service with test data."""
        service = AutonomyAuditService()

        # Add various entries
        service.log_pr_created(
            pr_number=1, branch_name="feat/a", files_changed=["a.py"], agent_id="test"
        )
        service.log_auto_merge(
            pr_number=1,
            files_changed=["a.py"],
            agent_id="test",
            risk_level="LOW",
            tests_passed=True,
        )

        service.log_pr_created(
            pr_number=2, branch_name="feat/b", files_changed=["b.py"], agent_id="test"
        )
        service.log_rejection(
            pr_number=2, reason="High risk", files_changed=["b.py"], agent_id="test"
        )

        service.log_protected_file_violation(
            files=["apps/web/middleware.ts"], agent_id="test"
        )

        yield service
        service.clear_logs()

    def test_get_metrics_totals(self, audit_service):
        """Test metrics total counts."""
        metrics = audit_service.get_metrics(window_hours=24)

        assert metrics.total_actions == 5
        assert metrics.total_prs_created == 2
        assert metrics.total_auto_merged == 1
        assert metrics.total_rejected == 1
        assert metrics.total_blocked == 2  # rejection + violation

    def test_get_metrics_success_rates(self, audit_service):
        """Test metrics success rate calculations."""
        metrics = audit_service.get_metrics(window_hours=24)

        # 1 auto-merge out of 2 PRs = 50%
        assert metrics.auto_merge_success_rate == 0.5

        # 1 test passed out of 1 test = 100%
        assert metrics.test_pass_rate == 1.0

    def test_get_metrics_violations(self, audit_service):
        """Test metrics violation counts."""
        metrics = audit_service.get_metrics(window_hours=24)

        assert metrics.protected_file_violations == 1
        assert metrics.rate_limit_hits == 0
        assert metrics.circuit_breaker_trips == 0
        assert metrics.auto_merge_reversions == 0

    def test_get_metrics_risk_distribution(self, audit_service):
        """Test risk distribution calculation."""
        metrics = audit_service.get_metrics(window_hours=24)

        assert "LOW" in metrics.risk_distribution
        assert metrics.risk_distribution["LOW"] == 1

    def test_get_metrics_error_rate(self, audit_service):
        """Test error rate calculation."""
        metrics = audit_service.get_metrics(window_hours=24)

        # 1 rejection + 0 reversions = 1 error out of 5 actions = 20%
        error_rate = metrics.calculate_error_rate()
        assert error_rate == pytest.approx(0.2, rel=0.01)

    def test_get_metrics_empty_log(self):
        """Test metrics with empty log."""
        service = AutonomyAuditService()
        metrics = service.get_metrics(window_hours=24)

        assert metrics.total_actions == 0
        assert metrics.auto_merge_success_rate == 0.0
        assert metrics.test_pass_rate == 0.0
        assert metrics.calculate_error_rate() == 0.0


# ============================================================
# ANOMALY DETECTION TESTS
# ============================================================


class TestAnomalyDetection:
    """Test anomaly detection."""

    @pytest.fixture
    def audit_service(self):
        """Create fresh audit service."""
        service = AutonomyAuditService()
        yield service
        service.clear_logs()

    def test_no_anomalies_in_healthy_metrics(self, audit_service):
        """Test no anomalies detected in healthy system."""
        # Create healthy scenario: 10 successful auto-merges
        for i in range(10):
            audit_service.log_pr_created(
                pr_number=i, branch_name=f"feat/{i}", files_changed=["file.py"], agent_id="test"
            )
            audit_service.log_auto_merge(
                pr_number=i,
                files_changed=["file.py"],
                agent_id="test",
                risk_level="LOW",
                tests_passed=True,
            )

        metrics = audit_service.get_metrics(window_hours=24)
        anomalies = audit_service.check_for_anomalies(metrics)

        assert len(anomalies) == 0

    def test_high_error_rate_anomaly(self, audit_service):
        """Test detection of high error rate."""
        # Create scenario with high error rate: 2 successes, 3 failures
        for i in range(2):
            audit_service.log_pr_created(
                pr_number=i, branch_name=f"feat/{i}", files_changed=["file.py"], agent_id="test"
            )
            audit_service.log_auto_merge(
                pr_number=i,
                files_changed=["file.py"],
                agent_id="test",
                risk_level="LOW",
                tests_passed=True,
            )

        for i in range(2, 5):
            audit_service.log_pr_created(
                pr_number=i, branch_name=f"feat/{i}", files_changed=["file.py"], agent_id="test"
            )
            audit_service.log_rejection(
                pr_number=i, reason="Failed", files_changed=["file.py"], agent_id="test"
            )

        metrics = audit_service.get_metrics(window_hours=24)
        anomalies = audit_service.check_for_anomalies(metrics)

        assert len(anomalies) > 0
        assert any("High error rate" in a for a in anomalies)

    def test_multiple_reversions_anomaly(self, audit_service):
        """Test detection of multiple reversions."""
        # Create 3 reversions
        for i in range(3):
            audit_service.log_reversion(
                pr_number=i, reason="Failed in prod", agent_id="test"
            )

        metrics = audit_service.get_metrics(window_hours=24)
        anomalies = audit_service.check_for_anomalies(metrics)

        assert len(anomalies) > 0
        assert any("reversions" in a for a in anomalies)

    def test_protected_file_violation_anomaly(self, audit_service):
        """Test detection of protected file violations."""
        audit_service.log_protected_file_violation(
            files=["apps/web/middleware.ts"], agent_id="test"
        )

        metrics = audit_service.get_metrics(window_hours=24)
        anomalies = audit_service.check_for_anomalies(metrics)

        assert len(anomalies) > 0
        assert any("Protected file" in a for a in anomalies)

    def test_circuit_breaker_trip_anomaly(self, audit_service):
        """Test detection of circuit breaker trips."""
        audit_service.log_circuit_breaker_trip(
            reason="Error threshold exceeded", agent_id="test"
        )

        metrics = audit_service.get_metrics(window_hours=24)
        anomalies = audit_service.check_for_anomalies(metrics)

        assert len(anomalies) > 0
        assert any("Circuit breaker" in a for a in anomalies)

    def test_low_test_pass_rate_anomaly(self, audit_service):
        """Test detection of low test pass rate."""
        # Create 10 auto-merges with low test pass rate (6 passed, 4 failed = 60%)
        for i in range(10):
            audit_service.log_auto_merge(
                pr_number=i,
                files_changed=["file.py"],
                agent_id="test",
                risk_level="LOW",
                tests_passed=(i < 6),  # First 6 pass, last 4 fail
            )

        metrics = audit_service.get_metrics(window_hours=24)
        anomalies = audit_service.check_for_anomalies(metrics)

        assert len(anomalies) > 0
        assert any("test pass rate" in a for a in anomalies)


# ============================================================
# SINGLETON TESTS
# ============================================================


class TestSingletonAccess:
    """Test singleton audit service access."""

    def test_get_audit_service(self):
        """Test getting audit service singleton."""
        service1 = get_audit_service()
        service2 = get_audit_service()

        # Should be same instance
        assert service1 is service2

    def test_singleton_persists_data(self):
        """Test that singleton persists data across calls."""
        service1 = get_audit_service()
        service1.log_pr_created(
            pr_number=999, branch_name="test", files_changed=["file.py"], agent_id="test"
        )

        service2 = get_audit_service()
        recent = service2.get_recent_entries(limit=10)

        # Should have the entry we logged
        assert any(e.pr_number == 999 for e in recent)


# ============================================================
# INTEGRATION TESTS
# ============================================================


class TestIntegration:
    """Integration tests for audit service."""

    def test_complete_autonomous_workflow(self):
        """Test complete autonomous PR workflow with audit logging."""
        service = AutonomyAuditService()

        # Step 1: PR created
        service.log_pr_created(
            pr_number=123,
            branch_name="feat/add-button",
            files_changed=["apps/web/components/Button.tsx"],
            agent_id="coder-agent",
            autonomy_level=AutonomyLevel.LOW_RISK,
            autonomy_enabled=True,
        )

        # Step 2: Risk assessment
        service.log_action(
            action=AuditAction.RISK_ASSESSMENT,
            result=AuditResult.SUCCESS,
            agent_id="orchestrator",
            pr_number=123,
            risk_level="LOW",
            risk_score=0.15,
        )

        # Step 3: Tests validated
        service.log_action(
            action=AuditAction.TEST_VALIDATION,
            result=AuditResult.SUCCESS,
            agent_id="orchestrator",
            pr_number=123,
            tests_passed=True,
        )

        # Step 4: Auto-merged
        service.log_auto_merge(
            pr_number=123,
            files_changed=["apps/web/components/Button.tsx"],
            agent_id="orchestrator",
            risk_level="LOW",
            tests_passed=True,
            autonomy_level=AutonomyLevel.LOW_RISK,
        )

        # Verify complete workflow is logged
        entries = service.get_recent_entries(limit=10)
        assert len(entries) == 4

        # Verify metrics
        metrics = service.get_metrics(window_hours=24)
        assert metrics.total_prs_created == 1
        assert metrics.total_auto_merged == 1
        assert metrics.auto_merge_success_rate == 1.0
        assert metrics.test_pass_rate == 1.0

        # No anomalies
        anomalies = service.check_for_anomalies(metrics)
        assert len(anomalies) == 0

    def test_blocked_workflow_with_violation(self):
        """Test workflow where PR is blocked due to protected files."""
        service = AutonomyAuditService()

        # Step 1: PR created with protected file
        service.log_pr_created(
            pr_number=456,
            branch_name="feat/auth-changes",
            files_changed=["apps/web/middleware.ts", "apps/web/components/Button.tsx"],
            agent_id="coder-agent",
        )

        # Step 2: Protected file violation detected
        service.log_protected_file_violation(
            files=["apps/web/middleware.ts"],
            agent_id="orchestrator",
            pr_number=456,
        )

        # Step 3: PR rejected
        service.log_rejection(
            pr_number=456,
            reason="Protected files detected",
            files_changed=["apps/web/middleware.ts"],
            agent_id="orchestrator",
        )

        # Verify workflow
        entries = service.get_recent_entries(limit=10)
        assert len(entries) == 3

        # Verify metrics show violation
        metrics = service.get_metrics(window_hours=24)
        assert metrics.protected_file_violations == 1
        assert metrics.total_rejected == 1

        # Should have anomaly
        anomalies = service.check_for_anomalies(metrics)
        assert len(anomalies) > 0
        assert any("Protected file" in a for a in anomalies)
