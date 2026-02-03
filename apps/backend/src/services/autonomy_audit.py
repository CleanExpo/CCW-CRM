"""
Autonomy Audit Service.

Provides audit logging and monitoring for autonomous development actions.
Records all autonomous operations for compliance, debugging, and analysis.

Part of Phase 5 (Autonomous Development Framework) - Week 3 implementation.
"""

import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any
from uuid import uuid4

import structlog

from src.config.autonomy import AutonomyLevel

logger = structlog.get_logger(__name__)


class AuditAction(str, Enum):
    """Types of autonomous actions that can be audited."""

    # PR Actions
    PR_CREATED = "pr_created"
    PR_AUTO_MERGED = "pr_auto_merged"
    PR_REJECTED = "pr_rejected"
    PR_REQUIRES_REVIEW = "pr_requires_review"

    # Validation Actions
    RISK_ASSESSMENT = "risk_assessment"
    FILE_VALIDATION = "file_validation"
    TEST_VALIDATION = "test_validation"

    # Circuit Breaker Actions
    CIRCUIT_OPENED = "circuit_opened"
    CIRCUIT_CLOSED = "circuit_closed"
    CIRCUIT_HALF_OPEN = "circuit_half_open"

    # Rate Limiting Actions
    RATE_LIMIT_HIT = "rate_limit_hit"
    COOLDOWN_ACTIVE = "cooldown_active"

    # Violations
    PROTECTED_FILE_VIOLATION = "protected_file_violation"
    AUTONOMY_LEVEL_VIOLATION = "autonomy_level_violation"

    # Reversions
    AUTO_MERGE_REVERTED = "auto_merge_reverted"


class AuditResult(str, Enum):
    """Result of an audited action."""

    SUCCESS = "success"
    FAILURE = "failure"
    BLOCKED = "blocked"
    SKIPPED = "skipped"


