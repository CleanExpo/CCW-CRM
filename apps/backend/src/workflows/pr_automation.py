"""
Pull Request Automation Workflow.

Handles automated PR creation, review, and merging with risk-based approval.
Part of Phase 5 (Autonomous Development Framework) - Week 3 implementation.
"""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any

import structlog

from src.ai.agents.risk_assessor import RiskAssessor, RiskLevel, ApprovalPolicy
from src.services.circuit_breaker import CircuitBreakerManager, CircuitBreakerException
from src.monitoring.metrics import (
    auto_merges_attempted,
    auto_merges_successful,
    auto_merge_rejections,
    protected_file_violations,
)

logger = structlog.get_logger(__name__)


class AutoMergeDecision(str, Enum):
    """Decision on whether to auto-merge a PR."""

    APPROVED = "approved"  # Auto-merge approved
    MANUAL_REVIEW = "manual_review"  # Requires human review
    BLOCKED = "blocked"  # Blocked due to safety checks
    RATE_LIMITED = "rate_limited"  # Blocked by rate limit
    CIRCUIT_OPEN = "circuit_open"  # Circuit breaker is open


class PROutcome(str, Enum):
    """Outcome of a PR after merging."""

    MERGED = "merged"  # Successfully merged
    PENDING = "pending"  # Awaiting approval/merge
    REJECTED = "rejected"  # Rejected (not merged)
    REVERTED = "reverted"  # Merged but later reverted
    FAILED = "failed"  # Merge failed (conflicts, errors)


@dataclass
class PRContext:
    """Context for a pull request."""

    pr_number: int
    branch: str
    title: str
    description: str
    changed_files: list[str]
    total_additions: int
    total_deletions: int
    tests_passed: bool
    has_conflicts: bool
    created_at: datetime
    author: str


@dataclass
class AutoMergeResult:
    """Result of auto-merge decision."""

    decision: AutoMergeDecision
    risk_level: RiskLevel
    risk_score: float
    approval_policy: ApprovalPolicy
    reasoning: str
    safety_checks: dict[str, bool] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class PRLifecycleEvent:
    """Event in the PR lifecycle."""

    pr_number: int
    event_type: str  # created, reviewed, merged, reverted
    timestamp: datetime
    data: dict[str, Any]


