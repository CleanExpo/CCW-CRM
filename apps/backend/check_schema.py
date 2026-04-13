"""Check database schema after migration."""
import os

import asyncpg
from dotenv import load_dotenv

load_dotenv()

async def check_schema():
    """Check all tables and columns created."""
    database_url = os.getenv("DATABASE_URL")
    conn = await asyncpg.connect(database_url)

    try:
        # Get all tables
        tables = await conn.fetch("""
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
        """)

        print(f"Found {len(tables)} tables:")
        for table in tables:
            table_name = table['tablename']

            # Get columns for each table
            columns = await conn.fetch("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = $1
                ORDER BY ordinal_position
            """, table_name)

            print(f"\n{table_name} ({len(columns)} columns):")
            for col in columns:
                print(f"  - {col['column_name']}: {col['data_type']}")

        # Get all indexes
        indexes = await conn.fetch("""
            SELECT indexname, tablename
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND indexname NOT LIKE '%_pkey'
            ORDER BY tablename, indexname
        """)

        print(f"\n\nFound {len(indexes)} indexes:")
        for idx in indexes:
            print(f"  - {idx['indexname']} on {idx['tablename']}")

    finally:
        await conn.close()

if __name__ == "__main__":
    import asyncio
    asyncio.run(check_schema())
