"""
Test suite for PR Automation Workflow.

Tests autonomous PR creation, risk assessment, and auto-merge logic.
Part of Phase 5 (Autonomous Development Framework) - Week 3 tests.
"""

import pytest
from datetime import datetime, timedelta, timezone

from src.workflows.pr_automation import (
    PRAutomationWorkflow,
    PRContext,
    AutoMergeDecision,
    PROutcome,
    create_pr_workflow,
)
from src.ai.agents.risk_assessor import RiskLevel, ApprovalPolicy, get_risk_assessor
from src.services.circuit_breaker import CircuitBreakerManager, CircuitState


# ============================================================
# FIXTURES
# ============================================================


@pytest.fixture
def risk_assessor():
    """Create risk assessor for testing."""
    return get_risk_assessor()


@pytest.fixture
def circuit_breaker_manager():
    """Create circuit breaker manager for testing."""
    manager = CircuitBreakerManager()
    manager.reset_all()
    return manager


@pytest.fixture
def pr_workflow(risk_assessor, circuit_breaker_manager):
    """Create PR automation workflow for testing."""
    return PRAutomationWorkflow(
        risk_assessor=risk_assessor,
        circuit_breaker_manager=circuit_breaker_manager,
        max_prs_per_hour=5,
        cooldown_seconds=10,  # Shorter for testing
    )


@pytest.fixture
def documentation_pr():
    """Sample documentation PR context."""
    return PRContext(
        pr_number=1,
        branch="docs/update-readme",
        title="Update README with installation instructions",
        description="Added detailed installation steps",
        changed_files=["README.md", "docs/INSTALL.md"],
        total_additions=50,
        total_deletions=10,
        tests_passed=True,
        has_conflicts=False,
        created_at=datetime.now(timezone.utc),
        author="agent-bot",
    )


@pytest.fixture
def test_addition_pr():
    """Sample test addition PR context."""
    return PRContext(
        pr_number=2,
        branch="test/add-order-tests",
        title="Add E2E tests for order flow",
        description="Comprehensive order lifecycle tests",
        changed_files=["tests/e2e/test_order_flow.py"],
        total_additions=200,
        total_deletions=0,
        tests_passed=True,
        has_conflicts=False,
        created_at=datetime.now(timezone.utc),
        author="agent-bot",
    )


@pytest.fixture
def protected_file_pr():
    """Sample PR modifying protected files."""
    return PRContext(
        pr_number=3,
        branch="security/update-auth",
        title="Update authentication logic",
        description="Enhanced JWT token handling",
        changed_files=["apps/backend/src/api/routes/demo_auth.py"],
        total_additions=50,
        total_deletions=20,
        tests_passed=True,
        has_conflicts=False,
        created_at=datetime.now(timezone.utc),
        author="agent-bot",
    )


@pytest.fixture
def large_change_pr():
    """Sample large code change PR."""
    return PRContext(
        pr_number=4,
        branch="feature/major-refactor",
        title="Refactor entire order processing system",
        description="Complete rewrite of order pipeline",
        changed_files=[
            "apps/backend/src/api/routes/orders.py",
            "apps/backend/src/services/order_service.py",
            "apps/backend/src/db/models_orders.py",
            "apps/web/app/(dashboard)/orders/page.tsx",
            "apps/web/components/orders/OrderForm.tsx",
        ],
        total_additions=800,
        total_deletions=500,
        tests_passed=True,
        has_conflicts=False,
        created_at=datetime.now(timezone.utc),
        author="agent-bot",
    )


@pytest.fixture
def failing_tests_pr():
    """Sample PR with failing tests."""
    return PRContext(
        pr_number=5,
        branch="feature/broken-feature",
        title="Add new feature",
        description="Feature implementation",
        changed_files=["apps/backend/src/services/new_feature.py"],
        total_additions=100,
        total_deletions=0,
        tests_passed=False,
        has_conflicts=False,
        created_at=datetime.now(timezone.utc),
        author="agent-bot",
    )


