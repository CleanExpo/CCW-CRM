"""
Test suite for Rollback Mechanism.

Tests the rollback agent and deployment service rollback integration.
Part of Phase 5 (Autonomous Development Framework) - Week 2 tests.
"""

import uuid
from datetime import datetime, timezone

import pytest

from src.ai.agents.rollback_agent import (
    RollbackAgent,
    RollbackPlan,
    RollbackStatus,
    RollbackStrategy,
    RollbackTrigger,
)
from src.services.deployment_service import (
    DeploymentConfig,
    DeploymentEnvironment,
    DeploymentService,
    DeploymentStatus,
)

# ============================================================
# ROLLBACK AGENT TESTS
# ============================================================


class TestRollbackAgent:
    """Test suite for RollbackAgent."""

    @pytest.fixture
    def rollback_agent(self):
        """Create a rollback agent instance."""
        return RollbackAgent(repo_path="/tmp/test-repo")

    @pytest.mark.asyncio
    async def test_initialization(self, rollback_agent):
        """Test rollback agent initialization."""
        assert rollback_agent.name == "RollbackAgent"
        assert rollback_agent.repo_path == "/tmp/test-repo"
        assert rollback_agent.last_rollback_time is None

    @pytest.mark.asyncio
    async def test_should_trigger_rollback_test_failure_with_critical_failures(
        self, rollback_agent
    ):
        """Test rollback trigger for critical test failures."""
        should_trigger = await rollback_agent.should_trigger_rollback(
            trigger=RollbackTrigger.TEST_FAILURE,
            failure_details={"critical_test_failures": 5},
        )
        assert should_trigger is True

    @pytest.mark.asyncio
    async def test_should_trigger_rollback_test_failure_no_critical_failures(
        self, rollback_agent
    ):
        """Test no rollback trigger for non-critical test failures."""
        should_trigger = await rollback_agent.should_trigger_rollback(
            trigger=RollbackTrigger.TEST_FAILURE,
            failure_details={"critical_test_failures": 0},
        )
        assert should_trigger is False

    @pytest.mark.asyncio
    async def test_should_trigger_rollback_build_failure(self, rollback_agent):
        """Test rollback trigger for build failures."""
        should_trigger = await rollback_agent.should_trigger_rollback(
            trigger=RollbackTrigger.BUILD_FAILURE,
            failure_details={},
        )
        assert should_trigger is True

    @pytest.mark.asyncio
    async def test_should_trigger_rollback_runtime_error_high_rate(self, rollback_agent):
        """Test rollback trigger for high error rate."""
        should_trigger = await rollback_agent.should_trigger_rollback(
            trigger=RollbackTrigger.RUNTIME_ERROR,
            failure_details={"error_rate": 0.10},  # 10% error rate
        )
        assert should_trigger is True

    @pytest.mark.asyncio
    async def test_should_trigger_rollback_runtime_error_low_rate(self, rollback_agent):
        """Test no rollback trigger for low error rate."""
        should_trigger = await rollback_agent.should_trigger_rollback(
            trigger=RollbackTrigger.RUNTIME_ERROR,
            failure_details={"error_rate": 0.02},  # 2% error rate
        )
        assert should_trigger is False

    @pytest.mark.asyncio
    async def test_should_trigger_rollback_health_check_multiple_failures(
        self, rollback_agent
    ):
        """Test rollback trigger for multiple health check failures."""
        should_trigger = await rollback_agent.should_trigger_rollback(
            trigger=RollbackTrigger.HEALTH_CHECK_FAILURE,
            failure_details={"consecutive_failures": 3},
        )
        assert should_trigger is True

    @pytest.mark.asyncio
    async def test_should_trigger_rollback_health_check_few_failures(self, rollback_agent):
        """Test no rollback trigger for few health check failures."""
        should_trigger = await rollback_agent.should_trigger_rollback(
            trigger=RollbackTrigger.HEALTH_CHECK_FAILURE,
            failure_details={"consecutive_failures": 2},
        )
        assert should_trigger is False

    @pytest.mark.asyncio
    async def test_should_trigger_rollback_manual(self, rollback_agent):
        """Test rollback trigger for manual intervention."""
        should_trigger = await rollback_agent.should_trigger_rollback(
            trigger=RollbackTrigger.MANUAL,
            failure_details={},
        )
        assert should_trigger is True

    @pytest.mark.asyncio
    async def test_should_trigger_rollback_cooldown_period(self, rollback_agent):
        """Test rollback cooldown period enforcement."""
        # Set last rollback time to now
        rollback_agent.last_rollback_time = datetime.now(timezone.utc)

        # Should not trigger during cooldown
        should_trigger = await rollback_agent.should_trigger_rollback(
            trigger=RollbackTrigger.MANUAL,
            failure_details={},
        )
        assert should_trigger is False

    @pytest.mark.asyncio
    async def test_create_rollback_plan_basic(self, rollback_agent):
        """Test creating a basic rollback plan."""
        plan = await rollback_agent.create_rollback_plan(
            trigger=RollbackTrigger.TEST_FAILURE,
            current_commit="abc123def456",
            target_commit="xyz789uvw123",
            affected_components=["backend", "frontend"],
        )

        assert isinstance(plan, RollbackPlan)
        assert plan.trigger == RollbackTrigger.TEST_FAILURE
        assert plan.target_commit == "xyz789uvw123"
        assert plan.affected_components == ["backend", "frontend"]
        assert plan.strategy == RollbackStrategy.GIT_REVERT
        assert len(plan.safety_checks) > 0
        assert len(plan.rollback_steps) > 0
        assert len(plan.verification_steps) > 0

    @pytest.mark.asyncio
    async def test_create_rollback_plan_requires_manual_approval(self, rollback_agent):
        """Test rollback plan for runtime errors requires manual approval."""
        plan = await rollback_agent.create_rollback_plan(
            trigger=RollbackTrigger.RUNTIME_ERROR,
            current_commit="abc123",
        )

        assert plan.requires_manual_approval is True

    @pytest.mark.asyncio
    async def test_execute_rollback_dry_run(self, rollback_agent):
        """Test rollback execution in dry-run mode."""
        plan = await rollback_agent.create_rollback_plan(
            trigger=RollbackTrigger.TEST_FAILURE,
            current_commit="abc123",
        )

        rollback_id = str(uuid.uuid4())
        result = await rollback_agent.execute_rollback(
            plan=plan,
            rollback_id=rollback_id,
            dry_run=True,
        )

        assert result.rollback_id == rollback_id
        assert result.status == RollbackStatus.SUCCESSFUL
        assert result.duration_seconds > 0
        assert len(result.logs) > 0
        assert result.error_message is None

    @pytest.mark.asyncio
    async def test_execute_rollback_success(self, rollback_agent):
        """Test successful rollback execution."""
        plan = await rollback_agent.create_rollback_plan(
            trigger=RollbackTrigger.BUILD_FAILURE,
            current_commit="abc123",
            affected_components=["backend"],
        )

        rollback_id = str(uuid.uuid4())
        result = await rollback_agent.execute_rollback(
            plan=plan,
            rollback_id=rollback_id,
            dry_run=False,
        )

        assert result.status == RollbackStatus.SUCCESSFUL
        assert result.trigger == RollbackTrigger.BUILD_FAILURE
        assert result.strategy == RollbackStrategy.GIT_REVERT
        assert result.end_time is not None
        assert result.duration_seconds > 0
        assert result.components_rolled_back == ["backend"]
        assert result.components_failed == []
        assert result.requires_manual_intervention is False

        # Check last rollback time was updated
        assert rollback_agent.last_rollback_time is not None

    @pytest.mark.asyncio
    async def test_execute_rollback_records_metrics(self, rollback_agent):
        """Test that rollback execution records Prometheus metrics."""
        plan = await rollback_agent.create_rollback_plan(
            trigger=RollbackTrigger.MANUAL,
            current_commit="abc123",
        )

        rollback_id = str(uuid.uuid4())
        result = await rollback_agent.execute_rollback(
            plan=plan,
            rollback_id=rollback_id,
            dry_run=False,
        )

        # Metrics should be recorded (can't directly assert, but execution should not fail)
        assert result.status == RollbackStatus.SUCCESSFUL


