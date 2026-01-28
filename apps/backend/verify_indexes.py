"""Verify that all performance indexes were created successfully."""

import asyncio
import sys
from pathlib import Path
from sqlalchemy import text

sys.path.insert(0, str(Path(__file__).parent / "src"))

from config.database import async_engine


async def verify_indexes():
    """Query database for created indexes."""
    print("Verifying database indexes...")
    print()

    query = """
    SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%'
    ORDER BY tablename, indexname;
    """

    async with async_engine.connect() as conn:
        result = await conn.execute(text(query))
        rows = result.fetchall()

        if not rows:
            print("[ERROR] No indexes found!")
            return

        # Group by table
        by_table = {}
        for row in rows:
            table = row[1]
            if table not in by_table:
                by_table[table] = []
            by_table[table].append(row[2])

        print(f"[OK] Found {len(rows)} indexes across {len(by_table)} tables\n")

        for table, indexes in sorted(by_table.items()):
            print(f"{table}: {len(indexes)} indexes")
            for idx in sorted(indexes):
                print(f"  - {idx}")
            print()

    await async_engine.dispose()


if __name__ == "__main__":
    asyncio.run(verify_indexes())
