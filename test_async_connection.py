import asyncio
import asyncpg

async def test_connection():
    try:
        conn = await asyncpg.connect(
            user='ccw_staging',
            password='postgres',
            database='ccw_erp_staging',
            host='localhost',
            port=5434
        )
        print("✅ Connection successful!")

        # Test query
        result = await conn.fetchval('SELECT current_user')
        print(f"✅ Current user: {result}")

        # Check tables
        tables = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name")
        print(f"✅ Found {len(tables)} tables")
        for table in tables:
            print(f"  - {table['table_name']}")

        await conn.close()
        return True
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(test_connection())
