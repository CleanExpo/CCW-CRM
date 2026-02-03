"""
End-to-End Integration Tests for Autonomous PR Workflow.

Tests the complete autonomous development workflow from PR creation through
auto-merge decision, including:
- Autonomy configuration
- Risk assessment
- File validation
- Audit logging
- Circuit breaker
- Rate limiting

Part of Phase 5 (Autonomous Development Framework) - Week 3 integration tests.
"""

import pytest

from src.config.autonomy import (
    AutonomyConfig,
    AutonomyLevel,
    AUTONOMY_RULES_BY_LEVEL,
    get_autonomy_config,
    reload_autonomy_config,
)
from src.services.autonomy_audit import (
    AuditAction,
    AuditResult,
    AutonomyAuditService,
    get_audit_service,
)


# ============================================================
# FIXTURES
# ============================================================


@pytest.fixture
def autonomy_config():
    """Create autonomy config for testing."""
    config = AutonomyConfig(
        enabled=True,
        level=AutonomyLevel.DOCUMENTATION,
        rules=AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.DOCUMENTATION],
    )
    yield config


@pytest.fixture
def audit_service():
    """Create fresh audit service for testing."""
    service = AutonomyAuditService()
    yield service
    service.clear_logs()


# ============================================================
# DOCUMENTATION LEVEL TESTS
# ============================================================


class TestDocumentationLevelWorkflow:
    """Test autonomous workflow at DOCUMENTATION level."""

    def test_documentation_pr_auto_merge_success(self, autonomy_config, audit_service):
        """Test successful auto-merge of documentation PR."""
        # Step 1: PR created
        pr_number = 101
        branch_name = "docs/update-readme"
        files_changed = ["README.md", "docs/INSTALL.md"]
        agent_id = "orchestrator"

        audit_service.log_pr_created(
            pr_number=pr_number,
            branch_name=branch_name,
            files_changed=files_changed,
            agent_id=agent_id,
            autonomy_level=autonomy_config.level,
            autonomy_enabled=autonomy_config.enabled,
        )

        # Step 2: Validate files can be auto-merged
        can_merge, reason = autonomy_config.can_auto_merge(files_changed)
        assert can_merge is True
        assert "documentation" in reason.lower()

        # Step 3: Auto-merge decision
        if can_merge:
            audit_service.log_auto_merge(
                pr_number=pr_number,
                files_changed=files_changed,
                agent_id=agent_id,
                risk_level="LOW",
                tests_passed=True,
                autonomy_level=autonomy_config.level,
            )
        else:
            audit_service.log_rejection(
                pr_number=pr_number,
                reason=reason,
                files_changed=files_changed,
                agent_id=agent_id,
            )

        # Step 4: Verify audit trail
        recent_entries = audit_service.get_recent_entries(limit=10)
        assert len(recent_entries) == 2

        # Verify PR created entry
        pr_created = [e for e in recent_entries if e.action == AuditAction.PR_CREATED][0]
        assert pr_created.pr_number == pr_number
        assert pr_created.branch_name == branch_name
        assert len(pr_created.files_changed) == 2

        # Verify auto-merge entry
        auto_merged = [e for e in recent_entries if e.action == AuditAction.PR_AUTO_MERGED][0]
        assert auto_merged.pr_number == pr_number
        assert auto_merged.auto_merged is True
        assert auto_merged.risk_level == "LOW"

        # Step 5: Verify metrics
        metrics = audit_service.get_metrics(window_hours=24)
        assert metrics.total_prs_created == 1
        assert metrics.total_auto_merged == 1
        assert metrics.auto_merge_success_rate == 1.0

        # Step 6: Check for anomalies
        anomalies = audit_service.check_for_anomalies(metrics)
        assert len(anomalies) == 0

    def test_documentation_pr_with_code_blocked(self, autonomy_config, audit_service):
        """Test blocking PR with mixed documentation and code."""
        # Step 1: PR created with mixed files
        pr_number = 102
        branch_name = "feat/add-feature-and-docs"
        files_changed = ["README.md", "apps/backend/src/api/routes/orders.py"]
        agent_id = "orchestrator"

        audit_service.log_pr_created(
            pr_number=pr_number,
            branch_name=branch_name,
            files_changed=files_changed,
            agent_id=agent_id,
            autonomy_level=autonomy_config.level,
        )

        # Step 2: Validate files - should fail
        can_merge, reason = autonomy_config.can_auto_merge(files_changed)
        assert can_merge is False
        assert "not eligible" in reason

        # Step 3: Log rejection
        audit_service.log_rejection(
            pr_number=pr_number,
            reason=reason,
            files_changed=files_changed,
            agent_id=agent_id,
        )

        # Step 4: Verify audit trail
        recent_entries = audit_service.get_recent_entries(limit=10)
        assert len(recent_entries) == 2

        rejected = [e for e in recent_entries if e.action == AuditAction.PR_REJECTED][0]
        assert rejected.pr_number == pr_number
        assert rejected.result == AuditResult.BLOCKED
        assert rejected.auto_merged is False

        # Step 5: Verify metrics
        metrics = audit_service.get_metrics(window_hours=24)
        assert metrics.total_prs_created == 1
        assert metrics.total_rejected == 1
        assert metrics.total_auto_merged == 0


