"""Apply search performance indexes migration."""
import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent / "src"))

from src.config.database import get_async_db


async def apply_migration():
    """Apply search indexes migration."""
    print("Applying Search Performance Indexes Migration...")
    print("=" * 60)

    # Read migration file
    migration_file = Path(__file__).parent / "migrations" / "add_search_indexes.sql"

    if not migration_file.exists():
        print(f"ERROR: Migration file not found: {migration_file}")
        return False

    with open(migration_file, "r", encoding="utf-8") as f:
        migration_sql = f.read()

    # Stop at rollback section
    if "ROLLBACK SCRIPT" in migration_sql:
        migration_sql = migration_sql.split("ROLLBACK SCRIPT")[0]

    # Split into individual statements
    statements = []
    current_statement = []
    in_block_comment = False

    for line in migration_sql.split("\n"):
        stripped = line.strip()

        # Handle block comments
        if "/*" in stripped:
            in_block_comment = True
        if "*/" in stripped:
            in_block_comment = False
            continue

        # Skip comments and empty lines
        if in_block_comment or stripped.startswith("--") or not stripped:
            continue

        current_statement.append(line)

        # Check if statement is complete
        if stripped.endswith(";"):
            stmt = "\n".join(current_statement).strip()
            if stmt:
                statements.append(stmt)
            current_statement = []

    print(f"Found {len(statements)} SQL statements to execute")
    print("=" * 60)

    # Apply migration
    async for db in get_async_db():
        try:
            for i, stmt in enumerate(statements, 1):
                # Show progress for major operations
                if "CREATE EXTENSION" in stmt:
                    print(f"\n[{i}/{len(statements)}] Enabling pg_trgm extension...")
                elif "CREATE INDEX" in stmt and "trgm" in stmt:
                    index_name = stmt.split("idx_")[1].split()[0] if "idx_" in stmt else "unknown"
                    print(f"[{i}/{len(statements)}] Creating trigram index: idx_{index_name}")
                elif "CREATE INDEX" in stmt:
                    index_name = stmt.split("idx_")[1].split()[0] if "idx_" in stmt else "unknown"
                    print(f"[{i}/{len(statements)}] Creating B-tree index: idx_{index_name}")
                elif "ANALYZE" in stmt:
                    table_name = stmt.split("ANALYZE ")[1].strip().rstrip(";")
                    print(f"[{i}/{len(statements)}] Analyzing table: {table_name}")

                await db.execute(text(stmt))

            await db.commit()

            print("\n" + "=" * 60)
            print("Migration applied successfully!")
            print("=" * 60)

            # Verify indexes
            print("\nVerifying indexes...")
            verify_sql = """
                SELECT schemaname, tablename, indexname
                FROM pg_indexes
                WHERE tablename IN ('products', 'customers', 'orders', 'quotes', 'order_items', 'quote_items')
                  AND indexname LIKE 'idx_%'
                ORDER BY tablename, indexname;
            """

            result = await db.execute(text(verify_sql))
            indexes = result.fetchall()

            print(f"\nFound {len(indexes)} indexes:")
            current_table = None
            for schema, table, index in indexes:
                if table != current_table:
                    print(f"\n  {table}:")
                    current_table = table
                print(f"    - {index}")

            # Check pg_trgm extension
            ext_check = await db.execute(
                text("SELECT * FROM pg_extension WHERE extname = 'pg_trgm'")
            )
            if ext_check.fetchone():
                print("\n✅ pg_trgm extension enabled")

            print("\n" + "=" * 60)
            print("Expected Impact:")
            print("  - Customer wildcard search: 3,500ms → <1,000ms (71% faster)")
            print("  - Product wildcard search: 1,700ms → <800ms (53% faster)")
            print("  - Order/Quote lookups: 50-60% faster")
            print("\nNext Steps:")
            print("  1. Run load test to verify performance improvement")
            print("  2. Monitor database size increase (~100-200MB)")
            print("=" * 60)

            return True

        except Exception as e:
            print(f"\nERROR: {str(e)}")
            await db.rollback()
            return False


if __name__ == "__main__":
    result = asyncio.run(apply_migration())
    sys.exit(0 if result else 1)