@dataclass
class AuditEntry:
    """
    Audit log entry for an autonomous action.

    Immutable record of what happened, when, and why.
    """

    # Identification
    entry_id: str = field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # Action Details
    action: AuditAction = AuditAction.PR_CREATED
    result: AuditResult = AuditResult.SUCCESS

    # Context
    agent_id: str = "unknown"
    task_id: str | None = None
    pr_number: int | None = None
    branch_name: str | None = None

    # Configuration State
    autonomy_level: AutonomyLevel = AutonomyLevel.NONE
    autonomy_enabled: bool = False

    # File Details
    files_changed: list[str] = field(default_factory=list)
    protected_files_detected: list[str] = field(default_factory=list)

    # Risk Assessment
    risk_level: str | None = None  # "LOW", "MEDIUM", "HIGH"
    risk_score: float | None = None

    # Test Results
    tests_passed: bool | None = None
    test_failures: list[str] = field(default_factory=list)

    # Outcome
    auto_merged: bool = False
    reason: str = ""  # Why was this action taken/blocked?

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)
    duration_ms: float | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert audit entry to dictionary for storage/logging."""
        return {
            "entry_id": self.entry_id,
            "timestamp": self.timestamp.isoformat(),
            "action": self.action.value,
            "result": self.result.value,
            "agent_id": self.agent_id,
            "task_id": self.task_id,
            "pr_number": self.pr_number,
            "branch_name": self.branch_name,
            "autonomy_level": self.autonomy_level.value,
            "autonomy_enabled": self.autonomy_enabled,
            "files_changed": self.files_changed,
            "protected_files_detected": self.protected_files_detected,
            "risk_level": self.risk_level,
            "risk_score": self.risk_score,
            "tests_passed": self.tests_passed,
            "test_failures": self.test_failures,
            "auto_merged": self.auto_merged,
            "reason": self.reason,
            "metadata": self.metadata,
            "duration_ms": self.duration_ms,
        }


@dataclass
class AutonomyMetrics:
    """
    Aggregated metrics for autonomous operations.

    Used for monitoring, alerting, and dashboard displays.
    """

    # Time Window
    window_start: datetime
    window_end: datetime

    # Totals
    total_actions: int = 0
    total_prs_created: int = 0
    total_auto_merged: int = 0
    total_rejected: int = 0
    total_blocked: int = 0

    # Success Rates
    auto_merge_success_rate: float = 0.0
    test_pass_rate: float = 0.0

    # Violations
    protected_file_violations: int = 0
    rate_limit_hits: int = 0

    # Circuit Breaker
    circuit_breaker_trips: int = 0

    # Reversions
    auto_merge_reversions: int = 0

    # Risk Distribution
    risk_distribution: dict[str, int] = field(default_factory=dict)  # {"LOW": 10, "MEDIUM": 2, ...}

    # Average Duration
    avg_duration_ms: float = 0.0

    def calculate_error_rate(self) -> float:
        """Calculate error rate (failures + reversions / total actions)."""
        if self.total_actions == 0:
            return 0.0
        errors = self.total_rejected + self.auto_merge_reversions
        return errors / self.total_actions


class AutonomyAuditService:
    """
    Service for audit logging and monitoring of autonomous operations.

    Provides:
    - Audit logging for all autonomous actions
    - Metrics aggregation
    - Query capabilities
    - Alerting on anomalies
    """

    def __init__(self):
        """Initialize audit service with in-memory storage."""
        self._audit_log: list[AuditEntry] = []
        self._max_log_size: int = 10000  # Keep last 10k entries in memory
        self.logger = structlog.get_logger(__name__)

    def log_action(
        self,
        action: AuditAction,
        result: AuditResult,
        agent_id: str = "unknown",
        **kwargs: Any,
    ) -> AuditEntry:
        """
        Log an autonomous action.

        Args:
            action: Type of action performed
            result: Result of the action
            agent_id: ID of the agent that performed the action
            **kwargs: Additional context (pr_number, files_changed, etc.)

        Returns:
            AuditEntry that was logged
        """
        # Create audit entry
        entry = AuditEntry(
            action=action,
            result=result,
            agent_id=agent_id,
            **kwargs,
        )

        # Add to in-memory log
        self._audit_log.append(entry)

        # Trim log if too large
        if len(self._audit_log) > self._max_log_size:
            self._audit_log = self._audit_log[-self._max_log_size :]

        # Structured logging
        self.logger.info(
            "autonomy_action_logged",
            entry_id=entry.entry_id,
            action=entry.action.value,
            result=entry.result.value,
            agent_id=entry.agent_id,
            auto_merged=entry.auto_merged,
            reason=entry.reason,
        )

        return entry

    def log_pr_created(
        self,
        pr_number: int,
        branch_name: str,
        files_changed: list[str],
        agent_id: str,
        **kwargs: Any,
    ) -> AuditEntry:
        """Log PR creation."""
        return self.log_action(
            action=AuditAction.PR_CREATED,
            result=AuditResult.SUCCESS,
            agent_id=agent_id,
            pr_number=pr_number,
            branch_name=branch_name,
            files_changed=files_changed,
            **kwargs,
        )

    def log_auto_merge(
        self,
        pr_number: int,
        files_changed: list[str],
        agent_id: str,
        risk_level: str,
        tests_passed: bool,
        **kwargs: Any,
    ) -> AuditEntry:
        """Log successful auto-merge."""
        return self.log_action(
            action=AuditAction.PR_AUTO_MERGED,
            result=AuditResult.SUCCESS,
            agent_id=agent_id,
            pr_number=pr_number,
            files_changed=files_changed,
            risk_level=risk_level,
            tests_passed=tests_passed,
            auto_merged=True,
            reason="Auto-merged based on autonomy level and risk assessment",
            **kwargs,
        )

    def log_rejection(
        self,
        pr_number: int,
        reason: str,
        files_changed: list[str],
        agent_id: str,
        **kwargs: Any,
    ) -> AuditEntry:
        """Log PR rejection."""
        return self.log_action(
            action=AuditAction.PR_REJECTED,
            result=AuditResult.BLOCKED,
            agent_id=agent_id,
            pr_number=pr_number,
            files_changed=files_changed,
            auto_merged=False,
            reason=reason,
            **kwargs,
        )

    def log_protected_file_violation(
        self,
        files: list[str],
        agent_id: str,
        **kwargs: Any,
    ) -> AuditEntry:
        """Log protected file violation attempt."""
        return self.log_action(
            action=AuditAction.PROTECTED_FILE_VIOLATION,
            result=AuditResult.BLOCKED,
            agent_id=agent_id,
            protected_files_detected=files,
            reason=f"Protected files cannot be auto-merged: {', '.join(files)}",
            **kwargs,
        )

    def log_circuit_breaker_trip(
        self,
        reason: str,
        agent_id: str,
        **kwargs: Any,
    ) -> AuditEntry:
        """Log circuit breaker opening."""
        return self.log_action(
            action=AuditAction.CIRCUIT_OPENED,
            result=AuditResult.SUCCESS,
            agent_id=agent_id,
            reason=reason,
            **kwargs,
        )

    def log_rate_limit_hit(
        self,
        agent_id: str,
        **kwargs: Any,
    ) -> AuditEntry:
        """Log rate limit being hit."""
        return self.log_action(
            action=AuditAction.RATE_LIMIT_HIT,
            result=AuditResult.BLOCKED,
            agent_id=agent_id,
            reason="Rate limit exceeded",
            **kwargs,
        )

    def log_reversion(
        self,
        pr_number: int,
        reason: str,
        agent_id: str,
        **kwargs: Any,
    ) -> AuditEntry:
        """Log auto-merge reversion."""
        return self.log_action(
            action=AuditAction.AUTO_MERGE_REVERTED,
            result=AuditResult.SUCCESS,
            agent_id=agent_id,
            pr_number=pr_number,
            reason=reason,
            **kwargs,
        )

    def get_recent_entries(
        self,
        limit: int = 100,
        action: AuditAction | None = None,
        result: AuditResult | None = None,
    ) -> list[AuditEntry]:
        """
        Get recent audit entries.

        Args:
            limit: Maximum number of entries to return
            action: Filter by action type (optional)
            result: Filter by result type (optional)

        Returns:
            List of audit entries (most recent first)
        """
        entries = self._audit_log

        # Apply filters
        if action:
            entries = [e for e in entries if e.action == action]
        if result:
            entries = [e for e in entries if e.result == result]

        # Sort by timestamp (most recent first) and limit
        return sorted(entries, key=lambda e: e.timestamp, reverse=True)[:limit]

    def get_metrics(
        self,
        window_hours: int = 24,
    ) -> AutonomyMetrics:
        """
        Calculate metrics for a time window.

        Args:
            window_hours: Number of hours to look back

        Returns:
            AutonomyMetrics with aggregated statistics
        """
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(hours=window_hours)

        # Filter entries in window
        entries = [
            e for e in self._audit_log
            if e.timestamp >= window_start
        ]

        # Calculate metrics
        total_actions = len(entries)
        total_prs_created = len([e for e in entries if e.action == AuditAction.PR_CREATED])
        total_auto_merged = len([e for e in entries if e.action == AuditAction.PR_AUTO_MERGED])
        total_rejected = len([e for e in entries if e.action == AuditAction.PR_REJECTED])
        total_blocked = len([e for e in entries if e.result == AuditResult.BLOCKED])

        protected_violations = len(
            [e for e in entries if e.action == AuditAction.PROTECTED_FILE_VIOLATION]
        )
        rate_limit_hits = len([e for e in entries if e.action == AuditAction.RATE_LIMIT_HIT])
        circuit_trips = len([e for e in entries if e.action == AuditAction.CIRCUIT_OPENED])
        reversions = len([e for e in entries if e.action == AuditAction.AUTO_MERGE_REVERTED])

        # Success rates
        auto_merge_success_rate = (
            total_auto_merged / total_prs_created if total_prs_created > 0 else 0.0
        )

        test_results = [e for e in entries if e.tests_passed is not None]
        test_pass_rate = (
            len([e for e in test_results if e.tests_passed]) / len(test_results)
            if test_results
            else 0.0
        )

        # Risk distribution
        risk_distribution: dict[str, int] = {}
        for entry in entries:
            if entry.risk_level:
                risk_distribution[entry.risk_level] = risk_distribution.get(entry.risk_level, 0) + 1

        # Average duration
        durations = [e.duration_ms for e in entries if e.duration_ms is not None]
        avg_duration_ms = sum(durations) / len(durations) if durations else 0.0

        return AutonomyMetrics(
            window_start=window_start,
            window_end=now,
            total_actions=total_actions,
            total_prs_created=total_prs_created,
            total_auto_merged=total_auto_merged,
            total_rejected=total_rejected,
            total_blocked=total_blocked,
            auto_merge_success_rate=auto_merge_success_rate,
            test_pass_rate=test_pass_rate,
            protected_file_violations=protected_violations,
            rate_limit_hits=rate_limit_hits,
            circuit_breaker_trips=circuit_trips,
            auto_merge_reversions=reversions,
            risk_distribution=risk_distribution,
            avg_duration_ms=avg_duration_ms,
        )

    def check_for_anomalies(self, metrics: AutonomyMetrics) -> list[str]:
        """
        Check metrics for anomalies that require attention.

        Args:
            metrics: Metrics to analyze

        Returns:
            List of anomaly descriptions (empty if no anomalies)
        """
        anomalies = []

        # High error rate
        error_rate = metrics.calculate_error_rate()
        if error_rate > 0.1:  # 10% error rate
            anomalies.append(
                f"High error rate: {error_rate:.1%} "
                f"({metrics.total_rejected + metrics.auto_merge_reversions} errors "
                f"out of {metrics.total_actions} actions)"
            )

        # Multiple reversions
        if metrics.auto_merge_reversions > 2:
            anomalies.append(
                f"Multiple auto-merge reversions: {metrics.auto_merge_reversions} in time window"
            )

        # Protected file violations
        if metrics.protected_file_violations > 0:
            anomalies.append(
                f"Protected file violation attempts: {metrics.protected_file_violations}"
            )

        # Circuit breaker trips
        if metrics.circuit_breaker_trips > 0:
            anomalies.append(f"Circuit breaker tripped {metrics.circuit_breaker_trips} times")

        # Low test pass rate
        if metrics.test_pass_rate < 0.9 and metrics.total_auto_merged > 0:
            anomalies.append(f"Low test pass rate: {metrics.test_pass_rate:.1%}")

        return anomalies

    def clear_logs(self) -> None:
        """Clear all audit logs. Use with caution!"""
        self._audit_log.clear()
        self.logger.warning("audit_logs_cleared")


# ============================================================
# SINGLETON INSTANCE
# ============================================================

_audit_service: AutonomyAuditService | None = None


def get_audit_service() -> AutonomyAuditService:
    """
    Get the audit service singleton.

    Returns:
        AutonomyAuditService instance
    """
    global _audit_service
    if _audit_service is None:
        _audit_service = AutonomyAuditService()
    return _audit_service
