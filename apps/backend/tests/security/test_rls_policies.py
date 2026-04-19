"""
Tests for UNI-1749 — Fleet-wide RLS policy hardening migration.

Validates the migration file structure without requiring a live DB connection.
Covers:
- Migration file exists at expected path
- All 17 previously-unprotected tables appear in the migration table list
- The dynamic DO-block pattern is present (pg_tables existence check)
- Key safety invariants: no auth.uid(), uses service_role, uses IF EXISTS guard
"""

import re
from pathlib import Path


_MIGRATION_PATH = (
    Path(__file__).parents[4]
    / "supabase"
    / "migrations"
    / "20260419000001_ccw_rls_policies.sql"
)

# The 17 tables the Supabase advisor flagged as "RLS on, no policy"
_REQUIRED_TABLES = [
    # Core ERP — users had no policy at all
    "users",
    # demo_models.py extras not in erp_permissions.sql
    "order_activity",
    "conversation_history",
    "agent_executions",
    "ai_generated_content",
    "background_jobs",
    # Workshop
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


def _sql() -> str:
    return _MIGRATION_PATH.read_text(encoding="utf-8")


def _declared_tables() -> set[str]:
    """Extract table names from the ARRAY[...] declaration in the DO block."""
    sql = _sql()
    # Match quoted strings inside the ARRAY declaration
    array_match = re.search(
        r"tables\s+TEXT\[\]\s*:=\s*ARRAY\[(.*?)\];",
        sql,
        re.DOTALL | re.IGNORECASE,
    )
    if not array_match:
        return set()
    array_body = array_match.group(1)
    return {m.group(1).lower() for m in re.finditer(r"'(\w+)'", array_body)}


# ---------------------------------------------------------------------------
# File-level checks
# ---------------------------------------------------------------------------

class TestMigrationFile:
    def test_exists(self):
        assert _MIGRATION_PATH.exists(), f"Not found: {_MIGRATION_PATH}"

    def test_not_empty(self):
        assert len(_sql().strip()) > 200

    def test_has_do_block(self):
        assert "DO $$" in _sql() or "DO $" in _sql()

    def test_has_pg_tables_existence_check(self):
        assert "pg_tables" in _sql()

    def test_targets_service_role(self):
        assert "service_role" in _sql()

    def test_no_auth_uid(self):
        assert "auth.uid()" not in _sql(), (
            "auth.uid() found — backend tables must use service_role bypass only"
        )


# ---------------------------------------------------------------------------
# Table list completeness
# ---------------------------------------------------------------------------

class TestRequiredTablesInList:
    def test_users_in_list(self):
        assert "users" in _declared_tables()

    def test_all_17_required_tables_in_list(self):
        declared = _declared_tables()
        missing = [t for t in _REQUIRED_TABLES if t not in declared]
        assert not missing, f"Tables missing from migration list: {missing}"

    def test_list_covers_at_least_17_tables(self):
        assert len(_declared_tables()) >= 17


# ---------------------------------------------------------------------------
# DO-block pattern checks
# ---------------------------------------------------------------------------

class TestDynamicPattern:
    def test_uses_execute_format_for_enable_rls(self):
        sql = _sql()
        assert "ENABLE ROW LEVEL SECURITY" in sql.upper()

    def test_uses_execute_format_for_drop_policy(self):
        sql = _sql()
        assert "DROP POLICY IF EXISTS" in sql.upper()

    def test_uses_execute_format_for_create_policy(self):
        sql = _sql()
        assert "CREATE POLICY" in sql.upper()

    def test_foreach_loop_present(self):
        sql = _sql()
        assert "FOREACH" in sql.upper()

    def test_policy_uses_for_all_with_check(self):
        sql = _sql()
        assert "FOR ALL TO service_role" in sql
        assert "USING (true)" in sql
        assert "WITH CHECK (true)" in sql