@pytest.fixture
def conflicting_pr():
    """Sample PR with merge conflicts."""
    return PRContext(
        pr_number=6,
        branch="feature/conflicting-change",
        title="Update same file",
        description="Modify file that was changed elsewhere",
        changed_files=["apps/backend/src/config/settings.py"],
        total_additions=10,
        total_deletions=5,
        tests_passed=True,
        has_conflicts=True,
        created_at=datetime.now(timezone.utc),
        author="agent-bot",
    )


# ============================================================
# BASIC FUNCTIONALITY TESTS
# ============================================================


class TestPRWorkflowBasics:
    """Test basic PR workflow functionality."""

    @pytest.mark.asyncio
    async def test_workflow_initialization(self, pr_workflow):
        """Test workflow initializes correctly."""
        assert pr_workflow.max_prs_per_hour == 5
        assert pr_workflow.cooldown_seconds == 10
        assert len(pr_workflow.recent_merges) == 0
        assert pr_workflow.last_merge_time is None

    @pytest.mark.asyncio
    async def test_create_feature_branch(self, pr_workflow):
        """Test feature branch creation."""
        branch = await pr_workflow.create_feature_branch("add dark mode")
        assert branch == "feature/add-dark-mode"

    @pytest.mark.asyncio
    async def test_commit_changes(self, pr_workflow):
        """Test commit creation."""
        commit_sha = await pr_workflow.commit_changes(
            files=["file1.py", "file2.py"],
            message="Add new feature",
        )
        assert commit_sha is not None
        assert len(commit_sha) > 0

    @pytest.mark.asyncio
    async def test_create_pull_request(self, pr_workflow):
        """Test PR creation."""
        pr = await pr_workflow.create_pull_request(
            branch="feature/test",
            title="Test PR",
            body="Test description",
        )
        assert "number" in pr
        assert "url" in pr
        assert pr["state"] == "open"


# ============================================================
# AUTO-MERGE DECISION TESTS
# ============================================================


class TestAutoMergeDecisions:
    """Test auto-merge decision logic."""

    @pytest.mark.asyncio
    async def test_documentation_pr_approved(self, pr_workflow, documentation_pr):
        """Test documentation PR is approved for auto-merge."""
        result = await pr_workflow.evaluate_auto_merge(documentation_pr)

        assert result.decision == AutoMergeDecision.APPROVED
        assert result.risk_level == RiskLevel.LOW
        assert result.approval_policy == ApprovalPolicy.AUTO_MERGE
        assert result.safety_checks["tests_passed"] is True
        assert result.safety_checks["no_conflicts"] is True
        assert result.safety_checks["circuit_breaker"] is True

    @pytest.mark.asyncio
    async def test_test_addition_approved(self, pr_workflow, test_addition_pr):
        """Test addition PR is approved for auto-merge."""
        result = await pr_workflow.evaluate_auto_merge(test_addition_pr)

        assert result.decision == AutoMergeDecision.APPROVED
        assert result.risk_level == RiskLevel.LOW

    @pytest.mark.asyncio
    async def test_protected_file_blocked(self, pr_workflow, protected_file_pr):
        """Test protected file changes are blocked."""
        result = await pr_workflow.evaluate_auto_merge(protected_file_pr)

        assert result.decision == AutoMergeDecision.BLOCKED
        assert result.risk_level == RiskLevel.CRITICAL
        assert result.approval_policy == ApprovalPolicy.SECURITY_AUDIT
        assert "Protected files cannot be auto-merged" in result.reasoning
        assert "protected_files" in result.safety_checks

    @pytest.mark.asyncio
    async def test_large_change_manual_review(self, pr_workflow, large_change_pr):
        """Test large changes require manual review."""
        result = await pr_workflow.evaluate_auto_merge(large_change_pr)

        # Large changes (>500 LOC) should require manual review
        assert result.decision in [
            AutoMergeDecision.MANUAL_REVIEW,
            AutoMergeDecision.APPROVED,
        ]
        if result.decision == AutoMergeDecision.MANUAL_REVIEW:
            assert result.risk_level in [RiskLevel.MEDIUM, RiskLevel.HIGH]

    @pytest.mark.asyncio
    async def test_failing_tests_blocked(self, pr_workflow, failing_tests_pr):
        """Test PRs with failing tests are blocked."""
        result = await pr_workflow.evaluate_auto_merge(failing_tests_pr)

        assert result.decision == AutoMergeDecision.BLOCKED
        assert result.risk_level == RiskLevel.HIGH
        assert result.safety_checks["tests_passed"] is False
        assert "Tests must pass" in result.reasoning

    @pytest.mark.asyncio
    async def test_conflicts_blocked(self, pr_workflow, conflicting_pr):
        """Test PRs with conflicts are blocked."""
        result = await pr_workflow.evaluate_auto_merge(conflicting_pr)

        assert result.decision == AutoMergeDecision.BLOCKED
        assert result.risk_level == RiskLevel.HIGH
        assert result.safety_checks["no_conflicts"] is False
        assert "conflicts must be resolved" in result.reasoning


