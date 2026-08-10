"""Short-lived, single-use tickets for authenticating a WebSocket handshake.

Browsers can't send an `Authorization` header on a WebSocket handshake, so
the token has to travel in the URL's query string - and query strings get
written verbatim into access logs (uvicorn does this; so would any reverse
proxy in front of it). Putting the real 30-minute access token there means
anyone with log access holds a valid bearer token for that whole window.

A ticket fixes this: mint one (over a normal, header-authenticated POST),
it's valid for 60 seconds and exactly one WebSocket connection attempt, then
it's gone - a log line containing it is useless within a minute either way.

Stored in Redis (not in-memory) so ticket issuance and redemption work
correctly regardless of which worker process/replica handles each request.
"""
import secrets

from app.core.redis_client import async_redis_client

TICKET_TTL_SECONDS = 60
_KEY_PREFIX = "ws_ticket:"


async def issue_ticket(user_id: int) -> str:
    ticket = secrets.token_urlsafe(32)
    await async_redis_client.set(f"{_KEY_PREFIX}{ticket}", str(user_id), ex=TICKET_TTL_SECONDS)
    return ticket


async def redeem_ticket(ticket: str) -> int | None:
    """GETDEL makes this atomically single-use: two connection attempts
    racing on the same ticket can't both succeed."""
    user_id = await async_redis_client.getdel(f"{_KEY_PREFIX}{ticket}")
    return int(user_id) if user_id else None
