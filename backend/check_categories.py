import asyncio
from sqlalchemy import text
from src.config.database import async_engine

async def check():
    async with async_engine.connect() as conn:
        result = await conn.execute(text('SELECT category, COUNT(*) FROM products GROUP BY category'))
        for row in result:
            print(f"{row[0]}: {row[1]}")

asyncio.run(check())
