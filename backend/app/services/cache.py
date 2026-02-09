"""
In-memory TTL cache for expensive database queries.
Eliminates repeated network round-trips to Supabase for data that rarely changes.
"""

import time
import asyncio
from functools import wraps
from typing import Optional

_cache: dict = {}
_cache_ts: dict = {}
_lock = asyncio.Lock()


def cached(ttl_seconds: int = 60):
    """Async TTL cache decorator. Caches function results for ttl_seconds."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Build cache key from function name + all arguments
            key = f"{func.__module__}.{func.__qualname__}:{args}:{sorted(kwargs.items())}"
            now = time.time()

            # Check cache (no lock needed for reads)
            if key in _cache and now - _cache_ts[key] < ttl_seconds:
                return _cache[key]

            # Cache miss — execute and store
            result = await func(*args, **kwargs)
            _cache[key] = result
            _cache_ts[key] = now
            return result
        wrapper.cache_clear = lambda: _invalidate_prefix(f"{func.__module__}.{func.__qualname__}:")
        return wrapper
    return decorator


def _invalidate_prefix(prefix: str):
    """Remove all cache entries matching prefix."""
    keys = [k for k in _cache if k.startswith(prefix)]
    for k in keys:
        _cache.pop(k, None)
        _cache_ts.pop(k, None)


def invalidate_all():
    """Clear entire cache. Call after pipeline runs or data updates."""
    _cache.clear()
    _cache_ts.clear()


def invalidate_module(module_name: str):
    """Clear cache for a specific module (e.g. 'data_service', 'calidad_service')."""
    _invalidate_prefix(f"app.services.{module_name}.")


def cache_info() -> dict:
    """Return cache statistics."""
    now = time.time()
    total = len(_cache)
    expired = sum(1 for k in _cache_ts if now - _cache_ts[k] > 300)
    return {"total_entries": total, "expired_entries": expired}
