import asyncio
import asyncpg

async def test_connection():
    try:
        conn = await asyncpg.connect(
            'postgresql://ccw_staging:postgres@localhost:5434/ccw_erp_staging'
        )
        print("Connection successful!")
        result = await conn.fetchval("SELECT COUNT(*) FROM products")
        print(f"Products count: {result}")
        await conn.close()
        return True
    except Exception as e:
        print(f"Connection failed: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(test_connection())
