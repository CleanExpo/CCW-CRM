"""Check CCWONLINE products in database."""
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

    # Count CCWONLINE products
    count = await conn.fetchval(
        "SELECT COUNT(*) FROM products WHERE sku NOT LIKE 'TEST-SKU-%' AND sku NOT LIKE 'CCW-%' AND sku NOT LIKE 'EQ-%'"
    )
    print(f"\nTotal CCWONLINE products: {count}")

    # Sample CCWONLINE products
    rows = await conn.fetch(
        """
        SELECT sku, name, category, price, stock, warehouse_location
        FROM products
        WHERE sku NOT LIKE 'TEST-SKU-%' AND sku NOT LIKE 'CCW-%' AND sku NOT LIKE 'EQ-%'
        ORDER BY created_at DESC
        LIMIT 10
        """
    )

    print("\nRecent CCWONLINE products:")
    for r in rows:
        print(f'  {r["sku"]}: {r["name"][:50]} - ${r["price"]} ({r["stock"]} @ {r["warehouse_location"]})')

    # Count by category
    category_rows = await conn.fetch(
        """
        SELECT category, COUNT(*) as count
        FROM products
        WHERE sku NOT LIKE 'TEST-SKU-%' AND sku NOT LIKE 'CCW-%' AND sku NOT LIKE 'EQ-%'
        GROUP BY category
        ORDER BY count DESC
        """
    )

    print("\nProducts by category:")
    for r in category_rows:
        print(f'  {r["category"]}: {r["count"]} products')

    await conn.close()


asyncio.run(check())