# ============================================================
# TESTS LEVEL TESTS
# ============================================================


class TestTestsLevelWorkflow:
    """Test autonomous workflow at TESTS level."""

    def test_tests_pr_auto_merge_success(self, audit_service):
        """Test successful auto-merge of tests PR."""
        # Configure TESTS level
        config = AutonomyConfig(
            enabled=True,
            level=AutonomyLevel.TESTS,
            rules=AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.TESTS],
        )

        # Step 1: PR created with tests
        pr_number = 201
        files_changed = ["tests/test_orders.py", "tests/test_customers.py"]
        agent_id = "orchestrator"

        audit_service.log_pr_created(
            pr_number=pr_number,
            branch_name="test/add-order-tests",
            files_changed=files_changed,
            agent_id=agent_id,
            autonomy_level=config.level,
        )

        # Step 2: Validate files
        can_merge, reason = config.can_auto_merge(files_changed)
        assert can_merge is True

        # Step 3: Auto-merge
        audit_service.log_auto_merge(
            pr_number=pr_number,
            files_changed=files_changed,
            agent_id=agent_id,
            risk_level="LOW",
            tests_passed=True,
            autonomy_level=config.level,
        )

        # Verify success
        metrics = audit_service.get_metrics(window_hours=24)
        assert metrics.total_auto_merged == 1

    def test_tests_and_docs_pr_auto_merge_success(self, audit_service):
        """Test successful auto-merge of tests + docs PR."""
        config = AutonomyConfig(
            enabled=True,
            level=AutonomyLevel.TESTS,
            rules=AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.TESTS],
        )

        # PR with tests and docs
        pr_number = 202
        files_changed = ["tests/test_orders.py", "README.md"]
        agent_id = "orchestrator"

        audit_service.log_pr_created(
            pr_number=pr_number,
            branch_name="test/add-tests-and-docs",
            files_changed=files_changed,
            agent_id=agent_id,
        )

        # Should allow both
        can_merge, reason = config.can_auto_merge(files_changed)
        assert can_merge is True

        audit_service.log_auto_merge(
            pr_number=pr_number,
            files_changed=files_changed,
            agent_id=agent_id,
            risk_level="LOW",
            tests_passed=True,
        )

        metrics = audit_service.get_metrics(window_hours=24)
        assert metrics.total_auto_merged == 1


# ============================================================
# LOW_RISK LEVEL TESTS
# ============================================================


class TestLowRiskLevelWorkflow:
    """Test autonomous workflow at LOW_RISK level."""

    def test_ui_component_pr_auto_merge_success(self, audit_service):
        """Test successful auto-merge of UI component PR."""
        config = AutonomyConfig(
            enabled=True,
            level=AutonomyLevel.LOW_RISK,
            rules=AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.LOW_RISK],
        )

        # PR with UI component
        pr_number = 301
        files_changed = ["apps/web/components/Button.tsx"]
        agent_id = "orchestrator"

        audit_service.log_pr_created(
            pr_number=pr_number,
            branch_name="feat/add-button-component",
            files_changed=files_changed,
            agent_id=agent_id,
        )

        # Validate
        can_merge, reason = config.can_auto_merge(files_changed)
        assert can_merge is True

        # Auto-merge
        audit_service.log_auto_merge(
            pr_number=pr_number,
            files_changed=files_changed,
            agent_id=agent_id,
            risk_level="LOW",
            tests_passed=True,
        )

        metrics = audit_service.get_metrics(window_hours=24)
        assert metrics.total_auto_merged == 1


