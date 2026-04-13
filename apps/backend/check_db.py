import asyncio

from sqlalchemy import text

from src.config.database import get_async_db


async def check():
    async for db in get_async_db():
        result = await db.execute(text("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'"))
        count = result.scalar()
        print(f"Database has {count} public tables")

        # List table names
        result2 = await db.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"))
        tables = result2.fetchall()
        if tables:
            print("\nTables:")
            for table in tables:
                print(f"  - {table[0]}")
        return

asyncio.run(check())
