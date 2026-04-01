"""Caching decorators for FastAPI endpoints."""
import functools
import hashlib
import json
from collections.abc import Callable
from typing import Any

from fastapi import Request

from src.utils import get_logger

from .redis_client import get_cache

logger = get_logger(__name__)


def cached(ttl: int = 300, key_prefix: str = ""):
    """
    Cache decorator for FastAPI endpoints.
    
    Args:
        ttl: Time to live in seconds (default: 300 = 5 minutes)
        key_prefix: Prefix for cache key (e.g., 'products', 'customers')
    
    Usage:
        @router.get("/api/products")
        @cached(ttl=300, key_prefix="products")
        async def list_products(...):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            cache = get_cache()

            # If Redis not connected, skip caching
            if not cache.is_connected:
                return await func(*args, **kwargs)

            # Build cache key from function name, args, and kwargs
            # Extract Request object if present
            request: Request | None = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break

            # Build cache key from query params if Request found
            cache_key_parts = [key_prefix or func.__name__]

            if request:
                # Include query params in cache key
                query_params = dict(request.query_params)
                if query_params:
                    # Sort for consistent hashing
                    params_str = json.dumps(query_params, sort_keys=True)
                    params_hash = hashlib.md5(params_str.encode()).hexdigest()[:8]
                    cache_key_parts.append(params_hash)
            else:
                # Fallback: hash kwargs for cache key
                # Exclude database session and other non-cacheable parameters
                cacheable_kwargs = {
                    k: v for k, v in kwargs.items()
                    if k not in ('db', 'session', 'request') and not hasattr(v, '__call__')
                }
                if cacheable_kwargs:
                    kwargs_str = json.dumps(cacheable_kwargs, sort_keys=True, default=str)
                    kwargs_hash = hashlib.md5(kwargs_str.encode()).hexdigest()[:8]
                    cache_key_parts.append(kwargs_hash)

            cache_key = ":".join(cache_key_parts)

            # Try to get from cache
            cached_value = await cache.get(cache_key)
            if cached_value is not None:
                logger.info(f"Cache HIT: {cache_key}")
                return cached_value

            # Cache miss - execute function
            logger.info(f"Cache MISS: {cache_key}")
            result = await func(*args, **kwargs)

            # Store in cache — serialize Pydantic v2 models to plain dicts first
            if hasattr(result, "model_dump"):
                serializable = result.model_dump(mode="json")
            elif (
                isinstance(result, list)
                and result
                and hasattr(result[0], "model_dump")
            ):
                serializable = [item.model_dump(mode="json") for item in result]
            else:
                serializable = result
            await cache.set(cache_key, serializable, ttl=ttl)

            return result

        return wrapper
    return decorator


async def invalidate_cache(key_prefix: str) -> int:
    """
    Invalidate all cache entries with given prefix.
    
    Args:
        key_prefix: Prefix to match (e.g., 'products' invalidates 'products:*')
    
    Returns:
        Number of keys deleted
    """
    cache = get_cache()
    if not cache.is_connected:
        return 0

    pattern = f"{key_prefix}:*" if not key_prefix.endswith("*") else key_prefix
    deleted = await cache.delete_pattern(pattern)
    logger.info(f"Invalidated cache: {pattern} ({deleted} keys deleted)")
    return deleted
