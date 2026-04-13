"""
Apply performance indexes to the database.

This script reads the SQL migration file and applies all indexes to improve query performance.
"""

import asyncio
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Database connection URL
DATABASE_URL = "postgresql+asyncpg://starter_user:local_dev_password@localhost:5432/starter_db"


async def apply_indexes():
    """Apply all performance indexes from the migration file."""
    print("Connecting to database...")
    engine = create_async_engine(DATABASE_URL, echo=False)

    # Read SQL file
    sql_file = Path(__file__).parent / "migrations" / "add_performance_indexes.sql"
    print(f"Reading SQL file: {sql_file}")

    with open(sql_file, "r", encoding="utf-8") as f:
        sql_content = f.read()

    # Split by semicolons and execute each statement
    statements = [stmt.strip() for stmt in sql_content.split(";") if stmt.strip()]

    # Filter out comments and empty statements
    statements = [
        stmt for stmt in statements
        if stmt and not stmt.startswith("--") and "COMMENT" not in stmt and "DROP INDEX" not in stmt
    ]

    print(f"Found {len(statements)} SQL statements to execute")

    async with engine.begin() as conn:
        success_count = 0
        skip_count = 0

        for i, statement in enumerate(statements, 1):
            # Skip verification queries and rollback sections
            if "SELECT" in statement.upper() and "FROM pg_indexes" in statement:
                continue
            if statement.strip().startswith("--"):
                continue

            try:
                print(f"\n[{i}/{len(statements)}] Executing statement...")
                # Show first 100 chars of statement for logging
                preview = statement[:100].replace("\n", " ")
                print(f"  Preview: {preview}...")

                await conn.execute(text(statement))
                success_count += 1
                print("  ✓ Success")

            except Exception as e:
                error_msg = str(e)
                # If index already exists, that's okay
                if "already exists" in error_msg.lower():
                    print("  ⊘ Skipped (already exists)")
                    skip_count += 1
                else:
                    print(f"  ✗ Error: {error_msg}")

    await engine.dispose()

    print(f"\n{'='*60}")
    print("Index application complete!")
    print(f"  - Successfully created: {success_count}")
    print(f"  - Already existed: {skip_count}")
    print(f"  - Total processed: {len(statements)}")
    print(f"{'='*60}")


if __name__ == "__main__":
    print("="*60)
    print("Performance Index Application")
    print("="*60)
    asyncio.run(apply_indexes())
