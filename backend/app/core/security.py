"""Password hashing and JWT access/refresh token helpers."""
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def generate_temp_password() -> str:
    """One-off random password for admin/teacher-initiated password resets
    (see routers/users.py's reset_password) - unlike the shared
    DEFAULT_IMPORTED_PASSWORD used for bulk Excel-imported *new* accounts,
    a reset targets one already-existing account, so each reset gets its own
    unique value instead of a guessable constant. `secrets` (not `random`) -
    this ends up as a real, if temporary, account credential."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(10)) + "!"


def _create_token(subject: str, expires_delta: timedelta, token_type: str, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {"sub": subject, "type": token_type, "iat": now, "exp": now + expires_delta}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: int, role: str) -> str:
    return _create_token(
        str(user_id),
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "access",
        {"role": role},
    )


def decode_token(token: str) -> dict[str, Any]:
    """Decodes and verifies a JWT. Raises ValueError on any failure so callers
    don't need to know about python-jose's exception types."""
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc
