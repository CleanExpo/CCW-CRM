"""
Autonomy Configuration System.

Manages configuration for autonomous development capabilities including:
- Autonomy levels (what can be auto-merged)
- Protected files (never auto-merge)
- Rate limiting
- Circuit breaker thresholds

Part of Phase 5 (Autonomous Development Framework) - Week 3 implementation.
"""

import os
from dataclasses import dataclass, field
from enum import Enum

import structlog

logger = structlog.get_logger(__name__)


class AutonomyLevel(str, Enum):
    """
    Autonomy levels define what types of changes can be auto-merged.

    Levels progress from most restrictive to most permissive:
    - NONE: Shadow mode, all PRs require human approval
    - DOCUMENTATION: Auto-merge documentation changes only (*.md files)
    - TESTS: Auto-merge docs + test additions
    - LOW_RISK: Auto-merge docs + tests + UI components (no business logic)
    - FULL: Auto-merge any LOW risk change
    """

    NONE = "none"  # Shadow mode - no auto-merge
    DOCUMENTATION = "documentation"  # Auto-merge docs only
    TESTS = "tests"  # Auto-merge docs + tests
    LOW_RISK = "low_risk"  # Auto-merge docs + tests + UI
    FULL = "full"  # Auto-merge any LOW risk change


@dataclass
class FilePattern:
    """File pattern for matching files."""

    pattern: str  # Glob pattern (e.g., "*.md", "docs/**", "tests/test_*.py")
    description: str  # Human-readable description
    require_tests: bool = True  # Whether tests are required for this pattern


@dataclass
class AutonomyRules:
    """
    Rules for auto-merge eligibility by autonomy level.

    Each level defines what file patterns can be auto-merged.
    """

    level: AutonomyLevel
    auto_merge_patterns: list[FilePattern] = field(default_factory=list)
    description: str = ""

    def matches_pattern(self, file_path: str) -> FilePattern | None:
        """
        Check if a file matches any auto-merge pattern.

        Args:
            file_path: File path to check

        Returns:
            Matching FilePattern if found, None otherwise
        """
        from pathlib import PurePosixPath

        # Normalize path to use forward slashes (POSIX style)
        normalized_path = file_path.replace("\\", "/")
        path_obj = PurePosixPath(normalized_path)

        for pattern_obj in self.auto_merge_patterns:
            # PurePosixPath.match() handles ** globstar patterns correctly
            if path_obj.match(pattern_obj.pattern):
                return pattern_obj
        return None

    def can_auto_merge_files(self, changed_files: list[str]) -> tuple[bool, str]:
        """
        Check if all changed files can be auto-merged under this level.

        Args:
            changed_files: List of file paths

        Returns:
            (can_merge, reason) tuple
        """
        if not changed_files:
            return False, "No files changed"

        for file_path in changed_files:
            if not self.matches_pattern(file_path):
                return False, f"File not eligible for auto-merge at {self.level.value} level: {file_path}"

        return True, f"All files eligible for auto-merge at {self.level.value} level"


# ============================================================
# DEFAULT AUTONOMY RULES BY LEVEL
# ============================================================

