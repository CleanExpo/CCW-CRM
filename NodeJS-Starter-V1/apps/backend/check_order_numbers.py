"""Check order numbers in database."""
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

    rows = await conn.fetch(
        "SELECT order_number FROM orders WHERE order_number LIKE 'ORD-2026-%' ORDER BY order_number DESC LIMIT 20"
    )

    print(f"\nFound {len(rows)} orders for 2026:")
    for r in rows:
        print(f'  {r["order_number"]}')

    await conn.close()


asyncio.run(check())