class PRAutomationWorkflow:
    """
    Automated PR workflow with risk-based auto-merge.

    Features:
    - Automatic PR creation from code changes
    - Risk assessment for auto-merge eligibility
    - Safety checks (tests, conflicts, protected files)
    - Rate limiting and circuit breaker protection
    - Audit logging for all decisions
    - Rollback on production errors

    Configuration via environment variables:
    - AGENT_AUTONOMY_ENABLED: Enable/disable autonomy (default: false)
    - AGENT_AUTONOMY_LEVEL: Autonomy level (none/documentation/tests/low_risk/full)
    - AGENT_MAX_PRS_PER_HOUR: Max auto-merges per hour (default: 5)
    - AGENT_CIRCUIT_BREAKER_THRESHOLD: Error rate to pause autonomy (default: 0.05)
    """

    def __init__(
        self,
        risk_assessor: RiskAssessor,
        circuit_breaker_manager: CircuitBreakerManager,
        max_prs_per_hour: int = 5,
        cooldown_seconds: int = 60,
    ):
        """
        Initialize PR automation workflow.

        Args:
            risk_assessor: Risk assessment service
            circuit_breaker_manager: Circuit breaker for safety
            max_prs_per_hour: Maximum auto-merges per hour
            cooldown_seconds: Minimum seconds between auto-merges
        """
        self.risk_assessor = risk_assessor
        self.circuit_breaker = circuit_breaker_manager
        self.max_prs_per_hour = max_prs_per_hour
        self.cooldown_seconds = cooldown_seconds

        # Track recent auto-merges for rate limiting
        self.recent_merges: list[datetime] = []
        self.last_merge_time: datetime | None = None

        # Lifecycle event history
        self.lifecycle_events: list[PRLifecycleEvent] = []

        logger.info(
            "PR automation workflow initialized",
            max_prs_per_hour=max_prs_per_hour,
            cooldown_seconds=cooldown_seconds,
        )

    async def create_feature_branch(self, feature_name: str) -> str:
        """
        Create a feature branch for development.

        Args:
            feature_name: Name of the feature (e.g., "add-dark-mode")

        Returns:
            Branch name created
        """
        # Sanitize feature name for branch
        safe_name = feature_name.lower().replace(" ", "-").replace("_", "-")
        branch_name = f"feature/{safe_name}"

        logger.info("Creating feature branch", branch=branch_name)

        # TODO: Integrate with Git API
        # For now, return the branch name (would execute git commands)

        return branch_name

    async def commit_changes(
        self,
        files: list[str],
        message: str,
        author: str = "Agent Bot <agent@ccw-erp.com>",
    ) -> str:
        """
        Commit changes to the current branch.

        Args:
            files: List of file paths to commit
            message: Commit message
            author: Author name and email

        Returns:
            Commit SHA hash
        """
        logger.info(
            "Committing changes",
            file_count=len(files),
            message=message[:50],
        )

        # TODO: Integrate with Git API
        # For now, return a mock commit SHA
        commit_sha = "abc123def456"

        return commit_sha

    async def create_pull_request(
        self,
        branch: str,
        title: str,
        body: str,
        base_branch: str = "main",
    ) -> dict[str, Any]:
        """
        Create a pull request.

        Args:
            branch: Feature branch name
            title: PR title
            body: PR description
            base_branch: Target branch (usually "main")

        Returns:
            PR metadata (number, url, etc.)
        """
        logger.info(
            "Creating pull request",
            branch=branch,
            title=title,
            base=base_branch,
        )

        # TODO: Integrate with GitHub API
        # For now, return mock PR data
        pr_data = {
            "number": 123,
            "url": f"https://github.com/org/repo/pull/123",
            "state": "open",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Record lifecycle event
        self._record_event(
            pr_number=pr_data["number"],
            event_type="created",
            data={"branch": branch, "title": title},
        )

        return pr_data

    async def evaluate_auto_merge(self, pr_context: PRContext) -> AutoMergeResult:
        """
        Evaluate whether a PR should be auto-merged.

        Args:
            pr_context: Pull request context

        Returns:
            Auto-merge decision with reasoning
        """
        logger.info(
            "Evaluating auto-merge eligibility",
            pr_number=pr_context.pr_number,
            changed_files=len(pr_context.changed_files),
        )

        # Track attempt
        auto_merges_attempted.labels(
            risk_level="unknown"  # Will update after risk assessment
        ).inc()

        # Safety Check 1: Circuit Breaker
        breaker = self.circuit_breaker.get_breaker("pr-automation")
        if not breaker.is_available():
            logger.warning(
                "Circuit breaker open, blocking auto-merge",
                pr_number=pr_context.pr_number,
                breaker_state=breaker.get_state().value,
            )
            return AutoMergeResult(
                decision=AutoMergeDecision.CIRCUIT_OPEN,
                risk_level=RiskLevel.HIGH,
                risk_score=1.0,
                approval_policy=ApprovalPolicy.SECURITY_AUDIT,
                reasoning=f"Circuit breaker is {breaker.get_state().value} due to recent failures",
                safety_checks={"circuit_breaker": False},
            )

        # Safety Check 2: Tests Must Pass
        if not pr_context.tests_passed:
            logger.warning(
                "Tests failed, blocking auto-merge",
                pr_number=pr_context.pr_number,
            )
            auto_merge_rejections.labels(reason="tests_failed").inc()
            return AutoMergeResult(
                decision=AutoMergeDecision.BLOCKED,
                risk_level=RiskLevel.HIGH,
                risk_score=1.0,
                approval_policy=ApprovalPolicy.TWO_REVIEWERS,
                reasoning="Tests must pass before auto-merge",
                safety_checks={"tests_passed": False},
            )

        # Safety Check 3: No Merge Conflicts
        if pr_context.has_conflicts:
            logger.warning(
                "Merge conflicts detected, blocking auto-merge",
                pr_number=pr_context.pr_number,
            )
            auto_merge_rejections.labels(reason="merge_conflicts").inc()
            return AutoMergeResult(
                decision=AutoMergeDecision.BLOCKED,
                risk_level=RiskLevel.HIGH,
                risk_score=1.0,
                approval_policy=ApprovalPolicy.TWO_REVIEWERS,
                reasoning="Merge conflicts must be resolved manually",
                safety_checks={"no_conflicts": False},
            )

        # Safety Check 4: Rate Limiting
        if not await self._check_rate_limit():
            logger.warning(
                "Rate limit exceeded, queueing for later",
                pr_number=pr_context.pr_number,
                recent_merges=len(self.recent_merges),
            )
            auto_merge_rejections.labels(reason="rate_limited").inc()
            return AutoMergeResult(
                decision=AutoMergeDecision.RATE_LIMITED,
                risk_level=RiskLevel.LOW,
                risk_score=0.0,
                approval_policy=ApprovalPolicy.AUTO_MERGE,
                reasoning=f"Rate limit exceeded ({len(self.recent_merges)} PRs in last hour)",
                safety_checks={"rate_limit": False},
            )

        # Risk Assessment
        risk_result = self.risk_assessor.assess_change_risk(
            changed_files=pr_context.changed_files,
            lines_added=pr_context.total_additions,
            lines_removed=pr_context.total_deletions,
            tests_passed=pr_context.tests_passed,
        )

        # Update metrics with actual risk level
        auto_merges_attempted.labels(risk_level=risk_result.risk_level.value).inc()

        # Safety Check 5: Protected Files
        protected_files = [
            f for f in pr_context.changed_files if self.risk_assessor.is_critical_file(f)
        ]
        if protected_files:
            logger.warning(
                "Protected files modified, blocking auto-merge",
                pr_number=pr_context.pr_number,
                protected_files=protected_files,
            )
            protected_file_violations.inc()
            auto_merge_rejections.labels(reason="protected_files").inc()
            return AutoMergeResult(
                decision=AutoMergeDecision.BLOCKED,
                risk_level=RiskLevel.CRITICAL,
                risk_score=risk_result.risk_score,
                approval_policy=ApprovalPolicy.SECURITY_AUDIT,
                reasoning=f"Protected files cannot be auto-merged: {', '.join(protected_files)}",
                safety_checks={
                    "no_protected_files": False,
                    "protected_files": protected_files,
                },
            )

        # Decision based on approval policy
        if risk_result.approval_policy == ApprovalPolicy.AUTO_MERGE:
            logger.info(
                "Auto-merge approved",
                pr_number=pr_context.pr_number,
                risk_level=risk_result.risk_level.value,
            )
            return AutoMergeResult(
                decision=AutoMergeDecision.APPROVED,
                risk_level=risk_result.risk_level,
                risk_score=risk_result.risk_score,
                approval_policy=risk_result.approval_policy,
                reasoning="; ".join(risk_result.reasons) if risk_result.reasons else "Low risk change approved for auto-merge",
                safety_checks={
                    "tests_passed": True,
                    "no_conflicts": True,
                    "rate_limit": True,
                    "no_protected_files": True,
                    "circuit_breaker": True,
                },
            )
        else:
            # Requires manual review
            logger.info(
                "Manual review required",
                pr_number=pr_context.pr_number,
                risk_level=risk_result.risk_level.value,
                approval_policy=risk_result.approval_policy.value,
            )
            auto_merge_rejections.labels(reason="manual_review_required").inc()
            return AutoMergeResult(
                decision=AutoMergeDecision.MANUAL_REVIEW,
                risk_level=risk_result.risk_level,
                risk_score=risk_result.risk_score,
                approval_policy=risk_result.approval_policy,
                reasoning="; ".join(risk_result.reasons) if risk_result.reasons else "Manual review required based on risk assessment",
                safety_checks={
                    "tests_passed": True,
                    "no_conflicts": True,
                    "rate_limit": True,
                    "no_protected_files": True,
                    "circuit_breaker": True,
                },
            )

    async def merge_pull_request(
        self,
        pr_number: int,
        merge_method: str = "squash",
    ) -> bool:
        """
        Merge a pull request.

        Args:
            pr_number: PR number to merge
            merge_method: Merge strategy (merge, squash, rebase)

        Returns:
            True if merge successful
        """
        logger.info(
            "Merging pull request",
            pr_number=pr_number,
            method=merge_method,
        )

        # TODO: Integrate with GitHub API
        # For now, simulate merge

        # Record merge attempt
        auto_merges_successful.labels(risk_level="unknown").inc()

        # Track merge time for rate limiting
        now = datetime.now(timezone.utc)
        self.recent_merges.append(now)
        self.last_merge_time = now

        # Record lifecycle event
        self._record_event(
            pr_number=pr_number,
            event_type="merged",
            data={"method": merge_method, "timestamp": now.isoformat()},
        )

        return True

    async def _check_rate_limit(self) -> bool:
        """
        Check if rate limit allows another auto-merge.

        Returns:
            True if within rate limit
        """
        now = datetime.now(timezone.utc)

        # Remove merges older than 1 hour
        self.recent_merges = [
            merge_time
            for merge_time in self.recent_merges
            if (now - merge_time).total_seconds() < 3600
        ]

        # Check cooldown period
        if self.last_merge_time:
            time_since_last = (now - self.last_merge_time).total_seconds()
            if time_since_last < self.cooldown_seconds:
                logger.debug(
                    "Cooldown period not elapsed",
                    time_since_last=time_since_last,
                    cooldown_required=self.cooldown_seconds,
                )
                return False

        # Check hourly limit
        if len(self.recent_merges) >= self.max_prs_per_hour:
            logger.warning(
                "Rate limit exceeded",
                recent_merges=len(self.recent_merges),
                max_per_hour=self.max_prs_per_hour,
            )
            return False

        return True

    def _record_event(self, pr_number: int, event_type: str, data: dict[str, Any]) -> None:
        """Record a lifecycle event."""
        event = PRLifecycleEvent(
            pr_number=pr_number,
            event_type=event_type,
            timestamp=datetime.now(timezone.utc),
            data=data,
        )
        self.lifecycle_events.append(event)

    async def get_pr_outcome(self, pr_number: int) -> PROutcome:
        """
        Get the outcome of a PR (for monitoring).

        Args:
            pr_number: PR number

        Returns:
            PR outcome status
        """
        # TODO: Check GitHub API for PR status
        # For now, return pending (would check merge status, revert status, etc.)
        return PROutcome.PENDING


def create_pr_workflow(
    max_prs_per_hour: int = 5,
    cooldown_seconds: int = 60,
) -> PRAutomationWorkflow:
    """
    Factory function to create PR automation workflow.

    Args:
        max_prs_per_hour: Maximum auto-merges per hour (default: 5)
        cooldown_seconds: Minimum seconds between merges (default: 60)

    Returns:
        Configured PRAutomationWorkflow instance
    """
    from src.ai.agents.risk_assessor import get_risk_assessor
    from src.services.circuit_breaker import CircuitBreakerManager

    risk_assessor = get_risk_assessor()
    circuit_breaker_manager = CircuitBreakerManager()

    return PRAutomationWorkflow(
        risk_assessor=risk_assessor,
        circuit_breaker_manager=circuit_breaker_manager,
        max_prs_per_hour=max_prs_per_hour,
        cooldown_seconds=cooldown_seconds,
    )
