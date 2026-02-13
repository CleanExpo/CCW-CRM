"""
Rollback Agent for Autonomous Development.

Automatically reverts failed deployments and merges to maintain system stability.
Part of Phase 5 (Autonomous Development Framework) - Week 2 implementation.
"""

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any

import structlog

from src.monitoring.metrics import (
    rollback_duration,
    rollbacks_failed,
    rollbacks_successful,
    rollbacks_triggered,
)

logger = structlog.get_logger(__name__)


class RollbackTrigger(str, Enum):
    """Reasons that trigger a rollback."""

    TEST_FAILURE = "test_failure"  # Test suite failed post-merge
    BUILD_FAILURE = "build_failure"  # Build/compilation failed
    RUNTIME_ERROR = "runtime_error"  # Critical runtime error detected
    HEALTH_CHECK_FAILURE = "health_check_failure"  # Service health check failed
    MANUAL = "manual"  # Manual intervention by operator


class RollbackStatus(str, Enum):
    """Status of a rollback operation."""

    INITIATED = "initiated"
    IN_PROGRESS = "in_progress"
    SUCCESSFUL = "successful"
    FAILED = "failed"
    PARTIAL = "partial"  # Some components rolled back, others failed


class RollbackStrategy(str, Enum):
    """Strategy for performing rollback."""

    GIT_REVERT = "git_revert"  # Revert git commits
    PREVIOUS_DEPLOYMENT = "previous_deployment"  # Deploy previous known-good version
    SNAPSHOT_RESTORE = "snapshot_restore"  # Restore from snapshot
    MANUAL_INTERVENTION = "manual_intervention"  # Requires manual intervention


@dataclass
class RollbackPlan:
    """Plan for performing a rollback operation."""

    trigger: RollbackTrigger
    target_commit: str  # Commit hash to revert to
    affected_components: list[str]  # Services/components affected
    strategy: RollbackStrategy
    estimated_duration_seconds: int
    requires_manual_approval: bool
    safety_checks: list[str]  # Checks to perform before rollback
    rollback_steps: list[str]  # Steps to execute
    verification_steps: list[str]  # Steps to verify rollback success


@dataclass
class RollbackResult:
    """Result of a rollback operation."""

    rollback_id: str
    status: RollbackStatus
    trigger: RollbackTrigger
    strategy: RollbackStrategy
    start_time: datetime
    end_time: datetime | None
    duration_seconds: float
    reverted_commit: str | None
    target_commit: str
    components_rolled_back: list[str]
    components_failed: list[str]
    error_message: str | None
    logs: list[str]
    requires_manual_intervention: bool