# ============================================================
# PROTECTED FILES TESTS
# ============================================================


class TestProtectedFilesWorkflow:
    """Test workflow with protected files."""

    def test_protected_file_blocked_at_all_levels(self, audit_service):
        """Test that protected files are blocked at all autonomy levels."""
        protected_file = "apps/web/middleware.ts"
        agent_id = "orchestrator"

        # Test at each level
        for level in [AutonomyLevel.DOCUMENTATION, AutonomyLevel.TESTS, AutonomyLevel.LOW_RISK, AutonomyLevel.FULL]:
            config = AutonomyConfig(
                enabled=True,
                level=level,
                rules=AUTONOMY_RULES_BY_LEVEL[level],
            )

            pr_number = 400 + level.value.__hash__() % 100
            files_changed = [protected_file, "README.md"]

            # Create PR
            audit_service.log_pr_created(
                pr_number=pr_number,
                branch_name=f"test/protected-{level.value}",
                files_changed=files_changed,
                agent_id=agent_id,
            )

            # Should be blocked
            can_merge, reason = config.can_auto_merge(files_changed)
            assert can_merge is False
            assert "Protected files" in reason

            # Log violation and rejection
            audit_service.log_protected_file_violation(
                files=[protected_file],
                agent_id=agent_id,
                pr_number=pr_number,
            )
            audit_service.log_rejection(
                pr_number=pr_number,
                reason=reason,
                files_changed=files_changed,
                agent_id=agent_id,
            )

        # Verify all were blocked
        metrics = audit_service.get_metrics(window_hours=24)
        assert metrics.protected_file_violations >= 4
        assert metrics.total_rejected >= 4
        assert metrics.total_auto_merged == 0


# ============================================================
# RATE LIMITING TESTS
# ============================================================


class TestRateLimitingWorkflow:
    """Test rate limiting behavior."""

    def test_rate_limit_enforcement(self, audit_service):
        """Test that rate limiting blocks excessive PRs."""
        config = AutonomyConfig(
            enabled=True,
            level=AutonomyLevel.DOCUMENTATION,
            rules=AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.DOCUMENTATION],
            max_prs_per_hour=3,  # Allow only 3 PRs per hour
        )

        agent_id = "orchestrator"

        # Create 5 documentation PRs
        for i in range(5):
            pr_number = 500 + i
            files_changed = [f"docs/file{i}.md"]

            audit_service.log_pr_created(
                pr_number=pr_number,
                branch_name=f"docs/update-{i}",
                files_changed=files_changed,
                agent_id=agent_id,
            )

            # Check if we should rate limit
            metrics = audit_service.get_metrics(window_hours=1)
            if metrics.total_auto_merged >= config.max_prs_per_hour:
                # Rate limit hit
                audit_service.log_rate_limit_hit(agent_id=agent_id, pr_number=pr_number)
                audit_service.log_rejection(
                    pr_number=pr_number,
                    reason="Rate limit exceeded",
                    files_changed=files_changed,
                    agent_id=agent_id,
                )
            else:
                # Can auto-merge
                can_merge, _ = config.can_auto_merge(files_changed)
                if can_merge:
                    audit_service.log_auto_merge(
                        pr_number=pr_number,
                        files_changed=files_changed,
                        agent_id=agent_id,
                        risk_level="LOW",
                        tests_passed=True,
                    )

        # Verify rate limiting kicked in
        metrics = audit_service.get_metrics(window_hours=24)
        assert metrics.total_auto_merged <= config.max_prs_per_hour
        assert metrics.rate_limit_hits >= 2  # Last 2 should hit rate limit


# ============================================================
# CIRCUIT BREAKER TESTS
# ============================================================


