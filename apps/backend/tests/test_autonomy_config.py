"""
Test suite for Autonomy Configuration System.

Tests configuration loading, file pattern matching, and autonomy rules.
Part of Phase 5 (Autonomous Development Framework) - Week 3 tests.
"""



from src.config.autonomy import (
    AUTONOMY_RULES_BY_LEVEL,
    AutonomyConfig,
    AutonomyLevel,
    AutonomyRules,
    FilePattern,
    get_autonomy_config,
    reload_autonomy_config,
)

# ============================================================
# FILE PATTERN MATCHING TESTS
# ============================================================


class TestFilePatternMatching:
    """Test file pattern matching logic."""

    def test_markdown_pattern_matches(self):
        """Test markdown file pattern matching."""
        pattern = FilePattern(pattern="*.md", description="Markdown files", require_tests=False)
        rules = AutonomyRules(level=AutonomyLevel.DOCUMENTATION, auto_merge_patterns=[pattern])

        assert rules.matches_pattern("README.md") is not None
        assert rules.matches_pattern("CONTRIBUTING.md") is not None
        # Note: *.md with Path.match() matches any path ending in .md
        assert rules.matches_pattern("docs/API.md") is not None

    def test_docs_folder_pattern(self):
        """Test docs folder pattern matching."""
        # Need separate patterns for docs/*.md and docs/**/*.md
        pattern1 = FilePattern(pattern="docs/*.md", description="Docs folder", require_tests=False)
        pattern2 = FilePattern(pattern="docs/**/*.md", description="Docs subdirs", require_tests=False)
        rules = AutonomyRules(level=AutonomyLevel.DOCUMENTATION, auto_merge_patterns=[pattern1, pattern2])

        assert rules.matches_pattern("docs/README.md") is not None
        assert rules.matches_pattern("docs/guides/INSTALL.md") is not None
        assert rules.matches_pattern("README.md") is None

    def test_test_file_pattern(self):
        """Test test file pattern matching."""
        pattern = FilePattern(pattern="tests/test_*.py", description="Test files", require_tests=False)
        rules = AutonomyRules(level=AutonomyLevel.TESTS, auto_merge_patterns=[pattern])

        assert rules.matches_pattern("tests/test_orders.py") is not None
        assert rules.matches_pattern("tests/test_customers.py") is not None
        assert rules.matches_pattern("tests/fixtures/data.py") is None

    def test_component_pattern(self):
        """Test component pattern matching."""
        # Need separate patterns for direct and nested components
        pattern1 = FilePattern(
            pattern="apps/web/components/*.tsx",
            description="Components",
            require_tests=True,
        )
        pattern2 = FilePattern(
            pattern="apps/web/components/**/*.tsx",
            description="Nested Components",
            require_tests=True,
        )
        rules = AutonomyRules(level=AutonomyLevel.LOW_RISK, auto_merge_patterns=[pattern1, pattern2])

        assert rules.matches_pattern("apps/web/components/Button.tsx") is not None
        assert rules.matches_pattern("apps/web/components/forms/Input.tsx") is not None
        assert rules.matches_pattern("apps/web/app/page.tsx") is None


# ============================================================
# AUTONOMY RULES TESTS
# ============================================================


