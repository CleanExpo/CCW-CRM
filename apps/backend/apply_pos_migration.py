"""
Apply POS system migration.

This script creates all POS tables and seed data:
- locations (5 locations: Brisbane, Sydney, Melbourne, Online, Phone)
- sales_staff (salesperson → location mapping)
- pos_terminals (EFTPOS terminals)
- pos_transactions (transaction records)
- bank_feeds (bank feed data)
- bank_accounts (bank account config)
"""

import asyncio
from pathlib import Path

from sqlalchemy import text

from src.config.database import async_engine


async def apply_migration():
    """Apply the POS system migration."""
    migration_file = Path(__file__).parent / "migrations" / "add_pos_system.sql"

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
            print("[INFO] Applying POS system migration...")
            for idx, stmt in enumerate(statements, 1):
                print(f"[INFO] Executing statement {idx}/{len(statements)}...")
                await conn.execute(text(stmt))
            print("[PASS] Migration applied successfully!")

            # Verify tables were created
            print("\n[INFO] Verifying tables...")
            result = await conn.execute(text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name IN ('locations', 'sales_staff', 'pos_terminals', 'pos_transactions', 'bank_feeds', 'bank_accounts')
                ORDER BY table_name
            """))
            tables = [row[0] for row in result]

            if len(tables) == 6:
                print(f"[PASS] Found tables: {', '.join(tables)}")
            else:
                print(f"[WARN] Expected 6 tables, found {len(tables)}: {tables}")

            # Verify seed data
            print("\n[INFO] Verifying seed data...")
            result = await conn.execute(text("SELECT COUNT(*) FROM locations"))
            location_count = result.scalar()
            print(f"[PASS] Locations: {location_count} (expected 5)")

            result = await conn.execute(text("SELECT COUNT(*) FROM sales_staff"))
            staff_count = result.scalar()
            print(f"[PASS] Sales staff: {staff_count} (expected 5)")

            result = await conn.execute(text("SELECT COUNT(*) FROM pos_terminals"))
            terminal_count = result.scalar()
            print(f"[PASS] POS terminals: {terminal_count} (expected 8)")

            result = await conn.execute(text("SELECT COUNT(*) FROM bank_accounts"))
            bank_count = result.scalar()
            print(f"[PASS] Bank accounts: {bank_count} (expected 4)")

            # Test POS transaction number generation
            print("\n[INFO] Testing generate_pos_transaction_number()...")
            result = await conn.execute(text("SELECT generate_pos_transaction_number()"))
            txn_num = result.scalar()
            print(f"[PASS] Generated POS transaction number: {txn_num}")

            return True

    except Exception as e:
        print(f"[FAIL] Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def rollback_migration():
    """Rollback the POS system migration."""
    print("[INFO] Rolling back POS system migration...")

    rollback_sql = """
    -- Drop tables in reverse order (respect foreign keys)
    DROP TABLE IF EXISTS bank_feeds CASCADE;
    DROP TABLE IF EXISTS pos_transactions CASCADE;
    DROP TABLE IF EXISTS bank_accounts CASCADE;
    DROP TABLE IF EXISTS pos_terminals CASCADE;
    DROP TABLE IF EXISTS sales_staff CASCADE;
    DROP TABLE IF EXISTS locations CASCADE;

    -- Drop sequence
    DROP SEQUENCE IF EXISTS pos_transaction_number_seq CASCADE;

    -- Drop function
    DROP FUNCTION IF EXISTS generate_pos_transaction_number() CASCADE;

    -- Remove columns from orders table
    ALTER TABLE orders DROP COLUMN IF EXISTS payment_status;
    ALTER TABLE orders DROP COLUMN IF EXISTS paid_at;
    ALTER TABLE orders DROP COLUMN IF EXISTS payment_method;
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
