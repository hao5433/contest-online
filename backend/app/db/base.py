"""Shared SQLAlchemy declarative base. All models import this so they end up
registered on the same metadata object (used by Alembic's autogenerate)."""
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase


class Base(AsyncAttrs, DeclarativeBase):
    """AsyncAttrs gives every model an `.awaitable_attrs.<relationship>`
    accessor - a safety net for the rare relationship access that isn't
    covered by an explicit eager-load (selectinload/joinedload) at the query
    site. Prefer eager-loading in the query itself; reach for
    `await obj.awaitable_attrs.thing` only where that's awkward."""

    pass