class TestAutonomyRules:
    """Test autonomy rules evaluation."""

    def test_none_level_blocks_all(self):
        """Test NONE level blocks all auto-merges."""
        rules = AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.NONE]

        can_merge, reason = rules.can_auto_merge_files(["README.md"])
        assert can_merge is False
        assert "not eligible" in reason

        can_merge, reason = rules.can_auto_merge_files(["tests/test_orders.py"])
        assert can_merge is False

    def test_documentation_level_allows_docs(self):
        """Test DOCUMENTATION level allows doc changes."""
        rules = AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.DOCUMENTATION]

        # Should allow
        can_merge, reason = rules.can_auto_merge_files(["README.md"])
        assert can_merge is True

        can_merge, reason = rules.can_auto_merge_files(["docs/INSTALL.md"])
        assert can_merge is True

        # Should block
        can_merge, reason = rules.can_auto_merge_files(["src/api/routes/orders.py"])
        assert can_merge is False
        assert "not eligible" in reason

    def test_tests_level_allows_tests_and_docs(self):
        """Test TESTS level allows tests and docs."""
        rules = AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.TESTS]

        # Docs allowed
        can_merge, reason = rules.can_auto_merge_files(["README.md"])
        assert can_merge is True

        # Tests allowed
        can_merge, reason = rules.can_auto_merge_files(["tests/test_orders.py"])
        assert can_merge is True

        # Code blocked
        can_merge, reason = rules.can_auto_merge_files(["src/api/routes/orders.py"])
        assert can_merge is False

    def test_low_risk_level_allows_ui(self):
        """Test LOW_RISK level allows UI components."""
        rules = AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.LOW_RISK]

        # UI components allowed
        can_merge, reason = rules.can_auto_merge_files(["apps/web/components/Button.tsx"])
        assert can_merge is True

        # But requires proper pattern match
        can_merge, reason = rules.can_auto_merge_files(["apps/backend/src/api/routes/orders.py"])
        assert can_merge is False

    def test_full_level_allows_any_low_risk(self):
        """Test FULL level allows any file (relying on RiskAssessor)."""
        rules = AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.FULL]

        # Any file matches the wildcard pattern
        can_merge, reason = rules.can_auto_merge_files(["src/api/routes/orders.py"])
        assert can_merge is True

        can_merge, reason = rules.can_auto_merge_files(["apps/web/components/Button.tsx"])
        assert can_merge is True

    def test_mixed_files_blocked(self):
        """Test mixed file types are blocked if any doesn't match."""
        rules = AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.DOCUMENTATION]

        # Both docs - allowed
        can_merge, reason = rules.can_auto_merge_files(["README.md", "CONTRIBUTING.md"])
        assert can_merge is True

        # Mix of docs and code - blocked
        can_merge, reason = rules.can_auto_merge_files(["README.md", "src/api/routes/orders.py"])
        assert can_merge is False
        assert "orders.py" in reason


# ============================================================
# PROTECTED FILES TESTS
# ============================================================


class TestProtectedFiles:
    """Test protected file detection."""

    def test_auth_files_protected(self):
        """Test authentication files are protected."""
        config = AutonomyConfig()

        assert config.is_protected_file("apps/web/middleware.ts")
        assert config.is_protected_file("apps/backend/src/api/routes/demo_auth.py")
        assert config.is_protected_file("apps/backend/src/services/auth_service.py")

    def test_database_files_protected(self):
        """Test database schema files are protected."""
        config = AutonomyConfig()

        assert config.is_protected_file("apps/backend/src/db/demo_models.py")
        assert config.is_protected_file("apps/backend/migrations/001_initial.py")

    def test_billing_files_protected(self):
        """Test billing files are protected."""
        config = AutonomyConfig()

        assert config.is_protected_file("apps/backend/src/services/billing.py")
        assert config.is_protected_file("apps/backend/src/api/routes/billing.py")

    def test_config_files_protected(self):
        """Test configuration files are protected."""
        config = AutonomyConfig()

        assert config.is_protected_file(".env")
        assert config.is_protected_file(".env.production")
        assert config.is_protected_file("docker-compose.yml")

    def test_cicd_files_protected(self):
        """Test CI/CD files are protected."""
        config = AutonomyConfig()

        assert config.is_protected_file(".github/workflows/test.yml")
        assert config.is_protected_file("Dockerfile")

    def test_package_files_protected(self):
        """Test package management files are protected."""
        config = AutonomyConfig()

        assert config.is_protected_file("package.json")
        assert config.is_protected_file("pnpm-lock.yaml")
        assert config.is_protected_file("requirements.txt")

    def test_safe_files_not_protected(self):
        """Test safe files are not protected."""
        config = AutonomyConfig()

        assert not config.is_protected_file("README.md")
        assert not config.is_protected_file("tests/test_orders.py")
        assert not config.is_protected_file("apps/web/components/Button.tsx")


# ============================================================
# AUTONOMY CONFIG TESTS
# ============================================================