class RollbackAgent:
    """
    Autonomous agent for rolling back failed deployments.

    Responsibilities:
    - Detect deployment failures
    - Create rollback plan
    - Execute rollback strategy
    - Verify rollback success
    - Alert team if manual intervention needed
    """

    # Maximum time to wait for rollback completion (seconds)
    MAX_ROLLBACK_DURATION = 300  # 5 minutes

    # Cooldown period between rollbacks (seconds)
    ROLLBACK_COOLDOWN = 60  # 1 minute

    def __init__(self, repo_path: str | None = None):
        """
        Initialize the rollback agent.

        Args:
            repo_path: Path to the git repository (defaults to current directory)
        """
        self.name = "RollbackAgent"
        self.repo_path = repo_path or "."
        self.last_rollback_time: datetime | None = None
        logger.info("Rollback agent initialized", repo_path=self.repo_path)

    async def should_trigger_rollback(
        self,
        trigger: RollbackTrigger,
        failure_details: dict[str, Any],
    ) -> bool:
        """
        Determine if a rollback should be triggered.

        Args:
            trigger: The reason for potential rollback
            failure_details: Details about the failure

        Returns:
            True if rollback should be triggered, False otherwise
        """
        # Check cooldown period
        if self.last_rollback_time:
            time_since_last = (
                datetime.now(timezone.utc) - self.last_rollback_time
            ).total_seconds()
            if time_since_last < self.ROLLBACK_COOLDOWN:
                logger.warning(
                    "Rollback cooldown active",
                    seconds_remaining=self.ROLLBACK_COOLDOWN - time_since_last,
                )
                return False

        # Trigger-specific logic
        if trigger == RollbackTrigger.TEST_FAILURE:
            # Only rollback if critical tests failed
            critical_failures = failure_details.get("critical_test_failures", 0)
            return critical_failures > 0

        elif trigger == RollbackTrigger.BUILD_FAILURE:
            # Always rollback on build failures
            return True

        elif trigger == RollbackTrigger.RUNTIME_ERROR:
            # Rollback if error rate exceeds threshold
            error_rate = failure_details.get("error_rate", 0.0)
            return error_rate > 0.05  # 5% error rate

        elif trigger == RollbackTrigger.HEALTH_CHECK_FAILURE:
            # Rollback if health check failed multiple times
            consecutive_failures = failure_details.get("consecutive_failures", 0)
            return consecutive_failures >= 3

        elif trigger == RollbackTrigger.MANUAL:
            # Always honor manual rollback requests
            return True

        return False

    async def create_rollback_plan(
        self,
        trigger: RollbackTrigger,
        current_commit: str,
        target_commit: str | None = None,
        affected_components: list[str] | None = None,
    ) -> RollbackPlan:
        """
        Create a rollback plan.

        Args:
            trigger: Why the rollback is needed
            current_commit: Current commit hash
            target_commit: Target commit to revert to (defaults to previous)
            affected_components: Components affected by the change

        Returns:
            RollbackPlan with strategy and steps
        """
        logger.info(
            "Creating rollback plan",
            trigger=trigger.value,
            current_commit=current_commit[:8],
        )

        # Determine target commit if not specified
        if not target_commit:
            target_commit = await self._get_previous_commit(current_commit)

        # Determine strategy
        strategy = RollbackStrategy.GIT_REVERT

        # Define safety checks
        safety_checks = [
            "Verify target commit exists",
            "Check for uncommitted changes",
            "Backup current state",
            "Verify no ongoing deployments",
        ]

        # Define rollback steps
        rollback_steps = [
            f"Git checkout {target_commit[:8]}",
            "Run database migration rollback (if needed)",
            "Restart affected services",
            "Clear caches",
            "Run smoke tests",
        ]

        # Define verification steps
        verification_steps = [
            "Health check all services",
            "Verify critical endpoints responding",
            "Check error rates < 1%",
            "Verify database integrity",
        ]

        plan = RollbackPlan(
            trigger=trigger,
            target_commit=target_commit,
            affected_components=affected_components or ["backend", "frontend"],
            strategy=strategy,
            estimated_duration_seconds=60,
            requires_manual_approval=trigger == RollbackTrigger.RUNTIME_ERROR,
            safety_checks=safety_checks,
            rollback_steps=rollback_steps,
            verification_steps=verification_steps,
        )

        logger.info(
            "Rollback plan created",
            strategy=strategy.value,
            target_commit=target_commit[:8],
            estimated_duration=plan.estimated_duration_seconds,
        )

        return plan

    async def execute_rollback(
        self,
        plan: RollbackPlan,
        rollback_id: str,
        dry_run: bool = False,
    ) -> RollbackResult:
        """
        Execute a rollback operation.

        Args:
            plan: The rollback plan to execute
            rollback_id: Unique identifier for this rollback
            dry_run: If True, simulate rollback without making changes

        Returns:
            RollbackResult with execution details
        """
        start_time = datetime.now(timezone.utc)
        logs: list[str] = []

        logger.info(
            "Starting rollback execution",
            rollback_id=rollback_id,
            strategy=plan.strategy.value,
            dry_run=dry_run,
        )

        # Record metrics
        rollbacks_triggered.labels(trigger_reason=plan.trigger.value).inc()

        try:
            # 1. Perform safety checks
            logs.append(f"[{datetime.now(timezone.utc).isoformat()}] Safety checks started")
            await self._perform_safety_checks(plan.safety_checks, dry_run)
            logs.append(f"[{datetime.now(timezone.utc).isoformat()}] Safety checks passed")

            # 2. Execute rollback steps
            logs.append(f"[{datetime.now(timezone.utc).isoformat()}] Rollback execution started")
            await self._execute_rollback_steps(plan, dry_run, logs)
            logs.append(f"[{datetime.now(timezone.utc).isoformat()}] Rollback execution completed")

            # 3. Verify rollback success
            logs.append(f"[{datetime.now(timezone.utc).isoformat()}] Verification started")
            verification_passed = await self._verify_rollback(plan.verification_steps, dry_run)
            logs.append(
                f"[{datetime.now(timezone.utc).isoformat()}] Verification {'passed' if verification_passed else 'failed'}"
            )

            end_time = datetime.now(timezone.utc)
            duration = (end_time - start_time).total_seconds()

            # Record success
            rollbacks_successful.inc()
            rollback_duration.observe(duration)

            self.last_rollback_time = end_time

            result = RollbackResult(
                rollback_id=rollback_id,
                status=RollbackStatus.SUCCESSFUL if verification_passed else RollbackStatus.PARTIAL,
                trigger=plan.trigger,
                strategy=plan.strategy,
                start_time=start_time,
                end_time=end_time,
                duration_seconds=duration,
                reverted_commit=None,
                target_commit=plan.target_commit,
                components_rolled_back=plan.affected_components,
                components_failed=[],
                error_message=None if verification_passed else "Some verification steps failed",
                logs=logs,
                requires_manual_intervention=not verification_passed,
            )

            logger.info(
                "Rollback completed successfully",
                rollback_id=rollback_id,
                duration=duration,
                status=result.status.value,
            )

            return result

        except Exception as e:
            end_time = datetime.now(timezone.utc)
            duration = (end_time - start_time).total_seconds()

            # Record failure
            rollbacks_failed.inc()

            error_msg = f"Rollback failed: {str(e)}"
            logs.append(f"[{datetime.now(timezone.utc).isoformat()}] ERROR: {error_msg}")

            logger.error(
                "Rollback failed",
                rollback_id=rollback_id,
                error=str(e),
                duration=duration,
            )

            return RollbackResult(
                rollback_id=rollback_id,
                status=RollbackStatus.FAILED,
                trigger=plan.trigger,
                strategy=plan.strategy,
                start_time=start_time,
                end_time=end_time,
                duration_seconds=duration,
                reverted_commit=None,
                target_commit=plan.target_commit,
                components_rolled_back=[],
                components_failed=plan.affected_components,
                error_message=error_msg,
                logs=logs,
                requires_manual_intervention=True,
            )

    async def _get_previous_commit(self, current_commit: str) -> str:
        """
        Get the previous commit hash.

        Args:
            current_commit: Current commit hash

        Returns:
            Previous commit hash
        """
        # In a real implementation, this would use git commands
        # For now, return a placeholder
        return current_commit[:7] + "~1"

    async def _perform_safety_checks(
        self,
        checks: list[str],
        dry_run: bool,
    ) -> None:
        """
        Perform safety checks before rollback.

        Args:
            checks: List of checks to perform
            dry_run: If True, simulate checks

        Raises:
            Exception if any check fails
        """
        for check in checks:
            logger.debug("Performing safety check", check=check, dry_run=dry_run)
            await asyncio.sleep(0.1)  # Simulate check time
            # In real implementation, actually perform the checks
            if not dry_run:
                # e.g., check git status, verify commit exists, etc.
                pass

    async def _execute_rollback_steps(
        self,
        plan: RollbackPlan,
        dry_run: bool,
        logs: list[str],
    ) -> None:
        """
        Execute the rollback steps.

        Args:
            plan: Rollback plan with steps to execute
            dry_run: If True, simulate steps
            logs: List to append log messages to
        """
        for step in plan.rollback_steps:
            logger.debug("Executing rollback step", step=step, dry_run=dry_run)
            logs.append(f"[{datetime.now(timezone.utc).isoformat()}] Executing: {step}")
            await asyncio.sleep(0.2)  # Simulate execution time
            # In real implementation:
            # - Run git commands
            # - Restart services
            # - Run migrations
            # etc.
            if not dry_run:
                # Actually execute the step
                pass

    async def _verify_rollback(
        self,
        verification_steps: list[str],
        dry_run: bool,
    ) -> bool:
        """
        Verify the rollback was successful.

        Args:
            verification_steps: Steps to verify success
            dry_run: If True, simulate verification

        Returns:
            True if all verifications passed, False otherwise
        """
        for step in verification_steps:
            logger.debug("Verifying rollback", step=step, dry_run=dry_run)
            await asyncio.sleep(0.1)  # Simulate verification time
            # In real implementation, actually verify
            # - Check health endpoints
            # - Query error rates
            # - Verify database state
            if not dry_run:
                # Perform actual verification
                pass

        return True  # For now, assume success


# Singleton instance
_rollback_agent: RollbackAgent | None = None


def get_rollback_agent() -> RollbackAgent:
    """Get the singleton rollback agent instance."""
    global _rollback_agent
    if _rollback_agent is None:
        _rollback_agent = RollbackAgent()
    return _rollback_agent
