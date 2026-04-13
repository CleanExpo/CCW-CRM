"""Apply i18n migration to database (Unicode-safe version)."""

import sys
from pathlib import Path

from sqlalchemy import create_engine, text

from src.config.settings import get_settings


def get_database_url_sync() -> str:
    """Get sync database URL."""
    settings = get_settings()
    db_url = settings.database_url or "postgresql://starter_user:local_dev_password@localhost:5432/starter_db"

    if not db_url.startswith("postgresql+psycopg2"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    return db_url


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

    # Create engine with echo=False to avoid Unicode issues
    engine = create_engine(
        get_database_url_sync(),
        echo=False,  # Disable logging to avoid Unicode encoding issues
        pool_pre_ping=True,
    )

    # Execute SQL
    try:
        print("Executing migration...")
        with engine.connect() as conn:
            conn.execute(text(sql))
            conn.commit()

        print("[SUCCESS] Migration applied successfully!")
        print()

    except Exception as e:
        # Don't print exception message if it contains Unicode
        print("[FAIL] Migration failed - check database logs for details")
        print("Traceback (ASCII-safe):")
        error_str = str(e)
        # Replace non-ASCII characters
        error_str_safe = error_str.encode('ascii', 'replace').decode('ascii')
        print(error_str_safe)
        sys.exit(1)

    print("=" * 70)
    print("MIGRATION SUMMARY")
    print("=" * 70)
    print()
    print("Created tables:")
    print("   - languages")
    print("   - product_translations")
    print("   - category_translations")
    print("   - ui_translations")
    print("   - email_template_translations")
    print("   - translation_queue")
    print()
    print("Initial data seeded:")
    print("   - 10 languages (en, zh-CN, zh-TW, es, pt, ar, vi, hi, ta, te)")
    print("   - 8 English category translations")
    print("   - 20+ common UI strings")
    print("   - 2 email templates")
    print()
    print("Indexes and triggers created")
    print("Helper view: v_translation_coverage")
    print()


if __name__ == "__main__":
    apply_migration()
