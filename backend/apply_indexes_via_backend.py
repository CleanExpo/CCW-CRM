"""
Apply performance indexes using the backend's database configuration.

This script uses the same database connection settings as the backend API.
"""

import asyncio
from pathlib import Path
from sqlalchemy import text
import sys

# Add src to path to import backend modules
sys.path.insert(0, str(Path(__file__).parent / "src"))

from config.database import async_engine


async def apply_indexes():
    """Apply all performance indexes from the migration file."""
    print("Using backend database configuration...")

    # Read SQL file
    sql_file = Path(__file__).parent / "migrations" / "add_performance_indexes.sql"
    print(f"Reading SQL file: {sql_file}")

    with open(sql_file, "r", encoding="utf-8") as f:
        sql_content = f.read()

    # Split by semicolons and execute each statement
    statements = [stmt.strip() for stmt in sql_content.split(";") if stmt.strip()]

    # Filter and clean statements
    filtered_statements = []
    for stmt in statements:
        if not stmt:
            continue

        # Remove leading/trailing whitespace and comments
        lines = stmt.split('\n')
        cleaned_lines = []
        for line in lines:
            line = line.strip()
            # Skip pure comment lines
            if line.startswith('--'):
                continue
            # Remove inline comments
            if '--' in line:
                line = line.split('--')[0].strip()
            if line:
                cleaned_lines.append(line)

        cleaned_stmt = ' '.join(cleaned_lines)

        if not cleaned_stmt:
            continue

        # Skip COMMENT ON INDEX statements (they're just documentation)
        if cleaned_stmt.startswith("COMMENT ON INDEX"):
            continue
        # Skip DROP INDEX statements (rollback section)
        if cleaned_stmt.startswith("DROP INDEX"):
            continue
        # Skip verification SELECT queries
        if cleaned_stmt.startswith("SELECT") and "FROM pg_indexes" in cleaned_stmt:
            continue
        # Skip section headers (===...)
        if cleaned_stmt.startswith("===="):
            continue

        filtered_statements.append(cleaned_stmt)

    statements = filtered_statements

    print(f"Found {len(statements)} SQL statements to execute\n")

    async with async_engine.begin() as conn:
        success_count = 0
        skip_count = 0
        error_count = 0

        for i, statement in enumerate(statements, 1):
            try:
                # Extract index name for display
                if "CREATE INDEX" in statement:
                    parts = statement.split("CREATE INDEX")[1].strip().split()
                    # Skip IF NOT EXISTS
                    if parts[0] == "IF":
                        index_name = parts[3]
                    else:
                        index_name = parts[0]
                    print(f"[{i:2d}/{len(statements)}] Creating index: {index_name}...", end=" ")
                elif "ANALYZE" in statement:
                    table = statement.split("ANALYZE")[1].strip().rstrip(";")
                    print(f"[{i:2d}/{len(statements)}] Analyzing table: {table}...", end=" ")
                else:
                    preview = statement[:60].replace("\n", " ")
                    print(f"[{i:2d}/{len(statements)}] {preview}...", end=" ")

                await conn.execute(text(statement))
                success_count += 1
                print("[OK]")

            except Exception as e:
                error_msg = str(e)
                # If index already exists, that's okay
                if "already exists" in error_msg.lower():
                    print("[SKIP] (exists)")
                    skip_count += 1
                # If pg_trgm extension not installed, skip those indexes
                elif "pg_trgm" in error_msg.lower() or "gin_trgm_ops" in error_msg.lower():
                    print("[SKIP] (pg_trgm extension not available)")
                    skip_count += 1
                else:
                    print(f"[ERROR] Error")
                    print(f"    {error_msg[:100]}")
                    error_count += 1

    await async_engine.dispose()

    print(f"\n{'='*60}")
    print(f"Index Application Complete!")
    print(f"{'='*60}")
    print(f"  [OK] Successfully created: {success_count}")
    print(f"  [SKIP] Already existed/skipped: {skip_count}")
    print(f"  [ERROR] Errors: {error_count}")
    print(f"  [INFO] Total processed: {len(statements)}")
    print(f"{'='*60}")

    if error_count > 0:
        print("\n[WARNING] Some indexes failed to create.")
        print("This is usually okay if it's due to missing extensions (pg_trgm)")
        print("The basic B-tree indexes will still provide significant performance improvement.\n")


if __name__ == "__main__":
    print("="*60)
    print("Performance Index Application")
    print("="*60)
    print()
    asyncio.run(apply_indexes())
