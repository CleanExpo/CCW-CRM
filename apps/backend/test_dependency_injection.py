#!/usr/bin/env python
"""Test if FastAPI dependency injection works with database."""

import asyncio
import sys
sys.path.insert(0, 'src')

from fastapi import FastAPI, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from config.database import get_async_db

# Create a minimal FastAPI app
app = FastAPI()

@app.get("/test-db")
async def test_database(db: AsyncSession = Depends(get_async_db)):
    """Test endpoint that uses database dependency."""
    try:
        result = await db.execute(text("SELECT 1"))
        value = result.scalar()
        return {"status": "success", "value": value}
    except Exception as e:
        return {"status": "error", "error": str(e)}

async def test_directly():
    """Test the dependency directly without FastAPI routing."""
    print("Testing get_async_db dependency directly...")
    
    # Call the dependency generator
    async for db in get_async_db():
        try:
            result = await db.execute(text("SELECT 1"))
            value = result.scalar()
            print(f"[PASS] Direct dependency call works: {value}")
        except Exception as e:
            print(f"[FAIL] Direct dependency call failed: {e}")
            import traceback
            traceback.print_exc()
        finally:
            break

async def test_with_test_client():
    """Test using FastAPI TestClient."""
    print("\nTesting with FastAPI TestClient...")
    
    from httpx import AsyncClient, ASGITransport
    
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test"
        ) as client:
            response = await client.get("/test-db")
            print(f"[RESULT] Status: {response.status_code}")
            print(f"[RESULT] Response: {response.json()}")
    except Exception as e:
        print(f"[FAIL] TestClient failed: {e}")
        import traceback
        traceback.print_exc()

async def main():
    # Test 1: Direct dependency call (should work based on previous tests)
    await test_directly()
    
    # Test 2: Through FastAPI (this is what fails in production)
    await test_with_test_client()

if __name__ == "__main__":
    asyncio.run(main())
