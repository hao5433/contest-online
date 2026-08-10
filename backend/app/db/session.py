"""Async SQLAlchemy engine/session setup and the `get_db` FastAPI dependency
used by every route that touches the database.

Alembic (backend/alembic/env.py) intentionally keeps a *separate, sync*
engine - migrations are a one-off CLI operation, not a concurrency-sensitive
request path, so there's no reason to drag async into that tool. Both read
the same settings.DATABASE_URL; only the driver name differs.
"""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

ASYNC_DATABASE_URL = settings.DATABASE_URL.replace("postgresql+psycopg2", "postgresql+asyncpg")

# Same pool sizing rationale as before (see git history) - 15+10 per worker
# process comfortably fits under Postgres's default max_connections=100 for
# up to ~5 uvicorn workers.
engine = create_async_engine(
    ASYNC_DATABASE_URL,
    pool_pre_ping=True,
    pool_size=15,
    max_overflow=10,
)

# expire_on_commit=False: without it, every attribute access after a commit
# re-triggers a lazy load - which, in async code, only works through
# `awaitable_attrs` (see db/base.py), not a bare attribute access. Turning
# it off means "the object you already have in hand stays readable after
# commit()" - the standard recommendation for async SQLAlchemy sessions.
SessionLocal = async_sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as db:
        yield db
