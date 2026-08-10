from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.rate_limit import clear as clear_login_attempts
from app.core.rate_limit import is_locked_out, record_failure
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPairResponse,
    WsTicketResponse,
)
from app.schemas.user import UserRead
from app.services.refresh_tokens import issue_refresh_token, revoke_token, rotate_refresh_token
from app.services.ws_tickets import TICKET_TTL_SECONDS, issue_ticket

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> User:
    """Public self-registration always creates a STUDENT account. Admin and
    teacher accounts can only be created by an admin via POST /api/users."""
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        email=payload.email,
        # bcrypt is CPU-bound and takes ~150-300ms - run it off the event
        # loop thread so one hash in flight doesn't stall every other
        # concurrent request (DB queries included) being served by this
        # worker process in the meantime.
        password_hash=await run_in_threadpool(hash_password, payload.password),
        full_name=payload.full_name,
        role=UserRole.student,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenPairResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenPairResponse:
    rate_limit_key = payload.email.strip().lower()
    if await is_locked_out(rate_limit_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again in a few minutes.",
        )

    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    # Same run_in_threadpool rationale as register() above - login is the
    # hottest bcrypt call site (every user hits it), so this matters most here.
    if not user or not await run_in_threadpool(verify_password, payload.password, user.password_hash):
        await record_failure(rate_limit_key)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    await clear_login_attempts(rate_limit_key)
    return TokenPairResponse(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=await issue_refresh_token(db, user.id),
        token_type="bearer",
    )


@router.post("/refresh", response_model=TokenPairResponse)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenPairResponse:
    """Refresh tokens are single-use (rotated every call) - the response
    always carries a *new* refresh_token that the client must persist,
    replacing the one it just spent. Reusing an already-rotated token is
    treated as a compromise signal (see rotate_refresh_token) and revokes
    every refresh token for that user."""
    result = await rotate_refresh_token(db, payload.refresh_token)
    if result is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user, new_refresh_token = result

    return TokenPairResponse(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=new_refresh_token,
        token_type="bearer",
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(payload: LogoutRequest, db: AsyncSession = Depends(get_db)):
    """Revokes this one refresh token server-side (the access token stays
    valid until it naturally expires - stateless JWTs aren't revoked here).
    Always 204, even for an unknown/already-revoked token - the end state
    the caller wants is already true either way."""
    await revoke_token(db, payload.refresh_token)


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/ws-ticket", response_model=WsTicketResponse)
async def create_ws_ticket(current_user: User = Depends(get_current_user)) -> WsTicketResponse:
    """Mint a short-lived, single-use ticket for the WebSocket handshake
    (see app/services/ws_tickets.py for why - the access token can't go in a
    WS URL's query string without leaking into server access logs)."""
    return WsTicketResponse(ticket=await issue_ticket(current_user.id), expires_in=TICKET_TTL_SECONDS)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Self-service password change - lets a student move off a shared
    default password (e.g. one set by a teacher's bulk Excel import) without
    needing an admin. Existing JWTs stay valid until they expire (stateless
    tokens aren't revoked here); this only affects future logins."""
    if not await run_in_threadpool(verify_password, payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    current_user.password_hash = await run_in_threadpool(hash_password, payload.new_password)
    await db.commit()