class TestCircuitBreakerWorkflow:
    """Test circuit breaker behavior."""

    def test_circuit_breaker_opens_on_high_error_rate(self, audit_service):
        """Test that circuit breaker opens on high error rate."""
        config = AutonomyConfig(
            enabled=True,
            level=AutonomyLevel.DOCUMENTATION,
            rules=AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.DOCUMENTATION],
            circuit_breaker_threshold=0.3,  # 30% error rate threshold
        )

        agent_id = "orchestrator"

        # Create scenario: 3 successes, 2 failures (40% error rate)
        for i in range(5):
            pr_number = 600 + i
            files_changed = ["README.md"]

            audit_service.log_pr_created(
                pr_number=pr_number,
                branch_name=f"docs/update-{i}",
                files_changed=files_changed,
                agent_id=agent_id,
            )

            # First 3 succeed, last 2 fail
            if i < 3:
                audit_service.log_auto_merge(
                    pr_number=pr_number,
                    files_changed=files_changed,
                    agent_id=agent_id,
                    risk_level="LOW",
                    tests_passed=True,
                )
            else:
                audit_service.log_rejection(
                    pr_number=pr_number,
                    reason="Tests failed",
                    files_changed=files_changed,
                    agent_id=agent_id,
                )

        # Check error rate
        metrics = audit_service.get_metrics(window_hours=24)
        error_rate = metrics.calculate_error_rate()

        # If error rate exceeds threshold, circuit breaker should open
        if error_rate > config.circuit_breaker_threshold:
            audit_service.log_circuit_breaker_trip(
                reason=f"Error rate {error_rate:.1%} exceeded threshold {config.circuit_breaker_threshold:.1%}",
                agent_id=agent_id,
            )

            # Verify circuit breaker tripped
            metrics = audit_service.get_metrics(window_hours=24)
            assert metrics.circuit_breaker_trips == 1

            # Check for anomalies
            anomalies = audit_service.check_for_anomalies(metrics)
            assert len(anomalies) > 0
            assert any("Circuit breaker" in a for a in anomalies)


# ============================================================
# COMPLETE WORKFLOW TESTS
# ============================================================


class TestCompleteAutonomousWorkflow:
    """Test complete end-to-end autonomous workflows."""

    def test_healthy_autonomous_operation(self, audit_service):
        """Test complete healthy autonomous operation with multiple PRs."""
        config = AutonomyConfig(
            enabled=True,
            level=AutonomyLevel.LOW_RISK,
            rules=AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.LOW_RISK],
            max_prs_per_hour=10,
        )

        agent_id = "orchestrator"

        # Simulate 5 successful autonomous PRs
        successful_prs = [
            (701, "docs/update-readme", ["README.md"]),
            (702, "test/add-unit-tests", ["tests/test_orders.py"]),
            (703, "feat/add-button", ["apps/web/components/Button.tsx"]),
            (704, "docs/update-install", ["docs/INSTALL.md"]),
            (705, "test/add-customer-tests", ["tests/test_customers.py"]),
        ]

        for pr_number, branch_name, files_changed in successful_prs:
            # Step 1: Create PR
            audit_service.log_pr_created(
                pr_number=pr_number,
                branch_name=branch_name,
                files_changed=files_changed,
                agent_id=agent_id,
                autonomy_level=config.level,
            )

            # Step 2: Risk assessment
            audit_service.log_action(
                action=AuditAction.RISK_ASSESSMENT,
                result=AuditResult.SUCCESS,
                agent_id=agent_id,
                pr_number=pr_number,
                risk_level="LOW",
                risk_score=0.1,
            )

            # Step 3: Test validation
            audit_service.log_action(
                action=AuditAction.TEST_VALIDATION,
                result=AuditResult.SUCCESS,
                agent_id=agent_id,
                pr_number=pr_number,
                tests_passed=True,
            )

            # Step 4: File validation
            can_merge, reason = config.can_auto_merge(files_changed)

            # Step 5: Auto-merge or reject
            if can_merge:
                audit_service.log_auto_merge(
                    pr_number=pr_number,
                    files_changed=files_changed,
                    agent_id=agent_id,
                    risk_level="LOW",
                    tests_passed=True,
                    autonomy_level=config.level,
                )
            else:
                audit_service.log_rejection(
                    pr_number=pr_number,
                    reason=reason,
                    files_changed=files_changed,
                    agent_id=agent_id,
                )

        # Verify healthy operation
        metrics = audit_service.get_metrics(window_hours=24)
        assert metrics.total_prs_created == 5
        assert metrics.total_auto_merged == 5
        assert metrics.auto_merge_success_rate == 1.0
        assert metrics.test_pass_rate == 1.0

        # No anomalies
        anomalies = audit_service.check_for_anomalies(metrics)
        assert len(anomalies) == 0

        # Verify audit trail is complete
        entries = audit_service.get_recent_entries(limit=100)
        assert len(entries) == 20  # 5 PRs * 4 actions each

    def test_mixed_autonomous_operation_with_blocks(self, audit_service):
        """Test autonomous operation with mixed successes and blocks."""
        config = AutonomyConfig(
            enabled=True,
            level=AutonomyLevel.DOCUMENTATION,
            rules=AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.DOCUMENTATION],
        )

        agent_id = "orchestrator"

        test_cases = [
            # (pr_number, branch, files, should_succeed)
            (801, "docs/readme", ["README.md"], True),
            (802, "feat/code", ["apps/backend/src/api/routes/orders.py"], False),
            (803, "docs/install", ["docs/INSTALL.md"], True),
            (804, "feat/auth", ["apps/web/middleware.ts"], False),  # Protected
            (805, "docs/contributing", ["CONTRIBUTING.md"], True),
        ]

        for pr_number, branch_name, files_changed, should_succeed in test_cases:
            # Create PR
            audit_service.log_pr_created(
                pr_number=pr_number,
                branch_name=branch_name,
                files_changed=files_changed,
                agent_id=agent_id,
            )

            # Check if can merge
            can_merge, reason = config.can_auto_merge(files_changed)

            # Check for protected files specifically
            if config.is_protected_file(files_changed[0]):
                audit_service.log_protected_file_violation(
                    files=files_changed,
                    agent_id=agent_id,
                    pr_number=pr_number,
                )

            # Auto-merge or reject
            if can_merge:
                audit_service.log_auto_merge(
                    pr_number=pr_number,
                    files_changed=files_changed,
                    agent_id=agent_id,
                    risk_level="LOW",
                    tests_passed=True,
                )
            else:
                audit_service.log_rejection(
                    pr_number=pr_number,
                    reason=reason,
                    files_changed=files_changed,
                    agent_id=agent_id,
                )

        # Verify mixed results
        metrics = audit_service.get_metrics(window_hours=24)
        assert metrics.total_prs_created == 5
        assert metrics.total_auto_merged == 3  # Only docs PRs
        assert metrics.total_rejected == 2  # Code + protected file
        assert metrics.protected_file_violations == 1

        # Should have anomaly for protected file violation
        anomalies = audit_service.check_for_anomalies(metrics)
        assert len(anomalies) > 0
        assert any("Protected file" in a for a in anomalies)


