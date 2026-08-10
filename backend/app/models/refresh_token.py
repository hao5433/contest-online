from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RefreshToken(Base):
    """A DB-backed, revocable refresh token - unlike the access token (a
    stateless JWT), this is what makes "log out everywhere" / "revoke a
    stolen session" possible. Only the SHA-256 hash of the raw token is
    stored (mirrors password hashing - a DB leak alone shouldn't let anyone
    use these tokens); the raw value is only ever returned to the client
    once, at issuance.

    Rotated on every use (see services/auth.py::rotate_refresh_token): each
    row is single-use. `revoked_at` set without a normal rotation flow (i.e.
    someone replayed an already-used token) is treated as a compromise
    signal - see the reuse-detection note in rotate_refresh_token.
    """

    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # True only for the row that replaced this one via rotation - lets reuse
    # detection distinguish "normal rotation" from "someone replayed a used token".
    rotated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user = relationship("User")
