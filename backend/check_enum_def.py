import asyncio
from sqlalchemy import text
from src.config.database import async_engine

async def check():
    async with async_engine.connect() as conn:
        # Query PostgreSQL enum type definition
        result = await conn.execute(text("""
            SELECT enumlabel
            FROM pg_enum
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'product_category')
            ORDER BY enumsortorder
        """))
        print("PostgreSQL enum 'product_category' values:")
        for row in result:
            print(f"  - {row[0]}")

asyncio.run(check())
