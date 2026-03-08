import asyncio
import asyncpg

async def test_connection():
    try:
        conn = await asyncpg.connect(
            host='localhost',
            port=5434,
            user='starter_user',
            database='starter_db'
            # No password parameter
        )
        print("Connection successful without password!")

        result = await conn.fetchval('SELECT COUNT(*) FROM users')
        print(f"User count: {result}")

        await conn.close()
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == '__main__':
    asyncio.run(test_connection())
