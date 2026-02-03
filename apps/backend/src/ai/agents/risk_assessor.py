"""
Risk Assessment Agent for Autonomous Development.

Assesses the risk level of code changes to determine appropriate approval requirements.
Part of Phase 5 (Autonomous Development Framework) - Week 1 implementation.
"""

from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


class RiskLevel(str, Enum):
    """Risk level classification for code changes."""

    LOW = "low"  # Auto-merge
    MEDIUM = "medium"  # 1 reviewer required
    HIGH = "high"  # 2 reviewers required
    CRITICAL = "critical"  # Manual security audit required


class ApprovalPolicy(str, Enum):
    """Approval policy based on risk level."""

    AUTO_MERGE = "auto_merge"  # No approval needed
    ONE_REVIEWER = "one_reviewer"  # 1 human reviewer
    TWO_REVIEWERS = "two_reviewers"  # 2 human reviewers
    SECURITY_AUDIT = "security_audit"  # Manual security audit + reviewers


@dataclass
class RiskAssessment:
    """Risk assessment result for a code change."""

    risk_level: RiskLevel
    approval_policy: ApprovalPolicy
    risk_score: float  # 0.0-1.0
    reasons: list[str]  # Why this risk level
    critical_files: list[str]  # Protected files affected
    lines_changed: int
    files_changed: int
    tests_passing: bool
    auto_merge_allowed: bool


