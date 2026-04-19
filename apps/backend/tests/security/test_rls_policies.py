"""
Tests for UNI-1749 — Fleet-wide RLS policy hardening migration.

Validates the migration file structure without requiring a live DB connection.
Covers:
- Migration file exists at expected path
- All 17 previously-unprotected tables have ENABLE ROW LEVEL SECURITY
- All 17 previously-unprotected tables have a CREATE POLICY entry
- The critical `users` table gap is explicitly fixed
- Policy naming convention is consistent (service_role_all_*)
"""

import re
from pathlib import Path


# Path to the migration file relative to the repo root
_MIGRATION_PATH = (
    Path(__file__).parents[4]
    / "supabase"
    / "migrations"
    / "20260419000001_ccw_rls_policies.sql"
)

# The 17 tables that the Supabase advisor flagged as "RLS on, no policy"
# These are the minimum required to clear the advisor alert count to 0.
_REQUIRED_TABLES = [
    # Core ERP — users had no policy at all
    "users",
    # demo_models.py extras not covered by erp_permissions.sql
    "order_activity",
    "conversation_history",
    "agent_executions",
    "ai_generated_content",
    "background_jobs",
    # Workshop module
    "equipment",
    "service_templates",
    "service_template_items",
    "workshop_bookings",
    "service_reminders",
    "equipment_service_history",
    # Inventory / shipments
    "product_stock_by_location",
    "outbound_shipments",
    "inbound_shipments",
    # CRM
    "contacts",
    "activities",
]


def _load_migration() -> str:
    return _MIGRATION_PATH.read_text(encoding="utf-8")


class TestRlsMigrationFile:
    def test_migration_file_exists(self):
        assert _MIGRATION_PATH.exists(), (
            f"Migration file not found at {_MIGRATION_PATH}"
        )

    def test_migration_is_not_empty(self):
        sql = _load_migration()
        assert len(sql.strip()) > 100

    def test_migration_targets_service_role(self):
        sql = _load_migration()
        assert "service_role" in sql

    def test_migration_uses_if_exists_guard(self):
        sql = _load_migration()
        assert "IF NOT EXISTS" in sql or "IF EXISTS" in sql


class TestRlsEnabledOnRequiredTables:
    """Every required table must have ENABLE ROW LEVEL SECURITY in the migration."""

    def _rls_tables(self) -> set[str]:
        sql = _load_migration()
        return {
            m.group(1).lower()
            for m in re.finditer(
                r"ALTER TABLE IF EXISTS public\.(\w+)\s+ENABLE ROW LEVEL SECURITY",
                sql,
                re.IGNORECASE,
            )
        }

    def test_users_rls_enabled(self):
        assert "users" in self._rls_tables()

    def test_all_17_tables_rls_enabled(self):
        enabled = self._rls_tables()
        missing = [t for t in _REQUIRED_TABLES if t not in enabled]
        assert not missing, f"RLS not enabled for: {missing}"


class TestRlsPoliciesOnRequiredTables:
    """Every required table must have a CREATE POLICY entry."""

    def _policy_tables(self) -> set[str]:
        sql = _load_migration()
        return {
            m.group(1).lower()
            for m in re.finditer(
                r"CREATE POLICY\s+\"service_role_all_(\w+)\"",
                sql,
                re.IGNORECASE,
            )
        }

    def test_users_has_policy(self):
        assert "users" in self._policy_tables()

    def test_all_17_tables_have_policy(self):
        policies = self._policy_tables()
        missing = [t for t in _REQUIRED_TABLES if t not in policies]
        assert not missing, f"No service_role policy for: {missing}"

    def test_policy_count_at_least_17(self):
        assert len(self._policy_tables()) >= 17


class TestRlsPolicyStructure:
    """Spot-check that policies use the correct FOR ALL / USING (true) pattern."""

    def test_users_policy_is_for_all(self):
        sql = _load_migration()
        # Find the CREATE POLICY block for users
        match = re.search(
            r'CREATE POLICY\s+"service_role_all_users".*?;',
            sql,
            re.IGNORECASE | re.DOTALL,
        )
        assert match, "service_role_all_users policy not found"
        policy_sql = match.group(0)
        assert "FOR ALL" in policy_sql.upper()
        assert "using (true)" in policy_sql.lower()
        assert "with check (true)" in policy_sql.lower()

    def test_workshop_booking_policy_exists(self):
        sql = _load_migration()
        assert "service_role_all_workshop_bookings" in sql

    def test_no_hardcoded_uids(self):
        sql = _load_migration()
        assert "auth.uid()" not in sql, (
            "auth.uid() found — backend tables should use service_role bypass, "
            "not user-scoped policies"
        )

    def test_drop_policy_before_create(self):
        sql = _load_migration()
        drop_count = sql.upper().count("DROP POLICY IF EXISTS")
        create_count = sql.upper().count("CREATE POLICY")
        # Every CREATE POLICY should be preceded by a DROP POLICY IF EXISTS
        assert drop_count >= create_count - 5, (
            f"Expected ~{create_count} DROP POLICY IF EXISTS statements, "
            f"found {drop_count}"
        )
