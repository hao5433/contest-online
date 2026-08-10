"""Redis-backed fixed-window rate limiter for login attempts.

Backed by Redis (not in-memory) so the limit is correct regardless of which
worker process/replica handles each request - the same reasoning as moving
the WebSocket ConnectionManager to Redis pub/sub in app/routers/ws.py.
"""
from app.core.redis_client import async_redis_client

MAX_ATTEMPTS = 5
WINDOW_SECONDS = 15 * 60


def _key(key: str) -> str:
    return f"login_attempts:{key}"


async def is_locked_out(key: str) -> bool:
    """`key` is typically the lowercased email being logged into - locking
    per-account (not per-IP) avoids one shared office/school IP locking out
    every student behind it."""
    count = await async_redis_client.get(_key(key))
    return count is not None and int(count) >= MAX_ATTEMPTS


async def record_failure(key: str) -> None:
    """Fixed window: the count (and its expiry) resets on the *first*
    failure of a new window, not on every failure - so a slow trickle of
    attempts still gets capped at MAX_ATTEMPTS per WINDOW_SECONDS rather
    than the window continuously sliding forward forever."""
    redis_key = _key(key)
    count = await async_redis_client.incr(redis_key)
    if count == 1:
        await async_redis_client.expire(redis_key, WINDOW_SECONDS)


async def clear(key: str) -> None:
    await async_redis_client.delete(_key(key))
