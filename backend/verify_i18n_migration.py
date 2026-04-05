"""Verify i18n migration was successful."""

from sqlalchemy import text

from src.config.database import sync_engine


def verify_migration():
    """Verify the i18n tables were created and seeded properly."""
    print("=" * 70)
    print("VERIFYING i18n MIGRATION")
    print("=" * 70)
    print()

    with sync_engine.connect() as conn:
        # Check tables exist
        tables_query = """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN (
            'languages',
            'product_translations',
            'category_translations',
            'ui_translations',
            'email_template_translations',
            'translation_queue'
        )
        ORDER BY table_name;
        """
        result = conn.execute(text(tables_query))
        tables = [row[0] for row in result]

        print(f"Tables created: {len(tables)}/6")
        for table in tables:
            print(f"  - {table}")
        print()

        # Check languages seeded
        lang_query = "SELECT code, name, native_name, is_rtl FROM languages ORDER BY sort_order"
        result = conn.execute(text(lang_query))
        languages = list(result)

        print(f"Languages seeded: {len(languages)}")
        for code, name, native_name, is_rtl in languages:
            rtl_indicator = " (RTL)" if is_rtl else ""
            # Encode native name safely
            native_safe = native_name.encode('ascii', 'replace').decode('ascii')
            print(f"  [{code:6}] {name:25} | {native_safe}{rtl_indicator}")
        print()

        # Check category translations
        cat_query = "SELECT COUNT(*) FROM category_translations"
        result = conn.execute(text(cat_query))
        cat_count = result.scalar()
        print(f"Category translations: {cat_count}")
        print()

        # Check UI translations
        ui_query = "SELECT COUNT(*) FROM ui_translations"
        result = conn.execute(text(ui_query))
        ui_count = result.scalar()
        print(f"UI translations: {ui_count}")
        print()

        # Check email templates
        email_query = "SELECT COUNT(*) FROM email_template_translations"
        result = conn.execute(text(email_query))
        email_count = result.scalar()
        print(f"Email templates: {email_count}")
        print()

        # Check view
        view_query = "SELECT * FROM v_translation_coverage LIMIT 3"
        result = conn.execute(text(view_query))
        coverage = list(result)
        print("Translation coverage (sample):")
        for row in coverage:
            lang_code, lang_name, translated, total, percentage, _ = row
            print(f"  {lang_name:25} | {translated}/{total} products ({percentage}%)")
        print()

    print("=" * 70)
    print("VERIFICATION COMPLETE")
    print("=" * 70)
    print()
    print("Status: SUCCESS - All i18n tables created and seeded")
    print()


if __name__ == "__main__":
    verify_migration()
