from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.user import UserRole
from app.schemas.common import UTCDateTime


class UserBase(BaseModel):
    email: EmailStr
    full_name: str


class UserCreate(UserBase):
    """Used by the admin-only POST /api/users - can create teacher or admin
    accounts (unlike public /api/auth/register, which is always student)."""

    password: str = Field(min_length=6)
    role: UserRole = UserRole.teacher


class UserUpdate(BaseModel):
    is_active: bool | None = None
    role: UserRole | None = None
    full_name: str | None = None


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: UserRole
    is_active: bool
    created_at: UTCDateTime


class ResetPasswordOut(BaseModel):
    """Returned once, in the response body only - the caller (admin/teacher)
    is responsible for relaying this to the student out-of-band (in person,
    Zalo/chat, etc.). Nothing about this password is stored anywhere except
    as the new bcrypt hash on the user row."""

    email: str
    temporary_password: str
