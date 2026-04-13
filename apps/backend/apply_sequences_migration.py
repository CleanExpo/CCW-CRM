"""
Apply sequences migration for order/quote number generation.

This script applies the PostgreSQL SEQUENCE migration to eliminate
race conditions in concurrent order/quote creation.
"""

import asyncio
from pathlib import Path

from sqlalchemy import text

from src.config.database import async_engine


async def apply_migration():
    """Apply the sequences migration."""
    migration_file = Path(__file__).parent / "migrations" / "add_sequences_for_numbers.sql"

    if not migration_file.exists():
        print(f"[FAIL] Migration file not found: {migration_file}")
        return False

    print(f"[INFO] Reading migration from: {migration_file}")
    migration_sql = migration_file.read_text()

    # Split into individual statements
    statements = []
    current_stmt = []
    in_dollar_block = False
    dollar_count = 0

    for line in migration_sql.split('\n'):
        line_stripped = line.strip()

        # Skip comments and empty lines when not in a block
        if not in_dollar_block and (line_stripped.startswith('--') or not line_stripped):
            continue

        # Count $$ to track entry/exit of dollar-quoted blocks
        dollar_count_in_line = line.count('$$')
        if dollar_count_in_line > 0:
            dollar_count += dollar_count_in_line
            in_dollar_block = (dollar_count % 2 == 1)

        current_stmt.append(line)

        # End statement on semicolon when not in a dollar block
        if not in_dollar_block and line_stripped.endswith(';'):
            statements.append('\n'.join(current_stmt))
            current_stmt = []

    try:
        async with async_engine.begin() as conn:
            print("[INFO] Applying migration...")
            for idx, stmt in enumerate(statements, 1):
                print(f"[INFO] Executing statement {idx}/{len(statements)}...")
                await conn.execute(text(stmt))
            print("[PASS] Migration applied successfully!")

            # Verify sequences were created
            print("\n[INFO] Verifying sequences...")
            result = await conn.execute(text("""
                SELECT sequencename
                FROM pg_sequences
                WHERE schemaname = 'public'
                AND sequencename IN ('order_number_seq', 'quote_number_seq')
            """))
            sequences = [row[0] for row in result]

            if len(sequences) == 2:
                print(f"[PASS] Found sequences: {', '.join(sequences)}")
            else:
                print(f"[WARN] Expected 2 sequences, found {len(sequences)}: {sequences}")

            # Verify functions were created
            print("\n[INFO] Verifying functions...")
            result = await conn.execute(text("""
                SELECT proname
                FROM pg_proc
                WHERE proname IN ('generate_order_number', 'generate_quote_number')
            """))
            functions = [row[0] for row in result]

            if len(functions) == 2:
                print(f"[PASS] Found functions: {', '.join(functions)}")
            else:
                print(f"[WARN] Expected 2 functions, found {len(functions)}: {functions}")

            # Test the functions
            print("\n[INFO] Testing generate_order_number()...")
            result = await conn.execute(text("SELECT generate_order_number()"))
            order_num = result.scalar()
            print(f"[PASS] Generated order number: {order_num}")

            print("\n[INFO] Testing generate_quote_number()...")
            result = await conn.execute(text("SELECT generate_quote_number()"))
            quote_num = result.scalar()
            print(f"[PASS] Generated quote number: {quote_num}")

            return True

    except Exception as e:
        print(f"[FAIL] Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def rollback_migration():
    """Rollback the sequences migration."""
    print("[INFO] Rolling back migration...")

    rollback_sql = """
    DROP FUNCTION IF EXISTS generate_order_number();
    DROP FUNCTION IF EXISTS generate_quote_number();
    DROP SEQUENCE IF EXISTS order_number_seq;
    DROP SEQUENCE IF EXISTS quote_number_seq;
    """

    try:
        async with async_engine.begin() as conn:
            await conn.execute(text(rollback_sql))
            print("[PASS] Migration rolled back successfully!")
            return True

    except Exception as e:
        print(f"[FAIL] Rollback failed: {e}")
        return False


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--rollback":
        asyncio.run(rollback_migration())
    else:
        success = asyncio.run(apply_migration())
        if not success:
            sys.exit(1)