AUTONOMY_RULES_BY_LEVEL = {
    AutonomyLevel.NONE: AutonomyRules(
        level=AutonomyLevel.NONE,
        auto_merge_patterns=[],
        description="Shadow mode - all PRs require human approval",
    ),
    AutonomyLevel.DOCUMENTATION: AutonomyRules(
        level=AutonomyLevel.DOCUMENTATION,
        auto_merge_patterns=[
            FilePattern(
                pattern="*.md",
                description="Markdown documentation files",
                require_tests=False,
            ),
            FilePattern(
                pattern="docs/*.md",
                description="Documentation in docs folder",
                require_tests=False,
            ),
            FilePattern(
                pattern="docs/**/*.md",
                description="Documentation in docs subdirectories",
                require_tests=False,
            ),
            FilePattern(
                pattern="*.txt",
                description="Text files (README, LICENSE, etc.)",
                require_tests=False,
            ),
            FilePattern(
                pattern="docs/*.txt",
                description="Text files in docs folder",
                require_tests=False,
            ),
            FilePattern(
                pattern="docs/**/*.txt",
                description="Text files in docs subdirectories",
                require_tests=False,
            ),
        ],
        description="Auto-merge documentation changes only",
    ),
    AutonomyLevel.TESTS: AutonomyRules(
        level=AutonomyLevel.TESTS,
        auto_merge_patterns=[
            # Documentation patterns
            FilePattern(
                pattern="*.md",
                description="Markdown documentation files",
                require_tests=False,
            ),
            FilePattern(
                pattern="docs/*.md",
                description="Documentation in docs folder",
                require_tests=False,
            ),
            FilePattern(
                pattern="docs/**/*.md",
                description="Documentation in docs subdirectories",
                require_tests=False,
            ),
            # Test patterns
            FilePattern(
                pattern="tests/test_*.py",
                description="Test files",
                require_tests=False,  # Tests don't need tests
            ),
            FilePattern(
                pattern="tests/**/test_*.py",
                description="Test files in subdirectories",
                require_tests=False,
            ),
            FilePattern(
                pattern="tests/fixtures/*.py",
                description="Test fixtures",
                require_tests=False,
            ),
            FilePattern(
                pattern="__tests__/*.test.tsx",
                description="Frontend test files",
                require_tests=False,
            ),
            FilePattern(
                pattern="__tests__/**/*.test.tsx",
                description="Frontend test files in subdirs",
                require_tests=False,
            ),
            FilePattern(
                pattern="__tests__/*.test.ts",
                description="Frontend test files",
                require_tests=False,
            ),
            FilePattern(
                pattern="__tests__/**/*.test.ts",
                description="Frontend test files in subdirs",
                require_tests=False,
            ),
        ],
        description="Auto-merge documentation and test additions",
    ),
    AutonomyLevel.LOW_RISK: AutonomyRules(
        level=AutonomyLevel.LOW_RISK,
        auto_merge_patterns=[
            # All TESTS patterns
            FilePattern(pattern="*.md", description="Documentation", require_tests=False),
            FilePattern(pattern="docs/*.md", description="Documentation", require_tests=False),
            FilePattern(pattern="docs/**/*.md", description="Documentation subdirs", require_tests=False),
            FilePattern(pattern="tests/test_*.py", description="Tests", require_tests=False),
            FilePattern(pattern="tests/**/test_*.py", description="Tests subdirs", require_tests=False),
            FilePattern(pattern="__tests__/*.test.tsx", description="Tests", require_tests=False),
            FilePattern(pattern="__tests__/**/*.test.tsx", description="Tests subdirs", require_tests=False),
            # UI component patterns (require tests)
            FilePattern(
                pattern="apps/web/components/*.tsx",
                description="React UI components",
                require_tests=True,
            ),
            FilePattern(
                pattern="apps/web/components/**/*.tsx",
                description="React UI components (nested)",
                require_tests=True,
            ),
            FilePattern(
                pattern="apps/web/app/**/components/*.tsx",
                description="Page components",
                require_tests=True,
            ),
            FilePattern(
                pattern="apps/web/app/**/components/**/*.tsx",
                description="Page components (nested)",
                require_tests=True,
            ),
            # Static assets
            FilePattern(
                pattern="public/*",
                description="Static assets",
                require_tests=False,
            ),
            FilePattern(
                pattern="public/**/*",
                description="Static assets (nested)",
                require_tests=False,
            ),
            FilePattern(
                pattern="assets/*",
                description="Assets",
                require_tests=False,
            ),
            FilePattern(
                pattern="assets/**/*",
                description="Assets (nested)",
                require_tests=False,
            ),
        ],
        description="Auto-merge docs, tests, and UI components (no business logic)",
    ),
    AutonomyLevel.FULL: AutonomyRules(
        level=AutonomyLevel.FULL,
        auto_merge_patterns=[
            # At FULL level, rely on RiskAssessor to determine eligibility
            # Any file can be auto-merged if risk level is LOW
            FilePattern(
                pattern="**/*",
                description="Any file (if risk level is LOW)",
                require_tests=True,
            ),
        ],
        description="Auto-merge any LOW risk change",
    ),
}


# ============================================================
# PROTECTED FILES (NEVER AUTO-MERGE)
# ============================================================

PROTECTED_FILES = [
    # Authentication & Security
    "apps/web/middleware.ts",
    "apps/backend/src/api/routes/demo_auth.py",
    "apps/backend/src/api/routes/auth.py",
    "apps/backend/src/services/auth_service.py",
    "**/auth/**",
    "**/security/**",
    # Database Schema
    "apps/backend/src/db/demo_models.py",
    "apps/backend/src/db/models.py",
    "apps/backend/migrations/**",
    "**/alembic/**",
    # Billing & Payments
    "apps/backend/src/services/billing.py",
    "apps/backend/src/services/payment_service.py",
    "apps/backend/src/api/routes/billing.py",
    "**/billing/**",
    "**/payments/**",
    # Core Configuration
    "apps/backend/src/config/settings.py",
    "apps/backend/src/config/database.py",
    ".env",
    ".env.production",
    "docker-compose.yml",
    "docker-compose.production.yml",
    # CI/CD & Deployment
    ".github/workflows/**",
    "Dockerfile",
    "Dockerfile.production",
    # Package Management
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "requirements.txt",
    "pyproject.toml",
]


