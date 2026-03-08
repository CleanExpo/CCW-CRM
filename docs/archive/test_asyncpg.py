import asyncio
import asyncpg

async def test_connection():
    try:
        conn = await asyncpg.connect(
            host='localhost',
            port=5434,
            user='starter_user',
            password='local_dev_password',
            database='starter_db'
        )
        print("✅ Connection successful!")

        # Test query
        result = await conn.fetchval('SELECT COUNT(*) FROM users')
        print(f"✅ Query successful! User count: {result}")

        await conn.close()
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        print(f"Error type: {type(e).__name__}")

if __name__ == '__main__':
    asyncio.run(test_connection())