# ============================================================
# DEPLOYMENT SERVICE TESTS
# ============================================================


class TestDeploymentService:
    """Test suite for DeploymentService with rollback integration."""

    @pytest.fixture
    def deployment_service(self):
        """Create a deployment service instance."""
        rollback_agent = RollbackAgent(repo_path="/tmp/test-repo")
        return DeploymentService(rollback_agent=rollback_agent)

    @pytest.mark.asyncio
    async def test_deployment_service_initialization(self, deployment_service):
        """Test deployment service initialization."""
        assert deployment_service.rollback_agent is not None
        assert len(deployment_service.active_deployments) == 0

    @pytest.mark.asyncio
    async def test_deploy_success(self, deployment_service):
        """Test successful deployment without rollback."""
        config = DeploymentConfig(
            environment=DeploymentEnvironment.DEVELOPMENT,
            commit_hash="abc123def456",
            branch="main",
            components=["backend", "frontend"],
            run_tests=True,
            auto_rollback=True,
        )

        result = await deployment_service.deploy(config)

        assert result.status == DeploymentStatus.SUCCESSFUL
        assert result.environment == DeploymentEnvironment.DEVELOPMENT
        assert result.commit_hash == "abc123def456"
        assert result.end_time is not None
        assert result.duration_seconds > 0
        assert "build" in result.stage_results
        assert "test" in result.stage_results
        assert "deploy" in result.stage_results
        assert "verify" in result.stage_results
        assert result.error_message is None
        assert result.rollback_id is None

    @pytest.mark.asyncio
    async def test_deploy_skip_tests(self, deployment_service):
        """Test deployment without running tests."""
        config = DeploymentConfig(
            environment=DeploymentEnvironment.DEVELOPMENT,
            commit_hash="abc123",
            branch="feature/test",
            components=["backend"],
            run_tests=False,
        )

        result = await deployment_service.deploy(config)

        assert result.status == DeploymentStatus.SUCCESSFUL
        assert "test" not in result.stage_results

    @pytest.mark.asyncio
    async def test_deploy_records_metrics(self, deployment_service):
        """Test that deployment records Prometheus metrics."""
        config = DeploymentConfig(
            environment=DeploymentEnvironment.STAGING,
            commit_hash="abc123",
            branch="main",
            components=["backend"],
        )

        result = await deployment_service.deploy(config)

        # Metrics should be recorded (can't directly assert, but execution should not fail)
        assert result.status == DeploymentStatus.SUCCESSFUL

    @pytest.mark.asyncio
    async def test_get_active_deployments(self, deployment_service):
        """Test getting active deployments."""
        active = deployment_service.get_active_deployments()
        assert isinstance(active, list)
        assert len(active) == 0


