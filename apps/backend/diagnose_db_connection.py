#!/usr/bin/env python
"""Comprehensive database connection diagnostics."""

import asyncio

import asyncpg
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

print("=" * 80)
print("DATABASE CONNECTION DIAGNOSTICS")
print("=" * 80)

DB_CONFIG = {
    'host': 'localhost',
    'port': 5434,
    'database': 'ccw_erp_staging',
    'user': 'ccw_staging',
    'password': 'postgres'
}

# Test 1: Direct asyncpg connection
async def test_asyncpg_direct():
    print("\n[TEST 1] Direct asyncpg connection...")
    try:
        conn = await asyncpg.connect(
            host=DB_CONFIG['host'],
            port=DB_CONFIG['port'],
            database=DB_CONFIG['database'],
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password'],
            timeout=10
        )
        result = await conn.fetchval("SELECT 1")
        await conn.close()
        print("[PASS] Direct asyncpg connection works")
        print(f"   Query result: {result}")
        return True
    except Exception as e:
        print(f"[FAIL] {e}")
        return False

# Test 2: Async SQLAlchemy with asyncpg driver
async def test_sqlalchemy_async_asyncpg():
    print("\n[TEST 2] SQLAlchemy async with asyncpg driver...")
    try:
        url = f"postgresql+asyncpg://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"
        print(f"   URL: {url}")

        engine = create_async_engine(
            url,
            echo=False,  # Disable verbose logging for now
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            pool_timeout=30,
        )

        async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with async_session() as session:
            result = await session.execute(text("SELECT 1"))
            value = result.scalar()
            print("[PASS] SQLAlchemy async (asyncpg) works")
            print(f"   Query result: {value}")
            return True
    except Exception as e:
        print(f"[FAIL] {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await engine.dispose()

# Test 3: Sync SQLAlchemy with psycopg2 driver
def test_sqlalchemy_sync_psycopg2():
    print("\n[TEST 3] SQLAlchemy sync with psycopg2 driver...")
    try:
        url = f"postgresql+psycopg2://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"
        print(f"   URL: {url}")

        engine = create_engine(
            url,
            echo=False,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            pool_timeout=30,
        )

        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            value = result.scalar()
            print("[PASS] SQLAlchemy sync (psycopg2) works")
            print(f"   Query result: {value}")
            return True
    except Exception as e:
        print(f"[FAIL] {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        engine.dispose()

# Test 4: Check if it's a pool issue - try without pooling
async def test_sqlalchemy_async_no_pool():
    print("\n[TEST 4] SQLAlchemy async without connection pooling...")
    try:
        url = f"postgresql+asyncpg://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}"

        from sqlalchemy.pool import NullPool
        engine = create_async_engine(
            url,
            echo=False,
            poolclass=NullPool,  # Disable pooling
        )

        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            value = result.scalar()
            print("[PASS] SQLAlchemy async without pooling works")
            print(f"   Query result: {value}")
            return True
    except Exception as e:
        print(f"[FAIL] {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await engine.dispose()

async def main():
    results = {}

    # Run all tests
    results['asyncpg_direct'] = await test_asyncpg_direct()
    results['sqlalchemy_async_asyncpg'] = await test_sqlalchemy_async_asyncpg()
    results['sqlalchemy_sync_psycopg2'] = test_sqlalchemy_sync_psycopg2()
    results['sqlalchemy_async_no_pool'] = await test_sqlalchemy_async_no_pool()

    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    for test_name, result in results.items():
        status = "[PASS]" if result else "[FAIL]"
        print(f"{status} {test_name}")

    print("\n" + "=" * 80)

    # Determine root cause
    if results['asyncpg_direct'] and not results['sqlalchemy_async_asyncpg']:
        print("ROOT CAUSE: Issue is with SQLAlchemy async engine, not asyncpg driver")
        if results['sqlalchemy_async_no_pool']:
            print("SPECIFIC ISSUE: Connection pooling is the problem")
        else:
            print("SPECIFIC ISSUE: SQLAlchemy async engine configuration")
    elif not results['asyncpg_direct']:
        print("ROOT CAUSE: asyncpg driver cannot connect to database")

    return results

if __name__ == "__main__":
    asyncio.run(main())
