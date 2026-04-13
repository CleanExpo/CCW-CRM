import asyncio

import asyncpg


async def test_connection():
    try:
        conn = await asyncpg.connect(
            host='localhost',
            port=5434,
            user='testuser',
            password='testpass',
            database='starter_db'
        )
        print("Connection successful with testuser!")

        result = await conn.fetchval('SELECT COUNT(*) FROM users')
        print(f"User count: {result}")

        await conn.close()
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == '__main__':
    asyncio.run(test_connection())
