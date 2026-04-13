import asyncio

from sqlalchemy import text

from src.config.database import async_engine


async def fix():
    async with async_engine.begin() as conn:
        # Update all lowercase category values to uppercase to match the enum
        await conn.execute(text("""
            UPDATE products
            SET category = UPPER(category)
            WHERE category != UPPER(category)
        """))
        print("Categories normalized to UPPERCASE to match database enum")

    # Verify the fix
    async with async_engine.connect() as conn:
        result = await conn.execute(text('SELECT category, COUNT(*) FROM products GROUP BY category ORDER BY category'))
        print("\nCategories after fix:")
        for row in result:
            print(f"  {row[0]}: {row[1]} products")

asyncio.run(fix())
