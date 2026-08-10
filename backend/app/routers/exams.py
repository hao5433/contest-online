from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_role
from app.core.errors import commit_or_400
from app.db.session import get_db
from app.models.class_enrollment import ClassEnrollment
from app.models.classroom import Classroom
from app.models.exam import Exam, ExamStatus
from app.models.exam_attempt import AttemptStatus, ExamAttempt
from app.models.subject import Subject
from app.models.user import User, UserRole
from app.schemas.attempt import AttemptListItemOut
from app.schemas.exam import (
    ExamCreate,
    ExamRead,
    ExamStatisticsRead,
    ExamUpdate,
    QuestionAccuracyOut,
    ScoreBucketOut,
)
from app.services import reports
from app.services.question_pool import select_question_pool

router = APIRouter(prefix="/api/exams", tags=["exams"])

_STATUS_TRANSITIONS = {
    ExamStatus.draft: {ExamStatus.published},
    ExamStatus.published: {ExamStatus.closed},
    ExamStatus.closed: set(),
}


async def _get_exam_or_404(db: AsyncSession, exam_id: int) -> Exam:
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    return exam


def _validate_status_transition(current: ExamStatus, target: ExamStatus) -> None:
    if target != current and target not in _STATUS_TRANSITIONS.get(current, set()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot move exam from '{current.value}' to '{target.value}'",
        )