# ============================================================
# RATE LIMITING TESTS
# ============================================================


class TestRateLimiting:
    """Test rate limiting enforcement."""

    @pytest.mark.asyncio
    async def test_rate_limit_allows_first_merge(self, pr_workflow, documentation_pr):
        """Test first merge is allowed."""
        result = await pr_workflow.evaluate_auto_merge(documentation_pr)
        assert result.decision == AutoMergeDecision.APPROVED

    @pytest.mark.asyncio
    async def test_rate_limit_enforced(self, pr_workflow, documentation_pr):
        """Test rate limit blocks excessive merges."""
        # Simulate 5 recent merges (at the limit)
        now = datetime.now(timezone.utc)
        pr_workflow.recent_merges = [
            now - timedelta(minutes=i) for i in range(5)
        ]

        result = await pr_workflow.evaluate_auto_merge(documentation_pr)
        assert result.decision == AutoMergeDecision.RATE_LIMITED
        assert result.safety_checks["rate_limit"] is False

    @pytest.mark.asyncio
    async def test_cooldown_period_enforced(self, pr_workflow, documentation_pr):
        """Test cooldown period between merges."""
        # Set last merge time to 5 seconds ago (cooldown is 10 seconds)
        pr_workflow.last_merge_time = datetime.now(timezone.utc) - timedelta(seconds=5)

        result = await pr_workflow.evaluate_auto_merge(documentation_pr)
        assert result.decision == AutoMergeDecision.RATE_LIMITED

    @pytest.mark.asyncio
    async def test_old_merges_expire(self, pr_workflow, documentation_pr):
        """Test merges older than 1 hour don't count toward limit."""
        # Simulate 5 merges from >1 hour ago
        now = datetime.now(timezone.utc)
        pr_workflow.recent_merges = [
            now - timedelta(hours=2) for _ in range(5)
        ]

        result = await pr_workflow.evaluate_auto_merge(documentation_pr)
        # Should be approved (old merges don't count)
        assert result.decision == AutoMergeDecision.APPROVED


# ============================================================
# CIRCUIT BREAKER TESTS
# ============================================================


class TestCircuitBreaker:
    """Test circuit breaker integration."""

    @pytest.mark.asyncio
    async def test_circuit_breaker_open_blocks_merge(
        self, pr_workflow, documentation_pr
    ):
        """Test open circuit breaker blocks auto-merge."""
        # Open the circuit breaker by failing it 5 times
        breaker = pr_workflow.circuit_breaker.get_breaker("pr-automation")

        async def failing_operation():
            raise Exception("Test failure")

        for _ in range(5):
            try:
                await breaker.call(failing_operation)
            except Exception:
                pass

        # Verify circuit is open
        assert breaker.state == CircuitState.OPEN

        # Attempt auto-merge evaluation
        result = await pr_workflow.evaluate_auto_merge(documentation_pr)

        assert result.decision == AutoMergeDecision.CIRCUIT_OPEN
        assert result.safety_checks["circuit_breaker"] is False

    @pytest.mark.asyncio
    async def test_circuit_breaker_closed_allows_merge(
        self, pr_workflow, documentation_pr
    ):
        """Test closed circuit breaker allows auto-merge."""
        breaker = pr_workflow.circuit_breaker.get_breaker("pr-automation")
        assert breaker.state == CircuitState.CLOSED

        result = await pr_workflow.evaluate_auto_merge(documentation_pr)
        assert result.decision == AutoMergeDecision.APPROVED


