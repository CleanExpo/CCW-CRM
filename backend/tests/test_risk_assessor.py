"""
Unit tests for Risk Assessor.

Tests risk classification for various code change scenarios.
"""

import pytest

from src.ai.agents.risk_assessor import (
    ApprovalPolicy,
    RiskAssessor,
    RiskLevel,
)


@pytest.fixture
def assessor():
    """Create a risk assessor instance."""
    return RiskAssessor()


class TestRiskAssessor:
    """Test suite for RiskAssessor class."""

    def test_critical_auth_file(self, assessor):
        """Test that auth files are marked as CRITICAL."""
        result = assessor.assess_change_risk(
            changed_files=["apps/backend/src/api/middleware.ts"],
            lines_added=10,
            lines_removed=5,
            tests_passed=True,
        )

        assert result.risk_level == RiskLevel.CRITICAL
        assert result.approval_policy == ApprovalPolicy.SECURITY_AUDIT
        assert not result.auto_merge_allowed
        assert len(result.critical_files) == 1

    def test_critical_billing_file(self, assessor):
        """Test that billing files are marked as CRITICAL."""
        result = assessor.assess_change_risk(
            changed_files=["apps/backend/src/api/routes/billing.py"],
            lines_added=50,
            lines_removed=10,
            tests_passed=True,
        )

        assert result.risk_level == RiskLevel.CRITICAL
        assert result.approval_policy == ApprovalPolicy.SECURITY_AUDIT
        assert not result.auto_merge_allowed

    def test_critical_database_schema(self, assessor):
        """Test that database schema files are marked as CRITICAL."""
        result = assessor.assess_change_risk(
            changed_files=["apps/backend/src/db/demo_models.py"],
            lines_added=100,
            lines_removed=50,
            tests_passed=True,
        )

        assert result.risk_level == RiskLevel.CRITICAL
        assert not result.auto_merge_allowed

    def test_low_risk_documentation(self, assessor):
        """Test that documentation changes are LOW risk."""
        result = assessor.assess_change_risk(
            changed_files=["README.md", "docs/api.md"],
            lines_added=50,
            lines_removed=20,
            tests_passed=True,
        )

        assert result.risk_level == RiskLevel.LOW
        assert result.approval_policy == ApprovalPolicy.AUTO_MERGE
        assert result.auto_merge_allowed
        assert len(result.critical_files) == 0

    def test_low_risk_tests(self, assessor):
        """Test that test file changes are LOW risk."""
        result = assessor.assess_change_risk(
            changed_files=["apps/backend/tests/test_new_feature.py"],
            lines_added=80,
            lines_removed=10,
            tests_passed=True,
        )

        assert result.risk_level == RiskLevel.LOW
        assert result.auto_merge_allowed

    def test_low_risk_small_change(self, assessor):
        """Test that small changes (<100 LOC, <5 files) are LOW risk."""
        result = assessor.assess_change_risk(
            changed_files=[
                "apps/web/components/Button.tsx",
                "apps/web/components/Card.tsx",
            ],
            lines_added=40,
            lines_removed=15,
            tests_passed=True,
        )

        assert result.risk_level == RiskLevel.LOW
        assert result.lines_changed == 55
        assert result.files_changed == 2

    def test_medium_risk_moderate_change(self, assessor):
        """Test that moderate changes (100-500 LOC) are MEDIUM risk."""
        result = assessor.assess_change_risk(
            changed_files=[
                "apps/backend/src/api/routes/products.py",
                "apps/backend/src/api/routes/orders.py",
                "apps/backend/src/services/inventory.py",
            ],
            lines_added=200,
            lines_removed=50,
            tests_passed=True,
        )

        assert result.risk_level == RiskLevel.MEDIUM
        assert result.approval_policy == ApprovalPolicy.ONE_REVIEWER
        assert not result.auto_merge_allowed
        assert result.lines_changed == 250

    def test_high_risk_large_change(self, assessor):
        """Test that large changes (>500 LOC) are HIGH risk."""
        result = assessor.assess_change_risk(
            changed_files=[
                "apps/backend/src/api/routes/products.py",
                "apps/backend/src/api/routes/orders.py",
                "apps/backend/src/api/routes/customers.py",
                "apps/backend/src/services/inventory.py",
                "apps/backend/src/services/pricing.py",
                "apps/web/app/(dashboard)/products/page.tsx",
            ],
            lines_added=400,
            lines_removed=200,
            tests_passed=True,
        )

        assert result.risk_level == RiskLevel.HIGH
        assert result.approval_policy == ApprovalPolicy.TWO_REVIEWERS
        assert not result.auto_merge_allowed
        assert result.lines_changed == 600

    def test_high_risk_tests_failing(self, assessor):
        """Test that failing tests automatically make it HIGH risk."""
        result = assessor.assess_change_risk(
            changed_files=["apps/backend/src/api/routes/products.py"],
            lines_added=30,
            lines_removed=10,
            tests_passed=False,  # Tests failing
        )

        assert result.risk_level == RiskLevel.HIGH
        assert result.approval_policy == ApprovalPolicy.TWO_REVIEWERS
        assert not result.auto_merge_allowed
        assert not result.tests_passing

    def test_is_critical_file_auth(self, assessor):
        """Test critical file detection for auth files."""
        assert assessor.is_critical_file("apps/web/middleware.ts")
        assert assessor.is_critical_file("apps/backend/src/api/routes/demo_auth.py")
        assert assessor.is_critical_file("apps/backend/src/auth/provider.py")

    def test_is_critical_file_billing(self, assessor):
        """Test critical file detection for billing files."""
        assert assessor.is_critical_file("apps/backend/src/api/routes/billing.py")
        assert assessor.is_critical_file("apps/backend/src/billing/stripe_client.py")

    def test_is_critical_file_database(self, assessor):
        """Test critical file detection for database files."""
        assert assessor.is_critical_file("apps/backend/src/db/demo_models.py")
        assert assessor.is_critical_file("apps/backend/alembic/versions/abc123_migration.py")

    def test_is_safe_file_docs(self, assessor):
        """Test safe file detection for documentation."""
        assert assessor.is_safe_file("README.md")
        assert assessor.is_safe_file("docs/api.md")
        assert assessor.is_safe_file("CHANGELOG.md")

    def test_is_safe_file_tests(self, assessor):
        """Test safe file detection for tests."""
        assert assessor.is_safe_file("apps/backend/tests/test_api.py")
        assert assessor.is_safe_file("apps/web/__tests__/component_test.tsx")

    def test_is_safe_file_assets(self, assessor):
        """Test safe file detection for assets."""
        assert assessor.is_safe_file("apps/web/public/logo.svg")
        assert assessor.is_safe_file("apps/web/assets/styles.css")

    def test_risk_score_calculation(self, assessor):
        """Test risk score calculation logic."""
        # Small change, tests passing, no critical files
        result1 = assessor.assess_change_risk(
            changed_files=["apps/web/components/Button.tsx"],
            lines_added=20,
            lines_removed=5,
            tests_passed=True,
        )
        assert result1.risk_score < 0.3

        # Large change, tests failing
        result2 = assessor.assess_change_risk(
            changed_files=[f"file{i}.py" for i in range(20)],
            lines_added=500,
            lines_removed=200,
            tests_passed=False,
        )
        assert result2.risk_score > 0.6

    def test_approval_requirements_low(self, assessor):
        """Test approval requirements for LOW risk."""
        reqs = assessor.determine_approval_requirements(RiskLevel.LOW)
        assert reqs["policy"] == ApprovalPolicy.AUTO_MERGE
        assert reqs["reviewers_required"] == 0
        assert reqs["auto_merge"] is True
        assert reqs["require_security_audit"] is False

    def test_approval_requirements_medium(self, assessor):
        """Test approval requirements for MEDIUM risk."""
        reqs = assessor.determine_approval_requirements(RiskLevel.MEDIUM)
        assert reqs["policy"] == ApprovalPolicy.ONE_REVIEWER
        assert reqs["reviewers_required"] == 1
        assert reqs["auto_merge"] is False
        assert reqs["require_tests"] is True

    def test_approval_requirements_high(self, assessor):
        """Test approval requirements for HIGH risk."""
        reqs = assessor.determine_approval_requirements(RiskLevel.HIGH)
        assert reqs["policy"] == ApprovalPolicy.TWO_REVIEWERS
        assert reqs["reviewers_required"] == 2
        assert reqs["auto_merge"] is False

    def test_approval_requirements_critical(self, assessor):
        """Test approval requirements for CRITICAL risk."""
        reqs = assessor.determine_approval_requirements(RiskLevel.CRITICAL)
        assert reqs["policy"] == ApprovalPolicy.SECURITY_AUDIT
        assert reqs["reviewers_required"] == 2
        assert reqs["require_security_audit"] is True

    def test_mixed_files_critical_takes_precedence(self, assessor):
        """Test that critical files override other considerations."""
        result = assessor.assess_change_risk(
            changed_files=[
                "README.md",  # Safe
                "apps/backend/src/api/middleware.ts",  # Critical!
                "docs/api.md",  # Safe
            ],
            lines_added=20,
            lines_removed=10,
            tests_passed=True,
        )

        # Even though most files are safe, one critical file makes it CRITICAL
        assert result.risk_level == RiskLevel.CRITICAL
        assert not result.auto_merge_allowed

    def test_empty_change(self, assessor):
        """Test handling of empty changes."""
        result = assessor.assess_change_risk(
            changed_files=[],
            lines_added=0,
            lines_removed=0,
            tests_passed=True,
        )

        # Empty change should be LOW risk
        assert result.risk_level == RiskLevel.LOW
        assert result.lines_changed == 0
        assert result.files_changed == 0
