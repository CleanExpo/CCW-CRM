"""
Apply trigram indexes migration for ISS-006.

Adds pg_trgm extension and GIN indexes for fast wildcard searches.
Expected improvement: Customer search 3500ms → <1000ms, Product search 1700ms → <500ms
"""
import asyncio
import sys
from pathlib import Path

backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

async def apply_migration():
    """Apply the trigram indexes migration."""
    from sqlalchemy import text

    from src.config.database import get_async_db

    print("=" * 80)
    print("ISS-006: Applying Trigram Indexes Migration")
    print("=" * 80)

    # Read migration SQL
    migration_file = backend_path / "migrations" / "add_trigram_indexes.sql"
    print(f"\n[INFO] Reading migration from {migration_file}")

    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()

    # Split into individual statements (excluding comments and test queries)
    statements = []
    current_statement = []
    in_comment_block = False

    for line in sql_content.split('\n'):
        stripped = line.strip()

        # Skip comment blocks
        if '-- EXPLAIN ANALYZE' in line or '-- PERFORMANCE TEST' in line:
            in_comment_block = True
        if in_comment_block and (stripped.startswith('--') or not stripped):
            continue
        if in_comment_block and not stripped.startswith('--'):
            in_comment_block = False

        # Skip empty lines and single-line comments
        if not stripped or (stripped.startswith('--') and 'Migration:' not in line):
            continue

        current_statement.append(line)

        # End of statement
        if stripped.endswith(';') and not in_comment_block:
            statement = '\n'.join(current_statement).strip()
            if statement and not statement.startswith('--'):
                statements.append(statement)
            current_statement = []

    print(f"[INFO] Parsed {len(statements)} SQL statements")

    # Apply migration
    print("\n[STEP 1] Connecting to database...")
    async for db in get_async_db():
        try:
            print("[PASS] Database connection established")

            # Apply each statement
            print("\n[STEP 2] Applying migration statements...")
            for i, statement in enumerate(statements, 1):
                # Skip verification/test queries
                if 'SELECT' in statement.upper() and ('pg_indexes' in statement or 'pg_extension' in statement):
                    print(f"[INFO] Statement {i}/{len(statements)}: Verification query (skipping execution)")
                    continue

                try:
                    print(f"[INFO] Statement {i}/{len(statements)}: ", end='')

                    # Show brief description
                    if 'CREATE EXTENSION' in statement:
                        print("Creating pg_trgm extension")
                    elif 'DROP INDEX' in statement:
                        print("Dropping index (if exists)")
                    elif 'CREATE INDEX' in statement and 'company_name' in statement:
                        print("Creating index on customers.company_name")
                    elif 'CREATE INDEX' in statement and 'contact_name' in statement:
                        print("Creating index on customers.contact_name")
                    elif 'CREATE INDEX' in statement and 'customer_number' in statement:
                        print("Creating index on customers.customer_number")
                    elif 'CREATE INDEX' in statement and 'email' in statement:
                        print("Creating index on customers.email")
                    elif 'CREATE INDEX' in statement and 'products' in statement and 'name' in statement:
                        print("Creating index on products.name")
                    elif 'CREATE INDEX' in statement and 'sku' in statement:
                        print("Creating index on products.sku")
                    elif 'CREATE INDEX' in statement and 'description' in statement:
                        print("Creating index on products.description")
                    else:
                        print(statement[:50].replace('\n', ' ') + '...')

                    await db.execute(text(statement))
                    await db.commit()

                except Exception as e:
                    error_str = str(e)
                    # Ignore "already exists" errors (idempotent migration)
                    if 'already exists' in error_str.lower():
                        print("      (already exists, skipping)")
                    else:
                        print(f"\n[ERROR] Failed: {e}")
                        raise

            print("\n[STEP 3] Verifying indexes...")
            result = await db.execute(text("""
                SELECT
                    tablename,
                    indexname,
                    pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
                FROM pg_indexes
                WHERE indexname LIKE '%_trgm'
                ORDER BY tablename, indexname
            """))
            indexes = result.fetchall()

            if indexes:
                print(f"[PASS] Created {len(indexes)} trigram indexes:")
                for table, index_name, size in indexes:
                    print(f"  - {table}.{index_name}: {size}")
            else:
                print("[WARN] No trigram indexes found - migration may have failed")

            print("\n[STEP 4] Checking pg_trgm extension...")
            result = await db.execute(text("""
                SELECT extname, extversion
                FROM pg_extension
                WHERE extname = 'pg_trgm'
            """))
            extension = result.fetchone()

            if extension:
                print(f"[PASS] pg_trgm extension installed (version {extension[1]})")
            else:
                print("[FAIL] pg_trgm extension not found")
                sys.exit(1)

            print("\n" + "=" * 80)
            print("MIGRATION SUMMARY")
            print("=" * 80)
            print("\n[SUCCESS] Trigram indexes migration completed!")
            print("\nIndexes created:")
            print("  Customer: company_name, contact_name, customer_number, email")
            print("  Product: name, sku, description")
            print("\nExpected performance improvements:")
            print("  - Customer wildcard search: 3500ms → <1000ms (70% faster)")
            print("  - Product wildcard search: 1700ms → <500ms (70% faster)")
            print("\nNext steps:")
            print("  1. Test search performance with EXPLAIN ANALYZE")
            print("  2. Monitor query performance in production")
            print("  3. Run load tests to verify improvement")
            print("=" * 80)

        except Exception as e:
            print(f"\n[FAIL] Migration failed: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
        finally:
            await db.close()
        break


if __name__ == "__main__":
    asyncio.run(apply_migration())