@dataclass
class AutonomyConfig:
    """
    Complete autonomy configuration.

    Controls all aspects of autonomous development behavior.
    """

    # Autonomy Level
    enabled: bool = False  # Master switch
    level: AutonomyLevel = AutonomyLevel.NONE
    rules: AutonomyRules = field(default_factory=lambda: AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.NONE])

    # Rate Limiting
    max_prs_per_hour: int = 5
    cooldown_seconds: int = 60

    # Circuit Breaker
    circuit_breaker_threshold: float = 0.05  # 5% error rate
    circuit_breaker_timeout_seconds: int = 300  # 5 minutes

    # Protected Files
    protected_files: list[str] = field(default_factory=lambda: PROTECTED_FILES.copy())

    # Monitoring & Alerting
    alert_on_revert: bool = True
    alert_on_circuit_open: bool = True
    alert_on_protected_file_violation: bool = True

    def is_protected_file(self, file_path: str) -> bool:
        """
        Check if a file is protected (cannot be auto-merged).

        Args:
            file_path: File path to check

        Returns:
            True if file is protected
        """
        from pathlib import PurePosixPath

        # Normalize path to use forward slashes (POSIX style)
        normalized_path = file_path.replace("\\", "/")
        path_obj = PurePosixPath(normalized_path)

        for pattern in self.protected_files:
            # PurePosixPath.match() handles ** globstar patterns correctly
            if path_obj.match(pattern):
                return True
        return False

    def can_auto_merge(self, changed_files: list[str]) -> tuple[bool, str]:
        """
        Determine if files can be auto-merged based on current config.

        Args:
            changed_files: List of file paths

        Returns:
            (can_merge, reason) tuple
        """
        # Master switch
        if not self.enabled:
            return False, "Autonomy is disabled"

        # Check for protected files
        protected = [f for f in changed_files if self.is_protected_file(f)]
        if protected:
            return False, f"Protected files cannot be auto-merged: {', '.join(protected)}"

        # Check autonomy level rules
        can_merge, reason = self.rules.can_auto_merge_files(changed_files)
        return can_merge, reason

    @staticmethod
    def from_env() -> "AutonomyConfig":
        """
        Load autonomy configuration from environment variables.

        Environment Variables:
        - AGENT_AUTONOMY_ENABLED: Enable/disable autonomy (default: false)
        - AGENT_AUTONOMY_LEVEL: Autonomy level (none/documentation/tests/low_risk/full)
        - AGENT_MAX_PRS_PER_HOUR: Max auto-merges per hour (default: 5)
        - AGENT_COOLDOWN_SECONDS: Cooldown between merges (default: 60)
        - AGENT_CIRCUIT_BREAKER_THRESHOLD: Error rate threshold (default: 0.05)
        - AGENT_CIRCUIT_BREAKER_TIMEOUT: Circuit breaker timeout (default: 300)

        Returns:
            AutonomyConfig loaded from environment
        """
        enabled = os.getenv("AGENT_AUTONOMY_ENABLED", "false").lower() == "true"
        level_str = os.getenv("AGENT_AUTONOMY_LEVEL", "none").lower()

        try:
            level = AutonomyLevel(level_str)
        except ValueError:
            logger.warning(
                "Invalid AGENT_AUTONOMY_LEVEL, defaulting to NONE",
                provided=level_str,
                valid_values=[l.value for l in AutonomyLevel],
            )
            level = AutonomyLevel.NONE

        rules = AUTONOMY_RULES_BY_LEVEL[level]

        config = AutonomyConfig(
            enabled=enabled,
            level=level,
            rules=rules,
            max_prs_per_hour=int(os.getenv("AGENT_MAX_PRS_PER_HOUR", "5")),
            cooldown_seconds=int(os.getenv("AGENT_COOLDOWN_SECONDS", "60")),
            circuit_breaker_threshold=float(os.getenv("AGENT_CIRCUIT_BREAKER_THRESHOLD", "0.05")),
            circuit_breaker_timeout_seconds=int(os.getenv("AGENT_CIRCUIT_BREAKER_TIMEOUT", "300")),
        )

        logger.info(
            "Autonomy configuration loaded",
            enabled=config.enabled,
            level=config.level.value,
            max_prs_per_hour=config.max_prs_per_hour,
            protected_files_count=len(config.protected_files),
        )

        return config


# ============================================================
# SINGLETON INSTANCE
# ============================================================

_autonomy_config: AutonomyConfig | None = None


def get_autonomy_config() -> AutonomyConfig:
    """
    Get the autonomy configuration singleton.

    Returns:
        AutonomyConfig instance
    """
    global _autonomy_config
    if _autonomy_config is None:
        _autonomy_config = AutonomyConfig.from_env()
    return _autonomy_config


def reload_autonomy_config() -> AutonomyConfig:
    """
    Reload autonomy configuration from environment.

    Useful for testing or dynamic config changes.

    Returns:
        Fresh AutonomyConfig instance
    """
    global _autonomy_config
    _autonomy_config = AutonomyConfig.from_env()
    return _autonomy_config
