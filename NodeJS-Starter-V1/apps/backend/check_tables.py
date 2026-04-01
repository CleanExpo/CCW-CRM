"""Check what tables exist in the database."""
import asyncio
from sqlalchemy import text
from src.config.database import async_engine


async def check_tables():
    """List all tables in the public schema."""
    async with async_engine.connect() as conn:
        result = await conn.execute(
            text("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
        )
        tables = [row[0] for row in result]
        print(f"\nFound {len(tables)} tables in database:")
        for table in tables:
            print(f"  - {table}")


if __name__ == "__main__":
    asyncio.run(check_tables())
