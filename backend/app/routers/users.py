from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.core.errors import commit_or_400
from app.core.security import generate_temp_password, hash_password
from app.db.session import get_db
from app.models.class_enrollment import ClassEnrollment
from app.models.classroom import Classroom
from app.models.user import User, UserRole
from app.schemas.user import ResetPasswordOut, UserCreate, UserRead, UserUpdate

router = APIRouter(
    prefix="/api/users",
    tags=["users"],
    dependencies=[Depends(require_role(UserRole.admin))],
)

# Separate router, deliberately *without* the admin-only dependency above -
# a teacher also needs this one endpoint (scoped to their own students), so
# it can't live on `router`, which every other /api/users route is locked to
# admin-only for good reason (see update_user's self-demotion guard, etc.).
teacher_router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserRead])
async def list_users(
    role: UserRole | None = None,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(User)
    if role is not None:
        query = query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    result = await db.execute(query.order_by(User.id))
    return result.scalars().all()


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Admin creates teacher/admin accounts (or another student, if desired)."""
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        email=payload.email,
        # bcrypt is CPU-bound - offload it so it doesn't stall the event loop
        # (and every other in-flight request on this worker) while it hashes.
        password_hash=await run_in_threadpool(hash_password, payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle is_active and/or change role."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    data = payload.model_dump(exclude_unset=True)
    if user_id == current_user.id:
        # An admin locking themselves out (demoting their own role, or
        # deactivating their own account) has no recovery path short of
        # someone editing the DB directly - which is exactly how this
        # account ended up stuck as "teacher" more than once during
        # development. Block it outright rather than relying on the UI to
        # never offer the option.
        if data.get("role") is not None and data["role"] != UserRole.admin:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot change your own role")
        if data.get("is_active") is False:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate your own account")

    for field, value in data.items():
        setattr(user, field, value)
    await commit_or_400(db)
    await db.refresh(user)
    return user


@teacher_router.post("/{user_id}/reset-password", response_model=ResetPasswordOut)
async def reset_password(
    user_id: int,
    current_user: User = Depends(require_role(UserRole.admin, UserRole.teacher)),
    db: AsyncSession = Depends(get_db),
):
    """A student who forgot their password can't self-serve (change-password
    needs the *current* password) and there's no email/SMS yet to automate
    a reset link - so this is the interim fix: an admin (anyone) or a
    teacher (only their own enrolled students) sets a new random temporary
    password and relays it to the student directly. The student should
    immediately use POST /api/auth/change-password to pick their own."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if current_user.role == UserRole.teacher:
        if user.role != UserRole.student:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teachers can only reset student passwords")
        enrolled = await db.execute(
            select(ClassEnrollment.id)
            .join(Classroom, Classroom.id == ClassEnrollment.classroom_id)
            .where(Classroom.teacher_id == current_user.id, ClassEnrollment.student_id == user_id)
        )
        if enrolled.first() is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This student is not enrolled in any of your classrooms",
            )

    temp_password = generate_temp_password()
    user.password_hash = await run_in_threadpool(hash_password, temp_password)
    await db.commit()
    return ResetPasswordOut(email=user.email, temporary_password=temp_password)
