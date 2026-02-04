#!/usr/bin/env python
"""Test Redis connection from backend."""

import asyncio
import sys
sys.path.insert(0, 'src')

from cache.redis_client import RedisCache
from config.settings import get_settings

async def test_redis():
    settings = get_settings()
    print(f"Redis config: {settings.redis_host}:{settings.redis_port} (db={settings.redis_db})")
    
    cache = RedisCache(
        host=settings.redis_host,
        port=settings.redis_port,
        db=settings.redis_db
    )
    
    print("\nConnecting to Redis...")
    try:
        await cache.connect()
        print(f"[PASS] Connected: {cache.is_connected}")
        
        # Test set/get
        await cache.set("test_key", {"value": "test"}, ttl=60)
        result = await cache.get("test_key")
        print(f"[PASS] Set/Get test: {result}")
        
        await cache.disconnect()
        print("[PASS] Disconnected")
        
    except Exception as e:
        print(f"[FAIL] {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_redis())