class TestAutonomyConfig:
    """Test autonomy configuration."""

    def test_default_config(self):
        """Test default configuration."""
        config = AutonomyConfig()

        assert config.enabled is False
        assert config.level == AutonomyLevel.NONE
        assert config.max_prs_per_hour == 5
        assert config.cooldown_seconds == 60
        assert config.circuit_breaker_threshold == 0.05
        assert len(config.protected_files) > 0

    def test_can_auto_merge_when_disabled(self):
        """Test auto-merge blocked when disabled."""
        config = AutonomyConfig(enabled=False)

        can_merge, reason = config.can_auto_merge(["README.md"])
        assert can_merge is False
        assert "disabled" in reason

    def test_can_auto_merge_protected_files(self):
        """Test protected files cannot be auto-merged."""
        config = AutonomyConfig(
            enabled=True,
            level=AutonomyLevel.FULL,
            rules=AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.FULL],
        )

        can_merge, reason = config.can_auto_merge(["apps/web/middleware.ts"])
        assert can_merge is False
        assert "Protected files" in reason

    def test_can_auto_merge_with_documentation_level(self):
        """Test auto-merge with DOCUMENTATION level."""
        config = AutonomyConfig(
            enabled=True,
            level=AutonomyLevel.DOCUMENTATION,
            rules=AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.DOCUMENTATION],
        )

        # Docs allowed
        can_merge, reason = config.can_auto_merge(["README.md"])
        assert can_merge is True

        # Code blocked
        can_merge, reason = config.can_auto_merge(["src/api/routes/orders.py"])
        assert can_merge is False

    def test_from_env_default(self, monkeypatch):
        """Test loading config from environment (defaults)."""
        # Clear any existing env vars
        for key in [
            "AGENT_AUTONOMY_ENABLED",
            "AGENT_AUTONOMY_LEVEL",
            "AGENT_MAX_PRS_PER_HOUR",
        ]:
            monkeypatch.delenv(key, raising=False)

        config = AutonomyConfig.from_env()

        assert config.enabled is False
        assert config.level == AutonomyLevel.NONE
        assert config.max_prs_per_hour == 5

    def test_from_env_custom(self, monkeypatch):
        """Test loading config from environment (custom values)."""
        monkeypatch.setenv("AGENT_AUTONOMY_ENABLED", "true")
        monkeypatch.setenv("AGENT_AUTONOMY_LEVEL", "documentation")
        monkeypatch.setenv("AGENT_MAX_PRS_PER_HOUR", "10")
        monkeypatch.setenv("AGENT_COOLDOWN_SECONDS", "120")

        config = AutonomyConfig.from_env()

        assert config.enabled is True
        assert config.level == AutonomyLevel.DOCUMENTATION
        assert config.max_prs_per_hour == 10
        assert config.cooldown_seconds == 120

    def test_from_env_invalid_level(self, monkeypatch):
        """Test loading config with invalid autonomy level."""
        monkeypatch.setenv("AGENT_AUTONOMY_LEVEL", "invalid")

        config = AutonomyConfig.from_env()

        # Should default to NONE
        assert config.level == AutonomyLevel.NONE


# ============================================================
# SINGLETON TESTS
# ============================================================


class TestSingletonAccess:
    """Test singleton configuration access."""

    def test_get_autonomy_config(self):
        """Test getting autonomy config singleton."""
        config1 = get_autonomy_config()
        config2 = get_autonomy_config()

        # Should be same instance
        assert config1 is config2

    def test_reload_autonomy_config(self, monkeypatch):
        """Test reloading configuration."""
        # Initial config
        config1 = get_autonomy_config()
        initial_level = config1.level

        # Change environment
        monkeypatch.setenv("AGENT_AUTONOMY_LEVEL", "documentation")

        # Reload
        config2 = reload_autonomy_config()

        # Should be different
        assert config2.level == AutonomyLevel.DOCUMENTATION
        assert config2.level != initial_level


# ============================================================
# INTEGRATION TESTS
# ============================================================


