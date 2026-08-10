"""Small shared helpers for turning low-level DB errors into clean HTTP errors."""
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


async def commit_or_400(db: AsyncSession, message: str = "This record is still referenced by other data") -> None:
    """Commits the current transaction, converting an IntegrityError (e.g. a
    foreign key violation from deleting a row still referenced elsewhere)
    into a clean 400 instead of a raw 500."""
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
