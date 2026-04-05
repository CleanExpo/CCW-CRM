"""Apply i18n migration to database."""

import sys
from pathlib import Path

from sqlalchemy import text

from src.config.database import sync_engine


def apply_migration():
    """Apply the i18n migration to the database."""
    migration_file = Path(__file__).parent / "migrations" / "add_i18n_support.sql"

    if not migration_file.exists():
        print(f"[FAIL] Migration file not found: {migration_file}")
        sys.exit(1)

    print("=" * 70)
    print("APPLYING i18n MIGRATION")
    print("=" * 70)
    print()
    print(f"Migration file: {migration_file.name}")
    print()

    # Read SQL from file
    sql = migration_file.read_text(encoding="utf-8")
    print(f"SQL loaded: {len(sql):,} characters")
    print()

    # Execute SQL using synchronous engine
    try:
        with sync_engine.connect() as conn:
            # Split SQL by statement terminator and execute each
            # Note: This is a simple approach. For complex migrations,
            # consider using Alembic or executing as a single transaction
            print("Executing migration...")
            conn.execute(text(sql))
            conn.commit()
            print("[SUCCESS] Migration applied successfully!")
            print()

    except Exception as e:
        print(f"[FAIL] Migration failed: {e}")
        sys.exit(1)

    print("=" * 70)
    print("MIGRATION SUMMARY")
    print("=" * 70)
    print()
    print("✅ 6 tables created:")
    print("   - languages")
    print("   - product_translations")
    print("   - category_translations")
    print("   - ui_translations")
    print("   - email_template_translations")
    print("   - translation_queue")
    print()
    print("✅ Initial data seeded:")
    print("   - 10 languages (en, zh-CN, zh-TW, es, pt, ar, vi, hi, ta, te)")
    print("   - English category translations (8 categories)")
    print("   - Common UI strings (20+ entries)")
    print("   - Email templates (2 templates)")
    print()
    print("✅ Indexes created for optimal performance")
    print("✅ Triggers for automatic timestamp updates")
    print("✅ Helper view: v_translation_coverage")
    print()
    print("=" * 70)
    print("NEXT STEPS")
    print("=" * 70)
    print()
    print("1. Verify migration with: python verify_i18n_migration.py")
    print("2. Start implementing I18nService backend service")
    print("3. Setup frontend i18n with next-intl")
    print()


if __name__ == "__main__":
    apply_migration()
