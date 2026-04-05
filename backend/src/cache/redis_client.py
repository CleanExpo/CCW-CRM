"""Redis client for caching."""
import json
from typing import Any

import redis.asyncio as redis
from redis.asyncio.connection import ConnectionPool

from src.utils import get_logger

logger = get_logger(__name__)


class RedisCache:
    """Async Redis cache client with connection pooling."""

    def __init__(self, host: str = "localhost", port: int = 6379, db: int = 0):
        """Initialize Redis client with connection pool."""
        self.pool = ConnectionPool(
            host=host,
            port=port,
            db=db,
            decode_responses=True,
            max_connections=20,
            socket_connect_timeout=5,
            socket_keepalive=True,
        )
        self.client: redis.Redis | None = None
        self._connected = False

    async def connect(self) -> None:
        """Establish Redis connection."""
        try:
            self.client = redis.Redis(connection_pool=self.pool)
            await self.client.ping()
            self._connected = True
            logger.info("Redis connection established")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Caching disabled.")
            self._connected = False

    async def disconnect(self) -> None:
        """Close Redis connection."""
        if self.client:
            await self.client.aclose()
            await self.pool.aclose()
            self._connected = False
            logger.info("Redis connection closed")

    async def get(self, key: str) -> Any | None:
        """Get value from cache."""
        if not self._connected or not self.client:
            return None

        try:
            value = await self.client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.warning(f"Redis get error for key {key}: {e}")
            return None

    async def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """Set value in cache with TTL in seconds."""
        if not self._connected or not self.client:
            return False

        try:
            serialized = json.dumps(value, default=str)
            await self.client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            logger.warning(f"Redis set error for key {key}: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Delete key from cache."""
        if not self._connected or not self.client:
            return False

        try:
            await self.client.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Redis delete error for key {key}: {e}")
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching pattern (e.g., 'products:*')."""
        if not self._connected or not self.client:
            return 0

        try:
            keys = []
            async for key in self.client.scan_iter(match=pattern):
                keys.append(key)

            if keys:
                return await self.client.delete(*keys)
            return 0
        except Exception as e:
            logger.warning(f"Redis delete pattern error for {pattern}: {e}")
            return 0

    async def clear_all(self) -> bool:
        """Clear all cache (use with caution!)."""
        if not self._connected or not self.client:
            return False

        try:
            await self.client.flushdb()
            return True
        except Exception as e:
            logger.warning(f"Redis clear all error: {e}")
            return False

    @property
    def is_connected(self) -> bool:
        """Check if Redis is connected."""
        return self._connected


# Global cache instance
_cache_instance: RedisCache | None = None


def get_cache() -> RedisCache:
    """Get global cache instance with settings from environment."""
    global _cache_instance
    if _cache_instance is None:
        from src.config.settings import get_settings

        settings = get_settings()
        _cache_instance = RedisCache(
            host=settings.redis_host,
            port=settings.redis_port,
            db=settings.redis_db,
        )
    return _cache_instance