@router.get("", response_model=list[ExamRead])
async def list_exams(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Teachers see their own exams (any status); admins see all; students see
    only published exams that are either unscoped (classroom_id is NULL - the
    original "visible to everyone" behavior) or scoped to a classroom they're
    enrolled in."""
    query = select(Exam)
    if current_user.role == UserRole.teacher:
        query = query.where(Exam.created_by == current_user.id)
    elif current_user.role == UserRole.student:
        enrolled_result = await db.execute(
            select(ClassEnrollment.classroom_id).where(ClassEnrollment.student_id == current_user.id)
        )
        enrolled_classroom_ids = [row[0] for row in enrolled_result.all()]
        query = query.where(
            Exam.status == ExamStatus.published,
            (Exam.classroom_id.is_(None)) | (Exam.classroom_id.in_(enrolled_classroom_ids)),
        )
    result = await db.execute(query.order_by(Exam.id.desc()))
    return result.scalars().all()


@router.post("", response_model=ExamRead, status_code=status.HTTP_201_CREATED)
async def create_exam(
    payload: ExamCreate,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """total_questions is derived as sum(difficulty_distribution.values()).
    The exam's fixed question pool is randomly sampled, at creation time,
    from approved questions matching subject + each requested difficulty
    (400 if any bucket's approved pool is smaller than requested)."""
    if not await db.get(Subject, payload.subject_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    if payload.classroom_id is not None:
        classroom = await db.get(Classroom, payload.classroom_id)
        if not classroom:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")
        if current_user.role == UserRole.teacher and classroom.teacher_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your classroom")

    try:
        question_ids = await select_question_pool(db, payload.subject_id, payload.difficulty_distribution)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    exam = Exam(
        title=payload.title,
        subject_id=payload.subject_id,
        created_by=current_user.id,
        classroom_id=payload.classroom_id,
        duration_minutes=payload.duration_minutes,
        total_questions=sum(payload.difficulty_distribution.values()),
        difficulty_distribution=payload.difficulty_distribution,
        question_ids=question_ids,
        shuffle_questions=payload.shuffle_questions,
        shuffle_choices=payload.shuffle_choices,
        start_time=payload.start_time,
        end_time=payload.end_time,
        status=ExamStatus.draft,
    )
    db.add(exam)
    await db.commit()
    await db.refresh(exam)
    return exam


@router.get("/{exam_id}", response_model=ExamRead)
async def get_exam(
    exam_id: int,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    return await _get_exam_or_404(db, exam_id)


@router.patch("/{exam_id}", response_model=ExamRead)
async def update_exam(
    exam_id: int,
    payload: ExamUpdate,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    exam = await _get_exam_or_404(db, exam_id)
    data = payload.model_dump(exclude_unset=True)
    if "status" in data:
        _validate_status_transition(exam.status, data["status"])
    if data.get("classroom_id") is not None:
        classroom = await db.get(Classroom, data["classroom_id"])
        if not classroom:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Classroom not found")
        if current_user.role == UserRole.teacher and classroom.teacher_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your classroom")
    for field, value in data.items():
        setattr(exam, field, value)
    await db.commit()
    await db.refresh(exam)
    return exam


@router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exam(
    exam_id: int,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    exam = await _get_exam_or_404(db, exam_id)
    await db.delete(exam)
    await commit_or_400(db, "Cannot delete this exam")


@router.get("/{exam_id}/attempts", response_model=list[AttemptListItemOut])
async def list_exam_attempts(
    exam_id: int,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """The roster of who has attempted this exam - lets a teacher find a
    student's attempt to reset it (DELETE /api/attempts/{attempt_id}), and
    see what kind of violations (not just how many) each student triggered."""
    await _get_exam_or_404(db, exam_id)
    result = await db.execute(
        select(ExamAttempt)
        .options(selectinload(ExamAttempt.student), selectinload(ExamAttempt.violations))
        .where(ExamAttempt.exam_id == exam_id)
        .order_by(ExamAttempt.id.desc())
    )
    attempts = result.scalars().all()
    out = []
    for a in attempts:
        breakdown: dict[str, int] = {}
        for v in a.violations:
            breakdown[v.type.value] = breakdown.get(v.type.value, 0) + 1
        out.append(
            AttemptListItemOut(
                attempt_id=a.id,
                student_id=a.student_id,
                student_name=a.student.full_name,
                student_email=a.student.email,
                status=a.status,
                score=a.score,
                submitted_at=a.submitted_at,
                violation_count=a.violation_count,
                violations_by_type=breakdown,
            )
        )
    return out


@router.get("/{exam_id}/statistics", response_model=ExamStatisticsRead)
async def exam_statistics(
    exam_id: int,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    exam = await _get_exam_or_404(db, exam_id)
    result = await db.execute(
        select(ExamAttempt)
        .options(selectinload(ExamAttempt.answers))
        .where(ExamAttempt.exam_id == exam_id, ExamAttempt.status == AttemptStatus.graded)
    )
    attempts = result.scalars().all()
    scores = [a.score for a in attempts if a.score is not None]
    avg_score = round(sum(scores) / len(scores), 2) if scores else 0.0
    # Fraction 0..1 - the frontend's charts (PassRateDonut, the StatCard %) multiply by 100 themselves.
    pass_rate = round(sum(1 for s in scores if s >= 50) / len(scores), 4) if scores else 0.0

    buckets = {"0-49": 0, "50-69": 0, "70-89": 0, "90-100": 0}
    for s in scores:
        if s < 50:
            buckets["0-49"] += 1
        elif s < 70:
            buckets["50-69"] += 1
        elif s < 90:
            buckets["70-89"] += 1
        else:
            buckets["90-100"] += 1

    return ExamStatisticsRead(
        attempt_count=len(attempts),
        avg_score=avg_score,
        pass_rate=pass_rate,
        score_distribution=[ScoreBucketOut(bucket=k, count=v) for k, v in buckets.items()],
        per_question_accuracy=_per_question_accuracy(exam, attempts),
    )


def _per_question_accuracy(exam: Exam, attempts: list[ExamAttempt]) -> list[QuestionAccuracyOut]:
    """Sync helper - safe to access `attempt.answers` here without an
    `await` because the caller eager-loaded it via `selectinload` above."""
    totals = {qid: 0 for qid in exam.question_ids}
    corrects = {qid: 0 for qid in exam.question_ids}
    for attempt in attempts:
        for answer in attempt.answers:
            if answer.question_id not in totals:
                continue
            totals[answer.question_id] += 1
            if answer.is_correct:
                corrects[answer.question_id] += 1
    # Fraction 0..1 - AccuracyChart multiplies by 100 itself for display.
    return [
        QuestionAccuracyOut(
            question_id=qid,
            accuracy=round(corrects[qid] / totals[qid], 4) if totals[qid] else 0.0,
        )
        for qid in exam.question_ids
    ]


@router.get("/{exam_id}/report/excel")
async def exam_report_excel(
    exam_id: int,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    exam = await _get_exam_or_404(db, exam_id)
    result = await db.execute(
        select(ExamAttempt).options(selectinload(ExamAttempt.student)).where(ExamAttempt.exam_id == exam_id)
    )
    buffer = reports.build_excel_report(exam.title, result.scalars().all())
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=exam_{exam_id}_report.xlsx"},
    )


@router.get("/{exam_id}/report/pdf")
async def exam_report_pdf(
    exam_id: int,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    exam = await _get_exam_or_404(db, exam_id)
    result = await db.execute(
        select(ExamAttempt).options(selectinload(ExamAttempt.student)).where(ExamAttempt.exam_id == exam_id)
    )
    buffer = reports.build_pdf_report(exam.title, result.scalars().all())
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=exam_{exam_id}_report.pdf"},
    )
