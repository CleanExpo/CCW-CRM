"""
Deployment Service with Rollback Integration.

Manages deployments and triggers automatic rollbacks on failures.
Part of Phase 5 (Autonomous Development Framework) - Week 2 implementation.
"""
from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import Enum
from typing import Any

import structlog

try:
    from src.ai.agents.rollback_agent import (
        RollbackAgent,
        RollbackTrigger,
        get_rollback_agent,
    )
except ImportError:
    RollbackAgent = None  # type: ignore[assignment, misc]
    RollbackTrigger = None  # type: ignore[assignment, misc]
    get_rollback_agent = None  # type: ignore[assignment]
from src.monitoring.metrics import (
    deployment_duration,
    deployment_failures_total,
    deployments_total,
)

logger = structlog.get_logger(__name__)


class DeploymentEnvironment(str, Enum):
    """Deployment environment."""

    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class DeploymentStage(str, Enum):
    """Stage of deployment pipeline."""

    BUILD = "build"
    TEST = "test"
    DEPLOY = "deploy"
    VERIFY = "verify"


class DeploymentStatus(str, Enum):
    """Status of a deployment."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESSFUL = "successful"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


@dataclass
class DeploymentConfig:
    """Configuration for a deployment."""

    environment: DeploymentEnvironment
    commit_hash: str
    branch: str
    components: list[str]  # Services to deploy
    run_tests: bool = True
    auto_rollback: bool = True
    requires_approval: bool = False
    health_check_url: str | None = None


@dataclass
class DeploymentResult:
    """Result of a deployment operation."""

    deployment_id: str
    status: DeploymentStatus
    environment: DeploymentEnvironment
    commit_hash: str
    start_time: datetime
    end_time: datetime | None
    duration_seconds: float
    stage_results: dict[str, Any]  # Results for each stage
    error_message: str | None
    rollback_id: str | None  # If rollback was triggered
    logs: list[str]


class DeploymentService:
    """
    Service for managing deployments with automatic rollback capability.

    Features:
    - Multi-stage deployment pipeline
    - Automatic rollback on failures
    - Health check verification
    - Deployment tracking
    """

    def __init__(self, rollback_agent: RollbackAgent | None = None):
        """
        Initialize deployment service.

        Args:
            rollback_agent: Rollback agent instance (defaults to singleton)
        """
        self.rollback_agent = rollback_agent or get_rollback_agent()
        self.active_deployments: dict[str, DeploymentResult] = {}
        logger.info("Deployment service initialized")

    async def deploy(
        self,
        config: DeploymentConfig,
    ) -> DeploymentResult:
        """
        Execute a deployment with automatic rollback on failure.

        Args:
            config: Deployment configuration

        Returns:
            DeploymentResult with deployment status
        """
        deployment_id = str(uuid.uuid4())
        start_time = datetime.now(UTC)
        logs: list[str] = []

        logger.info(
            "Starting deployment",
            deployment_id=deployment_id,
            environment=config.environment.value,
            commit=config.commit_hash[:8],
        )

        # Record metrics
        deployments_total.labels(environment=config.environment.value).inc()

        # Track active deployment
        result = DeploymentResult(
            deployment_id=deployment_id,
            status=DeploymentStatus.IN_PROGRESS,
            environment=config.environment,
            commit_hash=config.commit_hash,
            start_time=start_time,
            end_time=None,
            duration_seconds=0.0,
            stage_results={},
            error_message=None,
            rollback_id=None,
            logs=logs,
        )
        self.active_deployments[deployment_id] = result

        try:
            # Stage 1: Build
            logs.append(f"[{datetime.now(UTC).isoformat()}] Starting build stage")
            build_result = await self._execute_build_stage(config)
            result.stage_results["build"] = build_result
            if not build_result["success"]:
                raise Exception(f"Build failed: {build_result['error']}")
            logs.append(f"[{datetime.now(UTC).isoformat()}] Build stage completed")

            # Stage 2: Test (if enabled)
            if config.run_tests:
                logs.append(f"[{datetime.now(UTC).isoformat()}] Starting test stage")
                test_result = await self._execute_test_stage(config)
                result.stage_results["test"] = test_result
                if not test_result["success"]:
                    # Test failure - trigger rollback
                    if config.auto_rollback:
                        logs.append(
                            f"[{datetime.now(UTC).isoformat()}] Test failures detected, triggering rollback"
                        )
                        rollback_id = await self._trigger_rollback(
                            config=config,
                            trigger=RollbackTrigger.TEST_FAILURE,
                            failure_details={
                                "critical_test_failures": test_result.get("failures", 0)
                            },
                        )
                        result.rollback_id = rollback_id
                    raise Exception(f"Tests failed: {test_result['error']}")
                logs.append(f"[{datetime.now(UTC).isoformat()}] Test stage completed")

            # Stage 3: Deploy
            logs.append(f"[{datetime.now(UTC).isoformat()}] Starting deploy stage")
            deploy_result = await self._execute_deploy_stage(config)
            result.stage_results["deploy"] = deploy_result
            if not deploy_result["success"]:
                # Deploy failure - trigger rollback
                if config.auto_rollback:
                    logs.append(
                        f"[{datetime.now(UTC).isoformat()}] Deploy failed, triggering rollback"
                    )
                    rollback_id = await self._trigger_rollback(
                        config=config,
                        trigger=RollbackTrigger.BUILD_FAILURE,
                        failure_details={"error": deploy_result["error"]},
                    )
                    result.rollback_id = rollback_id
                raise Exception(f"Deploy failed: {deploy_result['error']}")
            logs.append(f"[{datetime.now(UTC).isoformat()}] Deploy stage completed")

            # Stage 4: Verify
            logs.append(f"[{datetime.now(UTC).isoformat()}] Starting verify stage")
            verify_result = await self._execute_verify_stage(config)
            result.stage_results["verify"] = verify_result
            if not verify_result["success"]:
                # Verification failure - trigger rollback
                if config.auto_rollback:
                    logs.append(
                        f"[{datetime.now(UTC).isoformat()}] Verification failed, triggering rollback"
                    )
                    rollback_id = await self._trigger_rollback(
                        config=config,
                        trigger=RollbackTrigger.HEALTH_CHECK_FAILURE,
                        failure_details={
                            "consecutive_failures": verify_result.get("failed_checks", 0)
                        },
                    )
                    result.rollback_id = rollback_id
                raise Exception(f"Verification failed: {verify_result['error']}")
            logs.append(f"[{datetime.now(UTC).isoformat()}] Verify stage completed")

            # Success!
            end_time = datetime.now(UTC)
            duration = (end_time - start_time).total_seconds()

            result.status = DeploymentStatus.SUCCESSFUL
            result.end_time = end_time
            result.duration_seconds = duration

            # Record metrics
            deployment_duration.labels(environment=config.environment.value).observe(duration)

            logger.info(
                "Deployment completed successfully",
                deployment_id=deployment_id,
                environment=config.environment.value,
                duration=duration,
            )

            return result

        except Exception as e:
            end_time = datetime.now(UTC)
            duration = (end_time - start_time).total_seconds()

            # Determine which stage failed
            failed_stage = DeploymentStage.BUILD
            if "test" in result.stage_results:
                failed_stage = DeploymentStage.TEST
            if "deploy" in result.stage_results:
                failed_stage = DeploymentStage.DEPLOY
            if "verify" in result.stage_results:
                failed_stage = DeploymentStage.VERIFY

            # Record metrics
            deployment_failures_total.labels(
                environment=config.environment.value,
                stage=failed_stage.value,
            ).inc()

            error_msg = str(e)
            logs.append(f"[{datetime.now(UTC).isoformat()}] ERROR: {error_msg}")

            result.status = (
                DeploymentStatus.ROLLED_BACK
                if result.rollback_id
                else DeploymentStatus.FAILED
            )
            result.end_time = end_time
            result.duration_seconds = duration
            result.error_message = error_msg

            logger.error(
                "Deployment failed",
                deployment_id=deployment_id,
                environment=config.environment.value,
                error=error_msg,
                rollback_triggered=result.rollback_id is not None,
            )

            return result

        finally:
            # Clean up active deployments
            self.active_deployments.pop(deployment_id, None)

    async def _execute_build_stage(self, config: DeploymentConfig) -> dict[str, Any]:
        """
        Execute the build stage.

        Args:
            config: Deployment configuration

        Returns:
            Build stage result
        """
        logger.debug("Executing build stage", environment=config.environment.value)
        await asyncio.sleep(0.5)  # Simulate build time

        # In real implementation:
        # - Checkout code
        # - Install dependencies
        # - Compile/build
        # - Create artifacts

        return {
            "success": True,
            "duration": 0.5,
            "artifacts": ["backend.tar.gz", "frontend.tar.gz"],
        }

    async def _execute_test_stage(self, config: DeploymentConfig) -> dict[str, Any]:
        """
        Execute the test stage.

        Args:
            config: Deployment configuration

        Returns:
            Test stage result
        """
        logger.debug("Executing test stage", environment=config.environment.value)
        await asyncio.sleep(1.0)  # Simulate test time

        # In real implementation:
        # - Run unit tests
        # - Run integration tests
        # - Run E2E tests
        # - Check coverage

        return {
            "success": True,
            "duration": 1.0,
            "tests_run": 150,
            "tests_passed": 150,
            "tests_failed": 0,
            "coverage": 85.2,
        }

    async def _execute_deploy_stage(self, config: DeploymentConfig) -> dict[str, Any]:
        """
        Execute the deploy stage.

        Args:
            config: Deployment configuration

        Returns:
            Deploy stage result
        """
        logger.debug("Executing deploy stage", environment=config.environment.value)
        await asyncio.sleep(0.8)  # Simulate deploy time

        # In real implementation:
        # - Deploy to servers
        # - Update load balancer
        # - Run database migrations
        # - Restart services

        return {
            "success": True,
            "duration": 0.8,
            "components_deployed": config.components,
        }

    async def _execute_verify_stage(self, config: DeploymentConfig) -> dict[str, Any]:
        """
        Execute the verification stage.

        Args:
            config: Deployment configuration

        Returns:
            Verification stage result
        """
        logger.debug("Executing verify stage", environment=config.environment.value)
        await asyncio.sleep(0.3)  # Simulate verification time

        # In real implementation:
        # - Health check endpoints
        # - Smoke tests
        # - Performance checks
        # - Error rate monitoring

        return {
            "success": True,
            "duration": 0.3,
            "health_checks_passed": 10,
            "health_checks_failed": 0,
            "response_time_ms": 45,
            "error_rate": 0.0,
        }

    async def _trigger_rollback(
        self,
        config: DeploymentConfig,
        trigger: RollbackTrigger,
        failure_details: dict[str, Any],
    ) -> str | None:
        """
        Trigger an automatic rollback.

        Args:
            config: Deployment configuration
            trigger: Reason for rollback
            failure_details: Details about the failure

        Returns:
            Rollback ID if triggered, None if not needed
        """
        logger.warning(
            "Triggering automatic rollback",
            environment=config.environment.value,
            trigger=trigger.value,
        )

        # Check if rollback should be triggered
        should_rollback = await self.rollback_agent.should_trigger_rollback(
            trigger=trigger,
            failure_details=failure_details,
        )

        if not should_rollback:
            logger.info("Rollback criteria not met, skipping rollback")
            return None

        # Create rollback plan
        plan = await self.rollback_agent.create_rollback_plan(
            trigger=trigger,
            current_commit=config.commit_hash,
            affected_components=config.components,
        )

        # Execute rollback
        rollback_id = str(uuid.uuid4())
        result = await self.rollback_agent.execute_rollback(
            plan=plan,
            rollback_id=rollback_id,
            dry_run=False,
        )

        logger.info(
            "Rollback completed",
            rollback_id=rollback_id,
            status=result.status.value,
            requires_intervention=result.requires_manual_intervention,
        )

        return rollback_id

    def get_active_deployments(self) -> list[DeploymentResult]:
        """
        Get list of currently active deployments.

        Returns:
            List of active deployment results
        """
        return list(self.active_deployments.values())


# Singleton instance
_deployment_service: DeploymentService | None = None


def get_deployment_service() -> DeploymentService:
    """Get the singleton deployment service instance."""
    global _deployment_service
    if _deployment_service is None:
        _deployment_service = DeploymentService()
    return _deployment_service