class TestIntegration:
    """Integration tests for autonomy configuration."""

    def test_documentation_autonomy_workflow(self):
        """Test complete documentation autonomy workflow."""
        config = AutonomyConfig(
            enabled=True,
            level=AutonomyLevel.DOCUMENTATION,
            rules=AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.DOCUMENTATION],
        )

        # Scenario 1: Pure documentation PR
        files = ["README.md", "docs/INSTALL.md"]
        can_merge, reason = config.can_auto_merge(files)
        assert can_merge is True

        # Scenario 2: Mixed docs and code
        files = ["README.md", "src/api/routes/orders.py"]
        can_merge, reason = config.can_auto_merge(files)
        assert can_merge is False

        # Scenario 3: Protected file
        files = ["README.md", "apps/web/middleware.ts"]
        can_merge, reason = config.can_auto_merge(files)
        assert can_merge is False
        assert "Protected" in reason

    def test_tests_autonomy_workflow(self):
        """Test complete tests autonomy workflow."""
        config = AutonomyConfig(
            enabled=True,
            level=AutonomyLevel.TESTS,
            rules=AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.TESTS],
        )

        # Scenario 1: Pure test PR
        files = ["tests/test_orders.py", "tests/test_customers.py"]
        can_merge, reason = config.can_auto_merge(files)
        assert can_merge is True

        # Scenario 2: Tests + docs
        files = ["tests/test_orders.py", "README.md"]
        can_merge, reason = config.can_auto_merge(files)
        assert can_merge is True

        # Scenario 3: Tests + code
        files = ["tests/test_orders.py", "src/api/routes/orders.py"]
        can_merge, reason = config.can_auto_merge(files)
        assert can_merge is False

    def test_protected_files_coverage(self):
        """Test all protected file patterns are working."""
        config = AutonomyConfig()

        protected_examples = [
            "apps/web/middleware.ts",  # Auth
            "apps/backend/src/db/demo_models.py",  # Schema
            "apps/backend/src/services/billing.py",  # Billing
            ".env",  # Config
            ".github/workflows/test.yml",  # CI/CD
            "package.json",  # Dependencies
        ]

        for file_path in protected_examples:
            assert config.is_protected_file(file_path), f"Expected {file_path} to be protected"

    def test_autonomy_level_progression(self):
        """Test autonomy levels are progressively more permissive."""
        files_by_type = {
            "docs": ["README.md"],
            "tests": ["tests/test_orders.py"],
            "ui": ["apps/web/components/Button.tsx"],
            "code": ["src/api/routes/orders.py"],
        }

        # NONE: Nothing allowed
        config = AutonomyConfig(enabled=True, level=AutonomyLevel.NONE, rules=AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.NONE])
        for file_type, files in files_by_type.items():
            can_merge, _ = config.can_auto_merge(files)
            assert can_merge is False

        # DOCUMENTATION: Only docs
        config = AutonomyConfig(enabled=True, level=AutonomyLevel.DOCUMENTATION, rules=AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.DOCUMENTATION])
        can_merge, _ = config.can_auto_merge(files_by_type["docs"])
        assert can_merge is True
        can_merge, _ = config.can_auto_merge(files_by_type["tests"])
        assert can_merge is False

        # TESTS: Docs + tests
        config = AutonomyConfig(enabled=True, level=AutonomyLevel.TESTS, rules=AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.TESTS])
        can_merge, _ = config.can_auto_merge(files_by_type["docs"])
        assert can_merge is True
        can_merge, _ = config.can_auto_merge(files_by_type["tests"])
        assert can_merge is True
        can_merge, _ = config.can_auto_merge(files_by_type["ui"])
        assert can_merge is False

        # LOW_RISK: Docs + tests + UI
        config = AutonomyConfig(enabled=True, level=AutonomyLevel.LOW_RISK, rules=AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.LOW_RISK])
        can_merge, _ = config.can_auto_merge(files_by_type["ui"])
        assert can_merge is True

        # FULL: Any LOW risk (relies on RiskAssessor)
        config = AutonomyConfig(enabled=True, level=AutonomyLevel.FULL, rules=AUTONOMY_RULES_BY_LEVEL[AutonomyLevel.FULL])
        can_merge, _ = config.can_auto_merge(files_by_type["code"])
        assert can_merge is True  # Pattern matches, but RiskAssessor would evaluate actual risk
