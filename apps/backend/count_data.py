"""Count records in key tables."""
import asyncio

from sqlalchemy import text

from src.config.database import async_engine


async def count_data():
    """Count records in all key tables."""
    tables = ['users', 'products', 'customers', 'orders', 'quotes']

    async with async_engine.connect() as conn:
        print("\nDatabase record counts:")
        for table in tables:
            result = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
            count = result.scalar()
            print(f"  {table:15s}: {count:4d} records")


if __name__ == "__main__":
    asyncio.run(count_data())
