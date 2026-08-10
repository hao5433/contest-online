from pydantic import BaseModel, ConfigDict, EmailStr

from app.schemas.common import UTCDateTime


class ClassroomCreate(BaseModel):
    name: str


class ClassroomUpdate(BaseModel):
    name: str


class ClassroomRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    teacher_id: int
    created_at: UTCDateTime
    student_count: int = 0


class EnrollStudentRequest(BaseModel):
    """Enroll by email - a teacher building a roster knows the student's
    email, not their internal id."""

    email: EmailStr


class EnrolledStudentOut(BaseModel):
    student_id: int
    full_name: str
    email: str
    enrolled_at: UTCDateTime


class ImportRowError(BaseModel):
    row: int  # Excel row number (header = row 1)
    email: str | None
    message: str


class CreatedAccountOut(BaseModel):
    """A brand-new student account made during import - the teacher needs to
    hand this password to the student since there's no email delivery or
    self-service reset flow yet."""

    email: str
    full_name: str
    temporary_password: str


class ImportStudentsResult(BaseModel):
    created: list[CreatedAccountOut]
    enrolled_existing: int
    already_enrolled: int
    errors: list[ImportRowError]
