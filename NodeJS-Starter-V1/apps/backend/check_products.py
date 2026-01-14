"""Check products in database."""
import asyncio
import asyncpg


async def check():
    conn = await asyncpg.connect(
        user="starter_user",
        password="local_dev_password",
        database="starter_db",
        host="127.0.0.1",
        port=5433,
    )

    count = await conn.fetchval("SELECT COUNT(*) FROM products")
    print(f"\nCurrent products in database: {count}")

    # Sample products
    rows = await conn.fetch(
        "SELECT sku, name, category, price, stock FROM products ORDER BY created_at DESC LIMIT 10"
    )

    print("\nSample products:")
    for r in rows:
        print(f'  {r["sku"]}: {r["name"][:50]} - ${r["price"]} ({r["stock"]} in stock)')

    await conn.close()


asyncio.run(check())
