"""Test Supabase production database connection"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

DATABASE_URL = "postgresql+asyncpg://postgres.vwfgksqkajnpfjospbpe:cn18fdeRF16gHRxW@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres"

async def test_connection():
    """Test database connection and run basic query"""
    print("Testing Supabase production database connection...")
    print("Host: aws-1-ap-southeast-2.pooler.supabase.com")
    print("Port: 6543 (pooler)")
    print()

    try:
        # Create engine
        engine = create_async_engine(
            DATABASE_URL,
            echo=False,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10
        )

        # Test connection
        async with engine.connect() as conn:
            # Test basic query
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
            print("[SUCCESS] Connection successful!")
            print(f"PostgreSQL version: {version}")
            print()

            # Test schema query
            result = await conn.execute(text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                LIMIT 10
            """))
            tables = result.fetchall()

            if tables:
                print(f"[SUCCESS] Found {len(tables)} tables in database:")
                for table in tables:
                    print(f"   - {table[0]}")
            else:
                print("[INFO] No tables found yet (fresh database - expected)")
            print()

            # Test pool configuration
            print("[SUCCESS] Connection pool configured:")
            print("   - Pool size: 5")
            print("   - Max overflow: 10")
            print("   - Using pooler connection (better for production)")
            print()

            print("[SUCCESS] Supabase production database is READY!")
            print("[SUCCESS] You can now deploy to production")

        await engine.dispose()
        return True

    except Exception as e:
        print(f"[ERROR] Connection failed: {str(e)}")
        print()
        print("Troubleshooting:")
        print("   1. Verify password is correct")
        print("   2. Check if project is active in Supabase dashboard")
        print("   3. Verify network connection")
        return False

if __name__ == "__main__":
    success = asyncio.run(test_connection())
    exit(0 if success else 1)
