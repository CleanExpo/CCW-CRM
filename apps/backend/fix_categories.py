import asyncio

from sqlalchemy import text

from src.config.database import async_engine


async def fix():
    async with async_engine.begin() as conn:
        # Update all uppercase category values to lowercase
        result = await conn.execute(text("""
            UPDATE products
            SET category = LOWER(category)
            WHERE category != LOWER(category)
        """))
        print(f"Categories normalized to lowercase - {result.rowcount} rows updated")

    # Verify the fix in a separate connection
    async with async_engine.connect() as conn:
        result = await conn.execute(text('SELECT category, COUNT(*) FROM products GROUP BY category ORDER BY category'))
        print("\nCategories after fix:")
        for row in result:
            print(f"  {row[0]}: {row[1]} products")

asyncio.run(fix())