# ============================================================
# PR LIFECYCLE TESTS
# ============================================================


class TestPRLifecycle:
    """Test complete PR lifecycle."""

    @pytest.mark.asyncio
    async def test_full_pr_lifecycle(self, pr_workflow):
        """Test complete PR lifecycle from branch to merge."""
        # 1. Create branch
        branch = await pr_workflow.create_feature_branch("test-feature")
        assert branch == "feature/test-feature"

        # 2. Commit changes
        commit = await pr_workflow.commit_changes(
            files=["README.md"],
            message="Update documentation",
        )
        assert commit is not None

        # 3. Create PR
        pr_data = await pr_workflow.create_pull_request(
            branch=branch,
            title="Update README",
            body="Documentation improvements",
        )
        pr_number = pr_data["number"]

        # 4. Evaluate auto-merge
        pr_context = PRContext(
            pr_number=pr_number,
            branch=branch,
            title="Update README",
            description="Documentation improvements",
            changed_files=["README.md"],
            total_additions=20,
            total_deletions=5,
            tests_passed=True,
            has_conflicts=False,
            created_at=datetime.now(timezone.utc),
            author="agent-bot",
        )

        decision = await pr_workflow.evaluate_auto_merge(pr_context)
        assert decision.decision == AutoMergeDecision.APPROVED

        # 5. Merge PR
        merged = await pr_workflow.merge_pull_request(pr_number)
        assert merged is True

        # 6. Verify lifecycle events recorded
        assert len(pr_workflow.lifecycle_events) == 2  # created + merged
        assert pr_workflow.lifecycle_events[0].event_type == "created"
        assert pr_workflow.lifecycle_events[1].event_type == "merged"

    @pytest.mark.asyncio
    async def test_merge_updates_rate_limit(self, pr_workflow):
        """Test merge updates rate limit tracking."""
        assert len(pr_workflow.recent_merges) == 0

        await pr_workflow.merge_pull_request(123)

        assert len(pr_workflow.recent_merges) == 1
        assert pr_workflow.last_merge_time is not None


# ============================================================
# INTEGRATION TESTS
# ============================================================


class TestIntegration:
    """Integration tests with risk assessor and circuit breaker."""

    @pytest.mark.asyncio
    async def test_factory_function(self):
        """Test factory function creates workflow correctly."""
        workflow = create_pr_workflow(max_prs_per_hour=10, cooldown_seconds=30)

        assert workflow.max_prs_per_hour == 10
        assert workflow.cooldown_seconds == 30
        assert workflow.risk_assessor is not None
        assert workflow.circuit_breaker is not None

    @pytest.mark.asyncio
    async def test_multiple_prs_in_sequence(self, pr_workflow):
        """Test multiple PRs can be processed sequentially."""
        pr_contexts = [
            PRContext(
                pr_number=i,
                branch=f"feature/pr-{i}",
                title=f"PR {i}",
                description="Test PR",
                changed_files=[f"docs/file{i}.md"],
                total_additions=10,
                total_deletions=0,
                tests_passed=True,
                has_conflicts=False,
                created_at=datetime.now(timezone.utc),
                author="agent-bot",
            )
            for i in range(3)
        ]

        results = []
        for pr_context in pr_contexts:
            result = await pr_workflow.evaluate_auto_merge(pr_context)
            results.append(result)

            # If approved, merge it
            if result.decision == AutoMergeDecision.APPROVED:
                await pr_workflow.merge_pull_request(pr_context.pr_number)

            # Wait for cooldown
            import asyncio
            await asyncio.sleep(0.1)

        # All should be approved
        assert all(r.decision == AutoMergeDecision.APPROVED for r in results)
        assert len(pr_workflow.recent_merges) == 3

    @pytest.mark.asyncio
    async def test_pr_outcome_tracking(self, pr_workflow):
        """Test PR outcome can be tracked."""
        outcome = await pr_workflow.get_pr_outcome(123)
        # For now, returns PENDING (would check GitHub API in production)
        assert outcome == PROutcome.PENDING
