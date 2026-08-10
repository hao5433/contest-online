import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.deps import require_role
from app.core.errors import commit_or_400
from app.core.security import hash_password
from app.db.session import get_db
from app.models.class_enrollment import ClassEnrollment
from app.models.classroom import Classroom
from app.models.user import User, UserRole
from app.schemas.classroom import (
    ClassroomCreate,
    ClassroomRead,
    ClassroomUpdate,
    CreatedAccountOut,
    EnrolledStudentOut,
    EnrollStudentRequest,
    ImportRowError,
    ImportStudentsResult,
)

router = APIRouter(prefix="/api/classrooms", tags=["classrooms"])

# Shared default password for bulk-imported accounts (matches the seed demo
# student's password, so it's a familiar convention in this codebase). Safe
# to use now that POST /api/auth/change-password exists - the teacher should
# tell students to change it after first login.
DEFAULT_IMPORTED_PASSWORD = "Student123!"


async def _get_classroom_or_404(db: AsyncSession, classroom_id: int) -> Classroom:
    classroom = await db.get(Classroom, classroom_id)
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")
    return classroom


def _require_owner_or_admin(classroom: Classroom, current_user: User) -> None:
    """A teacher only manages their own classrooms; admin manages any."""
    if current_user.role != UserRole.admin and classroom.teacher_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your classroom")


def _to_read(classroom: Classroom, student_count: int) -> ClassroomRead:
    return ClassroomRead(
        id=classroom.id,
        name=classroom.name,
        teacher_id=classroom.teacher_id,
        created_at=classroom.created_at,
        student_count=student_count,
    )