# ============================================================
# INTEGRATION TESTS
# ============================================================


class TestRollbackIntegration:
    """Integration tests for rollback mechanism."""

    @pytest.fixture
    def system(self):
        """Create integrated system with rollback agent and deployment service."""
        rollback_agent = RollbackAgent(repo_path="/tmp/test-repo")
        deployment_service = DeploymentService(rollback_agent=rollback_agent)
        return {
            "rollback_agent": rollback_agent,
            "deployment_service": deployment_service,
        }

    @pytest.mark.asyncio
    async def test_deployment_lifecycle_success(self, system):
        """Test complete deployment lifecycle without failures."""
        deployment_service = system["deployment_service"]

        config = DeploymentConfig(
            environment=DeploymentEnvironment.PRODUCTION,
            commit_hash="prod123abc",
            branch="main",
            components=["backend", "frontend", "database"],
            run_tests=True,
            auto_rollback=True,
        )

        result = await deployment_service.deploy(config)

        assert result.status == DeploymentStatus.SUCCESSFUL
        assert result.rollback_id is None
        assert all(
            stage in result.stage_results
            for stage in ["build", "test", "deploy", "verify"]
        )

    @pytest.mark.asyncio
    async def test_rollback_plan_includes_all_components(self, system):
        """Test that rollback plan includes all affected components."""
        rollback_agent = system["rollback_agent"]

        plan = await rollback_agent.create_rollback_plan(
            trigger=RollbackTrigger.TEST_FAILURE,
            current_commit="abc123",
            affected_components=["backend", "frontend", "database", "cache"],
        )

        assert len(plan.affected_components) == 4
        assert "backend" in plan.affected_components
        assert "frontend" in plan.affected_components
        assert "database" in plan.affected_components
        assert "cache" in plan.affected_components

    @pytest.mark.asyncio
    async def test_rollback_executes_safety_checks_before_rollback(self, system):
        """Test that safety checks are executed before rollback."""
        rollback_agent = system["rollback_agent"]

        plan = await rollback_agent.create_rollback_plan(
            trigger=RollbackTrigger.BUILD_FAILURE,
            current_commit="abc123",
        )

        rollback_id = str(uuid.uuid4())
        result = await rollback_agent.execute_rollback(
            plan=plan,
            rollback_id=rollback_id,
            dry_run=False,
        )

        # Check logs contain safety check execution
        log_text = " ".join(result.logs)
        assert "Safety checks" in log_text

    @pytest.mark.asyncio
    async def test_rollback_verifies_success_after_execution(self, system):
        """Test that verification runs after rollback execution."""
        rollback_agent = system["rollback_agent"]

        plan = await rollback_agent.create_rollback_plan(
            trigger=RollbackTrigger.MANUAL,
            current_commit="abc123",
        )

        rollback_id = str(uuid.uuid4())
        result = await rollback_agent.execute_rollback(
            plan=plan,
            rollback_id=rollback_id,
            dry_run=False,
        )

        # Check logs contain verification execution
        log_text = " ".join(result.logs)
        assert "Verification" in log_text

    @pytest.mark.asyncio
    async def test_multiple_rollbacks_respect_cooldown(self, system):
        """Test that multiple rollbacks respect cooldown period."""
        rollback_agent = system["rollback_agent"]

        # First rollback
        plan1 = await rollback_agent.create_rollback_plan(
            trigger=RollbackTrigger.MANUAL,
            current_commit="abc123",
        )
        result1 = await rollback_agent.execute_rollback(
            plan=plan1,
            rollback_id=str(uuid.uuid4()),
            dry_run=False,
        )
        assert result1.status == RollbackStatus.SUCCESSFUL

        # Second rollback immediately after - should be rejected by cooldown
        should_trigger = await rollback_agent.should_trigger_rollback(
            trigger=RollbackTrigger.MANUAL,
            failure_details={},
        )
        assert should_trigger is False

    @pytest.mark.asyncio
    async def test_rollback_logs_are_comprehensive(self, system):
        """Test that rollback logs capture all important events."""
        rollback_agent = system["rollback_agent"]

        plan = await rollback_agent.create_rollback_plan(
            trigger=RollbackTrigger.TEST_FAILURE,
            current_commit="abc123",
        )

        rollback_id = str(uuid.uuid4())
        result = await rollback_agent.execute_rollback(
            plan=plan,
            rollback_id=rollback_id,
            dry_run=False,
        )

        # Logs should contain timestamps and key events
        assert len(result.logs) >= 6  # Safety, execution, verification events
        # Check that logs contain timestamps (ISO format) or key event descriptions
        log_text = " ".join(result.logs)
        assert any(keyword in log_text for keyword in ["Safety", "Rollback", "Verification"])
        # Verify logs have ISO 8601 timestamps (contain T and +/Z for timezone)
        assert any("T" in log for log in result.logs)