class RiskAssessor:
    """
    Assesses risk level of code changes for autonomous development.

    Risk Categories:
    - LOW: Documentation, comments, UI text (<100 LOC, no critical files)
    - MEDIUM: Features, refactoring (<500 LOC, some critical files)
    - HIGH: Database schema, APIs (>500 LOC, critical files)
    - CRITICAL: Auth, billing, security (any size, protected files)
    """

    # Protected files that require manual review
    PROTECTED_FILES = [
        # Authentication
        "**/middleware.ts",
        "**/demo_auth.py",
        "**/auth.py",
        "**/auth/**",
        # Billing & Payments
        "**/billing.py",
        "**/billing/**",
        "**/stripe/**",
        "**/payment/**",
        # Database Schema
        "**/demo_models.py",
        "**/models_base.py",
        "**/alembic/versions/**",
        "**/migrations/**",
        # Security
        "**/security.py",
        "**/security/**",
        "**/config/settings.py",
        "**/config/secrets.py",
        # Core Infrastructure
        "**/main.py",  # FastAPI main application
        "**/database.py",  # Database configuration
    ]

    # Files that are safe for auto-merge (LOW risk)
    SAFE_FILES = [
        # Documentation
        "**/*.md",
        "**/README*",
        "**/CHANGELOG*",
        "**/docs/**",
        # Comments (detected in diff, not file patterns)
        # Tests (safe to auto-merge new tests)
        "**/tests/**",
        "**/test_*.py",
        "**/*_test.py",
        "**/e2e/**",
        # UI Assets
        "**/public/**",
        "**/assets/**",
        "**/*.svg",
        "**/*.png",
        "**/*.jpg",
        "**/*.css",  # Stylesheets (unless critical)
    ]

    # Risk thresholds
    MAX_LINES_LOW = 100  # <100 LOC = LOW risk
    MAX_LINES_MEDIUM = 500  # <500 LOC = MEDIUM risk
    MAX_FILES_LOW = 5  # <5 files = lower risk
    MAX_FILES_MEDIUM = 15  # <15 files = medium risk

    def __init__(self):
        """Initialize the risk assessor."""
        self.name = "RiskAssessor"
        logger.info("Risk assessor initialized")

    def assess_change_risk(
        self,
        changed_files: list[str],
        diff: str | None = None,
        lines_added: int = 0,
        lines_removed: int = 0,
        tests_passed: bool = True,
        commit_message: str = "",
    ) -> RiskAssessment:
        """
        Assess the risk level of a code change.

        Args:
            changed_files: List of file paths that were modified
            diff: The full diff content (optional, for deeper analysis)
            lines_added: Number of lines added
            lines_removed: Number of lines removed
            tests_passed: Whether all tests passed
            commit_message: Commit message for context

        Returns:
            RiskAssessment with risk level and approval requirements
        """
        reasons = []
        critical_files = []
        lines_changed = lines_added + lines_removed
        files_changed = len(changed_files)

        # 1. Check for critical/protected files
        for file_path in changed_files:
            if self.is_critical_file(file_path):
                critical_files.append(file_path)
                reasons.append(f"Protected file modified: {file_path}")

        # If any critical files touched → CRITICAL risk
        if critical_files:
            logger.warning(
                "Critical files detected in change",
                critical_files=critical_files,
                total_files=files_changed,
            )
            return RiskAssessment(
                risk_level=RiskLevel.CRITICAL,
                approval_policy=ApprovalPolicy.SECURITY_AUDIT,
                risk_score=1.0,
                reasons=reasons or ["Critical files require security audit"],
                critical_files=critical_files,
                lines_changed=lines_changed,
                files_changed=files_changed,
                tests_passing=tests_passed,
                auto_merge_allowed=False,
            )

        # 2. Check if all files are safe for auto-merge
        all_safe = all(self.is_safe_file(f) for f in changed_files)
        if all_safe and lines_changed < self.MAX_LINES_LOW and tests_passed:
            reasons.append("Only safe files modified (docs, tests, assets)")
            reasons.append(f"Small change ({lines_changed} LOC)")
            if tests_passed:
                reasons.append("All tests passing")

            logger.info(
                "Low risk change detected",
                files=files_changed,
                lines=lines_changed,
                safe_files=changed_files,
            )
            return RiskAssessment(
                risk_level=RiskLevel.LOW,
                approval_policy=ApprovalPolicy.AUTO_MERGE,
                risk_score=0.1,
                reasons=reasons,
                critical_files=[],
                lines_changed=lines_changed,
                files_changed=files_changed,
                tests_passing=tests_passed,
                auto_merge_allowed=True,
            )

        # 3. Tests failing → HIGH risk (regardless of size)
        if not tests_passed:
            reasons.append("Tests failing - requires investigation")
            risk_score = min(0.8, 0.5 + (lines_changed / 1000) * 0.3)
            return RiskAssessment(
                risk_level=RiskLevel.HIGH,
                approval_policy=ApprovalPolicy.TWO_REVIEWERS,
                risk_score=risk_score,
                reasons=reasons,
                critical_files=[],
                lines_changed=lines_changed,
                files_changed=files_changed,
                tests_passing=False,
                auto_merge_allowed=False,
            )

        # 4. Calculate risk based on size and scope
        risk_score = self._calculate_risk_score(
            lines_changed=lines_changed,
            files_changed=files_changed,
            tests_passed=tests_passed,
            has_critical_files=bool(critical_files),
        )

        # 5. Determine risk level from score and size
        if lines_changed < self.MAX_LINES_LOW and files_changed < self.MAX_FILES_LOW:
            risk_level = RiskLevel.LOW
            approval_policy = ApprovalPolicy.ONE_REVIEWER  # Not auto-merge (not safe files)
            reasons.append(f"Small change ({lines_changed} LOC, {files_changed} files)")
        elif lines_changed < self.MAX_LINES_MEDIUM and files_changed < self.MAX_FILES_MEDIUM:
            risk_level = RiskLevel.MEDIUM
            approval_policy = ApprovalPolicy.ONE_REVIEWER
            reasons.append(f"Medium change ({lines_changed} LOC, {files_changed} files)")
        else:
            risk_level = RiskLevel.HIGH
            approval_policy = ApprovalPolicy.TWO_REVIEWERS
            reasons.append(f"Large change ({lines_changed} LOC, {files_changed} files)")

        if tests_passed:
            reasons.append("All tests passing")

        logger.info(
            "Risk assessment complete",
            risk_level=risk_level.value,
            risk_score=risk_score,
            lines_changed=lines_changed,
            files_changed=files_changed,
        )

        return RiskAssessment(
            risk_level=risk_level,
            approval_policy=approval_policy,
            risk_score=risk_score,
            reasons=reasons,
            critical_files=critical_files,
            lines_changed=lines_changed,
            files_changed=files_changed,
            tests_passing=tests_passed,
            auto_merge_allowed=False,
        )

    def is_critical_file(self, file_path: str) -> bool:
        """
        Check if a file is critical/protected and requires manual review.

        Args:
            file_path: Path to the file

        Returns:
            True if file is critical, False otherwise
        """
        import fnmatch

        # Normalize path to use forward slashes
        normalized_path = file_path.replace("\\", "/")

        for pattern in self.PROTECTED_FILES:
            # Remove ** from pattern for fnmatch compatibility
            pattern_normalized = pattern.replace("**/", "*/")
            if fnmatch.fnmatch(normalized_path, pattern_normalized):
                return True
            # Also check if pattern matches any part of the path
            if "**" in pattern:
                simple_pattern = pattern.replace("**/", "")
                if simple_pattern in normalized_path:
                    return True

        return False

    def is_safe_file(self, file_path: str) -> bool:
        """
        Check if a file is safe for auto-merge (documentation, tests, assets).

        Args:
            file_path: Path to the file

        Returns:
            True if file is safe for auto-merge, False otherwise
        """
        import fnmatch

        # Normalize path to use forward slashes
        normalized_path = file_path.replace("\\", "/")

        for pattern in self.SAFE_FILES:
            # Check if file extension matches
            if pattern.startswith("**/"):
                suffix_pattern = pattern[3:]  # Remove **/ prefix
                if fnmatch.fnmatch(normalized_path, f"*{suffix_pattern}"):
                    return True
            elif fnmatch.fnmatch(normalized_path, pattern):
                return True
            # Check if path contains the pattern
            if "**" in pattern:
                simple_pattern = pattern.replace("**/", "").replace("/**", "")
                if simple_pattern in normalized_path:
                    return True

        return False

    def _calculate_risk_score(
        self,
        lines_changed: int,
        files_changed: int,
        tests_passed: bool,
        has_critical_files: bool,
    ) -> float:
        """
        Calculate a numeric risk score from 0.0 (low) to 1.0 (critical).

        Args:
            lines_changed: Total lines added + removed
            files_changed: Number of files modified
            tests_passed: Whether tests passed
            has_critical_files: Whether any critical files were touched

        Returns:
            Risk score between 0.0 and 1.0
        """
        score = 0.0

        # Size factor (max 0.4)
        if lines_changed < self.MAX_LINES_LOW:
            score += 0.1
        elif lines_changed < self.MAX_LINES_MEDIUM:
            score += 0.2
        else:
            score += 0.4

        # Files factor (max 0.2)
        if files_changed < self.MAX_FILES_LOW:
            score += 0.05
        elif files_changed < self.MAX_FILES_MEDIUM:
            score += 0.1
        else:
            score += 0.2

        # Tests factor (max 0.3)
        if not tests_passed:
            score += 0.3
        else:
            score += 0.0

        # Critical files factor (max 0.1 bonus if none)
        if not has_critical_files:
            score += 0.0
        else:
            score += 1.0  # Jump to critical

        return min(1.0, score)

    def determine_approval_requirements(
        self, risk_level: RiskLevel
    ) -> dict[str, Any]:
        """
        Determine approval requirements based on risk level.

        Args:
            risk_level: The assessed risk level

        Returns:
            Dictionary with approval requirements
        """
        if risk_level == RiskLevel.LOW:
            return {
                "policy": ApprovalPolicy.AUTO_MERGE,
                "reviewers_required": 0,
                "auto_merge": True,
                "require_tests": False,
                "require_security_audit": False,
            }
        elif risk_level == RiskLevel.MEDIUM:
            return {
                "policy": ApprovalPolicy.ONE_REVIEWER,
                "reviewers_required": 1,
                "auto_merge": False,
                "require_tests": True,
                "require_security_audit": False,
            }
        elif risk_level == RiskLevel.HIGH:
            return {
                "policy": ApprovalPolicy.TWO_REVIEWERS,
                "reviewers_required": 2,
                "auto_merge": False,
                "require_tests": True,
                "require_security_audit": False,
            }
        else:  # CRITICAL
            return {
                "policy": ApprovalPolicy.SECURITY_AUDIT,
                "reviewers_required": 2,
                "auto_merge": False,
                "require_tests": True,
                "require_security_audit": True,
            }


# Singleton instance
_risk_assessor: RiskAssessor | None = None


def get_risk_assessor() -> RiskAssessor:
    """Get the singleton risk assessor instance."""
    global _risk_assessor
    if _risk_assessor is None:
        _risk_assessor = RiskAssessor()
    return _risk_assessor