@router.get("", response_model=list[ClassroomRead])
async def list_classrooms(
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    query = select(Classroom)
    if current_user.role == UserRole.teacher:
        query = query.where(Classroom.teacher_id == current_user.id)
    classrooms = (await db.execute(query.order_by(Classroom.id.desc()))).scalars().all()

    # One grouped query for every classroom's student count instead of a
    # separate COUNT per row (N+1 - noticeable once a teacher has many classes).
    count_rows = await db.execute(
        select(ClassEnrollment.classroom_id, func.count(ClassEnrollment.id))
        .where(ClassEnrollment.classroom_id.in_([c.id for c in classrooms]))
        .group_by(ClassEnrollment.classroom_id)
    )
    counts = dict(count_rows.all())
    return [_to_read(c, counts.get(c.id, 0)) for c in classrooms]


@router.post("", response_model=ClassroomRead, status_code=status.HTTP_201_CREATED)
async def create_classroom(
    payload: ClassroomCreate,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    classroom = Classroom(name=payload.name, teacher_id=current_user.id)
    db.add(classroom)
    await db.commit()
    await db.refresh(classroom)
    return _to_read(classroom, 0)


async def _student_count(db: AsyncSession, classroom_id: int) -> int:
    result = await db.execute(
        select(func.count()).select_from(ClassEnrollment).where(ClassEnrollment.classroom_id == classroom_id)
    )
    return result.scalar_one()


@router.get("/{classroom_id}", response_model=ClassroomRead)
async def get_classroom(
    classroom_id: int,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    classroom = await _get_classroom_or_404(db, classroom_id)
    _require_owner_or_admin(classroom, current_user)
    return _to_read(classroom, await _student_count(db, classroom_id))


@router.put("/{classroom_id}", response_model=ClassroomRead)
async def update_classroom(
    classroom_id: int,
    payload: ClassroomUpdate,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    classroom = await _get_classroom_or_404(db, classroom_id)
    _require_owner_or_admin(classroom, current_user)
    classroom.name = payload.name
    await db.commit()
    await db.refresh(classroom)
    return _to_read(classroom, await _student_count(db, classroom_id))


@router.delete("/{classroom_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_classroom(
    classroom_id: int,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    classroom = await _get_classroom_or_404(db, classroom_id)
    _require_owner_or_admin(classroom, current_user)
    await db.delete(classroom)
    # Exams referencing this classroom keep classroom_id set to it - deleting
    # would violate that FK, so this correctly 400s until they're reassigned.
    await commit_or_400(db, "Cannot delete: this classroom still has exams assigned to it")


@router.get("/{classroom_id}/students", response_model=list[EnrolledStudentOut])
async def list_enrolled_students(
    classroom_id: int,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    classroom = await _get_classroom_or_404(db, classroom_id)
    _require_owner_or_admin(classroom, current_user)
    result = await db.execute(
        select(ClassEnrollment)
        .options(joinedload(ClassEnrollment.student))  # 1 query instead of 1-per-row for e.student below
        .where(ClassEnrollment.classroom_id == classroom_id)
        .order_by(ClassEnrollment.id)
    )
    return [
        EnrolledStudentOut(
            student_id=e.student_id,
            full_name=e.student.full_name,
            email=e.student.email,
            enrolled_at=e.enrolled_at,
        )
        for e in result.scalars().all()
    ]


@router.post("/{classroom_id}/students", response_model=EnrolledStudentOut, status_code=status.HTTP_201_CREATED)
async def enroll_student(
    classroom_id: int,
    payload: EnrollStudentRequest,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    classroom = await _get_classroom_or_404(db, classroom_id)
    _require_owner_or_admin(classroom, current_user)

    result = await db.execute(select(User).where(User.email == payload.email))
    student = result.scalar_one_or_none()
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No user with this email")
    if student.role != UserRole.student:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This user is not a student")

    enrollment = ClassEnrollment(classroom_id=classroom_id, student_id=student.id)
    db.add(enrollment)
    await commit_or_400(db, "This student is already enrolled in this classroom")
    await db.refresh(enrollment)
    return EnrolledStudentOut(
        student_id=student.id,
        full_name=student.full_name,
        email=student.email,
        enrolled_at=enrollment.enrolled_at,
    )


@router.post(
    "/{classroom_id}/students/import",
    response_model=ImportStudentsResult,
    status_code=status.HTTP_201_CREATED,
)
async def import_students(
    classroom_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Bulk-adds students to a classroom from an Excel workbook (.xlsx).

    Expected header row (case-insensitive), one row per student:

        full_name   (required)
        email       (required)
        password    (optional - if omitted, new accounts get the shared
                      default password DEFAULT_IMPORTED_PASSWORD; students
                      should change it via POST /api/auth/change-password
                      after their first login)

    A row whose email already belongs to a student account just enrolls that
    existing account (its full_name/password columns are ignored) - only a
    brand-new email gets a new account created. Each row is isolated with a
    savepoint, so one bad row (duplicate email used by a teacher account,
    missing field, ...) doesn't block the rest of the import.
    """
    classroom = await _get_classroom_or_404(db, classroom_id)
    _require_owner_or_admin(classroom, current_user)

    try:
        df = pd.read_excel(file.file)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Could not read Excel file: {exc}")

    df.columns = [str(c).strip().lower() for c in df.columns]
    required_columns = {"full_name", "email"}
    missing = required_columns - set(df.columns)
    if missing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Missing required columns: {sorted(missing)}")

    created: list[CreatedAccountOut] = []
    enrolled_existing = 0
    already_enrolled = 0
    errors: list[ImportRowError] = []

    def _cell(row, key: str) -> str:
        value = row.get(key)
        if value is None or pd.isna(value):
            return ""
        return str(value).strip()

    for row_idx, row in df.iterrows():
        excel_row_number = row_idx + 2  # +1 for 0-index, +1 for the header row
        email = _cell(row, "email")
        full_name = _cell(row, "full_name")

        if not email or "@" not in email:
            errors.append(ImportRowError(row=excel_row_number, email=email or None, message="Email thiếu hoặc không hợp lệ"))
            continue
        if not full_name:
            errors.append(ImportRowError(row=excel_row_number, email=email, message="Thiếu họ tên"))
            continue

        try:
            async with db.begin_nested():
                result = await db.execute(select(User).where(User.email == email))
                student = result.scalar_one_or_none()
                if student is not None:
                    if student.role != UserRole.student:
                        raise ValueError("Email này đã được dùng cho một tài khoản không phải học sinh")
                    existing_result = await db.execute(
                        select(ClassEnrollment).where(
                            ClassEnrollment.classroom_id == classroom_id, ClassEnrollment.student_id == student.id
                        )
                    )
                    if existing_result.scalar_one_or_none() is not None:
                        already_enrolled += 1
                        continue
                    db.add(ClassEnrollment(classroom_id=classroom_id, student_id=student.id))
                    enrolled_existing += 1
                else:
                    password = _cell(row, "password") or DEFAULT_IMPORTED_PASSWORD
                    # bcrypt is CPU-bound - offload it so importing a big
                    # roster doesn't stall the event loop (and every other
                    # concurrent request on this worker) for the whole loop.
                    password_hash = await run_in_threadpool(hash_password, password)
                    student = User(email=email, password_hash=password_hash, full_name=full_name, role=UserRole.student)
                    db.add(student)
                    await db.flush()  # assigns student.id, needed for the enrollment row below
                    db.add(ClassEnrollment(classroom_id=classroom_id, student_id=student.id))
                    created.append(CreatedAccountOut(email=email, full_name=full_name, temporary_password=password))
        except ValueError as exc:
            errors.append(ImportRowError(row=excel_row_number, email=email, message=str(exc)))
        except Exception as exc:  # e.g. a duplicate-email race between two rows/requests
            errors.append(ImportRowError(row=excel_row_number, email=email, message=f"Lỗi không xác định: {exc}"))

    await db.commit()
    return ImportStudentsResult(
        created=created,
        enrolled_existing=enrolled_existing,
        already_enrolled=already_enrolled,
        errors=errors,
    )


@router.delete("/{classroom_id}/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unenroll_student(
    classroom_id: int,
    student_id: int,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    classroom = await _get_classroom_or_404(db, classroom_id)
    _require_owner_or_admin(classroom, current_user)

    result = await db.execute(
        select(ClassEnrollment).where(
            ClassEnrollment.classroom_id == classroom_id, ClassEnrollment.student_id == student_id
        )
    )
    enrollment = result.scalar_one_or_none()
    if enrollment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This student is not enrolled here")
    await db.delete(enrollment)
    await db.commit()