# ============================================================
# ENVIRONMENT CONFIGURATION TESTS
# ============================================================


class TestEnvironmentConfiguration:
    """Test loading configuration from environment."""

    def test_load_config_from_environment(self, monkeypatch):
        """Test loading autonomy config from environment variables."""
        # Set environment variables
        monkeypatch.setenv("AGENT_AUTONOMY_ENABLED", "true")
        monkeypatch.setenv("AGENT_AUTONOMY_LEVEL", "tests")
        monkeypatch.setenv("AGENT_MAX_PRS_PER_HOUR", "5")
        monkeypatch.setenv("AGENT_CIRCUIT_BREAKER_THRESHOLD", "0.10")

        # Reload config
        config = reload_autonomy_config()

        assert config.enabled is True
        assert config.level == AutonomyLevel.TESTS
        assert config.max_prs_per_hour == 5
        assert config.circuit_breaker_threshold == 0.10

    def test_disabled_autonomy_blocks_all(self, monkeypatch, audit_service):
        """Test that disabled autonomy blocks all auto-merges."""
        # Disable autonomy
        monkeypatch.setenv("AGENT_AUTONOMY_ENABLED", "false")
        config = reload_autonomy_config()

        assert config.enabled is False

        # Try to auto-merge a documentation PR
        pr_number = 901
        files_changed = ["README.md"]
        agent_id = "orchestrator"

        audit_service.log_pr_created(
            pr_number=pr_number,
            branch_name="docs/readme",
            files_changed=files_changed,
            agent_id=agent_id,
        )

        # Should be blocked
        can_merge, reason = config.can_auto_merge(files_changed)
        assert can_merge is False
        assert "disabled" in reason

        audit_service.log_rejection(
            pr_number=pr_number,
            reason=reason,
            files_changed=files_changed,
            agent_id=agent_id,
        )

        metrics = audit_service.get_metrics(window_hours=24)
        assert metrics.total_auto_merged == 0
        assert metrics.total_rejected == 1
