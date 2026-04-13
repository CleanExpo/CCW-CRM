"""Check orders in database."""
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
        "SELECT order_number, status, fulfillment_location, total FROM orders ORDER BY created_at DESC LIMIT 10"
    )

    print("Recent orders:")
    for r in rows:
        print(f'  {r["order_number"]}: status={r["status"]}, location={r["fulfillment_location"]}, total=${r["total"]}')

    # Check active orders count
    active_count = await conn.fetchval(
        "SELECT COUNT(*) FROM orders WHERE status IN ('pending', 'confirmed', 'processing', 'shipped')"
    )
    print(f"\nActive orders count: {active_count}")

    # Check delivered orders count
    delivered_count = await conn.fetchval(
        "SELECT COUNT(*) FROM orders WHERE status = 'delivered'"
    )
    print(f"Delivered orders count: {delivered_count}")

    await conn.close()


asyncio.run(check())
