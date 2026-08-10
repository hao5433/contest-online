"""DB-backed refresh token issuance, rotation, and revocation.

Unlike the access token (a stateless JWT nothing here ever touches), a
refresh token is an opaque random string. Only its SHA-256 hash is stored,
mirroring password hashing - a DB leak alone shouldn't let anyone use these.
SHA-256 (not bcrypt) is deliberate: this is a high-entropy random token, not
a human-chosen password, so it doesn't need slow hashing to resist brute
force, and a fast hash keeps every refresh call cheap.
"""
import hashlib
import secrets
from datetime import datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.refresh_token import RefreshToken
from app.models.user import User


def _hash(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


async def issue_refresh_token(db: AsyncSession, user_id: int) -> str:
    raw_token = secrets.token_urlsafe(48)
    db.add(
        RefreshToken(
            user_id=user_id,
            token_hash=_hash(raw_token),
            expires_at=datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
    )
    await db.commit()
    return raw_token


async def revoke_all_for_user(db: AsyncSession, user_id: int) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.utcnow())
    )
    await db.commit()


async def revoke_token(db: AsyncSession, raw_token: str) -> None:
    """Used by logout - a no-op (not an error) if the token is already
    unknown/expired/revoked, since the end state the caller wants (this
    token no longer works) is already true."""
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == _hash(raw_token)))
    row = result.scalar_one_or_none()
    if row and row.revoked_at is None:
        row.revoked_at = datetime.utcnow()
        await db.commit()


async def rotate_refresh_token(db: AsyncSession, raw_token: str) -> tuple[User, str] | None:
    """Validates `raw_token`, then atomically revokes it and issues a
    replacement - so each refresh token is single-use. Returns
    (user, new_raw_token), or None if the token is unknown/expired.

    Reuse detection: if the token was already revoked *by a prior rotation*
    (row.rotated is True) and someone presents it again, that's a signal an
    attacker has a copy of a token the legitimate client already moved past -
    every refresh token for that user gets revoked so both the attacker and
    the legitimate client are forced to log in again. A token revoked via
    plain logout (rotated=False) doesn't trigger this - that's an expected,
    intentional revocation, not a compromise signal.
    """
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == _hash(raw_token)))
    row = result.scalar_one_or_none()
    if row is None or row.expires_at < datetime.utcnow():
        return None

    if row.revoked_at is not None:
        if row.rotated:
            await revoke_all_for_user(db, row.user_id)
        return None

    user = await db.get(User, row.user_id)
    if user is None or not user.is_active:
        return None

    row.revoked_at = datetime.utcnow()
    row.rotated = True
    new_raw_token = await issue_refresh_token(db, user.id)
    await db.commit()
    return user, new_raw_token
