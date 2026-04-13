#!/usr/bin/env python3
"""
Execute SQL file against PostgreSQL database.

Usage:
    python scripts/run_sql.py <sql_file_path>

Example:
    python scripts/run_sql.py scripts/create_container_tables.sql
"""

import asyncio
import sys
from pathlib import Path

import asyncpg

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config.settings import get_settings


async def execute_sql_file(sql_file_path: str):
    """Execute SQL file against database."""
    settings = get_settings()

    # Read SQL file
    sql_path = Path(sql_file_path)
    if not sql_path.exists():
        print(f"ERROR: SQL file not found: {sql_file_path}")
        sys.exit(1)

    with open(sql_path, "r", encoding="utf-8") as f:
        sql_content = f.read()

    print(f"Executing SQL file: {sql_file_path}")
    print("-" * 80)

    # Connect to database
    try:
        # Use asyncpg directly for raw SQL execution
        conn = await asyncpg.connect(settings.database_url.replace("+asyncpg", ""))

        try:
            # Split SQL into statements (handle DO blocks specially)
            statements = []
            current_stmt = []
            in_do_block = False

            for line in sql_content.split('\n'):
                stripped = line.strip()

                # Track DO blocks
                if stripped.startswith('DO $$'):
                    in_do_block = True
                    current_stmt.append(line)
                elif in_do_block:
                    current_stmt.append(line)
                    if stripped.startswith('END $$;'):
                        in_do_block = False
                        statements.append('\n'.join(current_stmt))
                        current_stmt = []
                # Regular statements
                elif stripped and not stripped.startswith('--'):
                    current_stmt.append(line)
                    if stripped.endswith(';'):
                        statements.append('\n'.join(current_stmt))
                        current_stmt = []

            # Execute each statement
            for i, stmt in enumerate(statements, 1):
                stmt = stmt.strip()
                if not stmt:
                    continue

                print(f"\nExecuting statement {i}/{len(statements)}...")

                # Use execute for most statements, fetch for SELECT
                if stmt.upper().startswith('SELECT'):
                    result = await conn.fetch(stmt)
                    if result:
                        print("Results:")
                        for row in result:
                            print(dict(row))
                else:
                    await conn.execute(stmt)
                    print("[OK] Success")

            print("\n" + "=" * 80)
            print("=== ALL STATEMENTS EXECUTED SUCCESSFULLY ===")
            print("=" * 80)

        finally:
            await conn.close()

    except Exception as e:
        print(f"\nERROR executing SQL: {e}")
        import traceback
        traceback.print_exc()
        print("-" * 80)
        print("=== FAILED ===")
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/run_sql.py <sql_file_path>")
        print("Example: python scripts/run_sql.py scripts/create_container_tables.sql")
        sys.exit(1)

    sql_file = sys.argv[1]
    asyncio.run(execute_sql_file(sql_file))
