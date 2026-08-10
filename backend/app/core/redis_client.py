"""Shared async Redis client - the whole backend is async now (routes, DB,
WebSocket pub/sub), so there's no remaining sync call path that needs a
separate sync client."""
import redis.asyncio as aioredis

from app.core.config import settings

async_redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
