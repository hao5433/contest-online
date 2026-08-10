from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, require_role
from app.db.session import get_db
from app.models.answer_change_log import AnswerChangeLog
from app.models.attempt_answer import AttemptAnswer
from app.models.exam import Exam, ExamStatus
from app.models.exam_attempt import AttemptStatus, ExamAttempt
from app.models.question import Question
from app.models.user import User, UserRole
from app.routers.ws import manager, monitor_room
from app.schemas.attempt import (
    AnswerChangeLogOut,
    AnswerRead,
    AnswerRequest,
    AttemptChoiceOut,
    AttemptQuestionOut,
    AttemptSummaryOut,
    ResultChoiceOut,
    ResultQuestionOut,
    ResultResponse,
    StartAttemptResponse,
    ViolationRequest,
)
from app.services.grading import compute_end_at, ensure_not_expired, record_violation, submit_attempt
from app.services.shuffling import seeded_shuffle

router = APIRouter(prefix="/api", tags=["attempts"])


async def _get_attempt_or_404(db: AsyncSession, attempt_id: int) -> ExamAttempt:
    attempt = await db.get(ExamAttempt, attempt_id)
    if not attempt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attempt not found")
    return attempt


async def _require_owning_student_in_progress(db: AsyncSession, attempt: ExamAttempt, current_user: User) -> None:
    if attempt.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your attempt")
    await ensure_not_expired(db, attempt)
    if attempt.status != AttemptStatus.in_progress:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Attempt is no longer in progress")


async def _build_attempt_questions(db: AsyncSession, attempt: ExamAttempt) -> list[AttemptQuestionOut]:
    """Renders the question list for a student mid-exam: no is_correct flags,
    and choices shuffled per-attempt (seeded by attempt id + question id) if
    the exam has shuffle_choices enabled."""
    exam = await attempt.awaitable_attrs.exam
    questions_out = []
    for question_id in attempt.question_order:
        question = await db.get(Question, question_id, options=[selectinload(Question.choices)])
        choices = list(question.choices)
        if exam.shuffle_choices:
            choices = seeded_shuffle(attempt.id * 1_000_003 + question_id, choices)
        questions_out.append(
            AttemptQuestionOut(
                id=question.id,
                content=question.content,
                image_url=question.image_url,
                question_type=question.question_type,
                choices=[AttemptChoiceOut(id=c.id, content=c.content) for c in choices],
            )
        )
    return questions_out


@router.post("/exams/{exam_id}/start", response_model=StartAttemptResponse)
async def start_attempt(
    exam_id: int,
    current_user: User = Depends(require_role(UserRole.student)),
    db: AsyncSession = Depends(get_db),
):
    """Validates the exam is published and within its start/end window,
    then creates (or resumes) an ExamAttempt with a shuffled question_order.
    A student gets exactly one attempt per exam: reusing this endpoint while
    an attempt is still in_progress simply resumes it; calling it again
    after submission is rejected.
    """
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")
    if exam.status != ExamStatus.published:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exam is not open for attempts")

    now = datetime.utcnow()
    if exam.start_time and now < exam.start_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exam has not started yet")
    if exam.end_time and now > exam.end_time:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Exam has already ended")

    async def _fetch_existing() -> ExamAttempt | None:
        result = await db.execute(
            select(ExamAttempt)
            .where(ExamAttempt.exam_id == exam_id, ExamAttempt.student_id == current_user.id)
            .order_by(ExamAttempt.id.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    existing = await _fetch_existing()
    if existing:
        await ensure_not_expired(db, existing)
        if existing.status != AttemptStatus.in_progress:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You have already attempted this exam")
        attempt = existing
    else:
        attempt = ExamAttempt(
            exam_id=exam_id,
            student_id=current_user.id,
            started_at=now,
            status=AttemptStatus.in_progress,
            question_order=exam.question_ids,
        )
        db.add(attempt)
        try:
            await db.flush()  # assigns attempt.id, used below as the shuffle seed
        except IntegrityError:
            # Lost a race with another /start call for this same
            # (exam_id, student_id) - both requests saw "no existing
            # attempt" before either committed (double-click, two open
            # tabs, a retried request). uq_exam_attempts_exam_student is
            # what actually stops the duplicate row; this just turns the
            # loser's crash into the same "resume/reject" outcome the
            # winner got, instead of a raw 500.
            await db.rollback()
            existing = await _fetch_existing()
            if existing is None:
                raise  # constraint fired but the row it points to is gone - genuinely unexpected
            await ensure_not_expired(db, existing)
            if existing.status != AttemptStatus.in_progress:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="You have already attempted this exam"
                )
            attempt = existing
        else:
            if exam.shuffle_questions:
                attempt.question_order = seeded_shuffle(attempt.id, exam.question_ids)
            await db.commit()
            await db.refresh(attempt)

    return StartAttemptResponse(
        attempt_id=attempt.id,
        end_at=await compute_end_at(attempt),
        questions=await _build_attempt_questions(db, attempt),
    )


@router.get("/attempts/me", response_model=list[AttemptSummaryOut])
async def list_my_attempts(
    current_user: User = Depends(require_role(UserRole.student)),
    db: AsyncSession = Depends(get_db),
):
    """The student's own attempt history, for the 'Lịch sử làm bài' section
    on their home page."""
    result = await db.execute(
        select(ExamAttempt)
        .options(selectinload(ExamAttempt.exam))
        .where(ExamAttempt.student_id == current_user.id)
        .order_by(ExamAttempt.id.desc())
    )
    attempts = result.scalars().all()
    out = []
    for attempt in attempts:
        await ensure_not_expired(db, attempt)  # so a stale in_progress row reflects reality
        out.append(
            AttemptSummaryOut(
                attempt_id=attempt.id,
                exam_id=attempt.exam_id,
                exam_title=attempt.exam.title,
                score=attempt.score,
                submitted_at=attempt.submitted_at,
                status="in_progress" if attempt.status == AttemptStatus.in_progress else "submitted",
            )
        )
    return out


async def _upsert_answer(
    db: AsyncSession, attempt_id: int, current_user: User, payload: AnswerRequest
) -> tuple[AttemptAnswer, int, int, int]:
    """Returns (answer, exam_id, answered_count, total_questions)."""
    attempt = await _get_attempt_or_404(db, attempt_id)
    await _require_owning_student_in_progress(db, attempt, current_user)

    if payload.question_id not in attempt.question_order:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Question is not part of this attempt")

    result = await db.execute(
        select(AttemptAnswer).where(
            AttemptAnswer.attempt_id == attempt_id, AttemptAnswer.question_id == payload.question_id
        )
    )
    answer = result.scalar_one_or_none()
    if answer is None:
        answer = AttemptAnswer(attempt_id=attempt_id, question_id=payload.question_id)
        db.add(answer)
    answer.selected_choice_ids = payload.selected_choice_ids
    answer.answered_at = datetime.utcnow()
    # AttemptAnswer only ever holds the *current* selection (overwritten
    # above) - this append-only log is what lets a teacher later see the
    # full history of changes to this question, not just where it ended up.
    db.add(
        AnswerChangeLog(
            attempt_id=attempt_id, question_id=payload.question_id, selected_choice_ids=payload.selected_choice_ids
        )
    )
    await db.commit()
    await db.refresh(answer)

    count_result = await db.execute(
        select(func.count()).select_from(AttemptAnswer).where(AttemptAnswer.attempt_id == attempt_id)
    )
    return answer, attempt.exam_id, count_result.scalar_one(), len(attempt.question_order)


@router.post("/attempts/{attempt_id}/answer", response_model=AnswerRead)
async def submit_answer(
    attempt_id: int,
    payload: AnswerRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upserts an AttemptAnswer - autosave only, no grading happens here."""
    answer, exam_id, answered_count, total_questions = await _upsert_answer(db, attempt_id, current_user, payload)
    await manager.broadcast(
        monitor_room(exam_id),
        {
            "type": "progress",
            "attempt_id": attempt_id,
            "student_name": current_user.full_name,
            "answered_count": answered_count,
            "total_questions": total_questions,
        },
    )
    return answer


def _exam_still_open(exam: Exam) -> bool:
    """True while other students could still be taking this exam - i.e. it
    hasn't been closed by the teacher and its end_time (if any) hasn't
    passed yet. Used to withhold per-question detail from an early finisher
    so they can't leak correct answers to classmates still in progress."""
    if exam.status == ExamStatus.closed:
        return False
    if exam.end_time is not None and datetime.utcnow() > exam.end_time:
        return False
    return True


@router.post("/attempts/{attempt_id}/submit", response_model=ResultResponse)
async def submit_attempt_endpoint(
    attempt_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    attempt = await _get_attempt_or_404(db, attempt_id)
    if attempt.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your attempt")
    if attempt.status == AttemptStatus.in_progress:
        await submit_attempt(db, attempt)
    exam = await attempt.awaitable_attrs.exam
    reveal_details = not _exam_still_open(exam)
    return await _build_result(db, attempt, reveal_details=reveal_details)


@router.get("/attempts/{attempt_id}/result", response_model=ResultResponse)
async def get_result(
    attempt_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    attempt = await _get_attempt_or_404(db, attempt_id)
    is_owner = attempt.student_id == current_user.id
    is_staff = current_user.role in (UserRole.teacher, UserRole.admin)
    if not is_owner and not is_staff:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to view this attempt")

    # Auto-submit-on-expiry check, so a student can't dodge grading just by
    # never calling /submit.
    await ensure_not_expired(db, attempt)

    if is_owner and not is_staff and attempt.status == AttemptStatus.in_progress:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Attempt is still in progress")

    # Staff (reviewing/grading) always sees full detail; a student only once
    # the exam is closed to everyone.
    exam = await attempt.awaitable_attrs.exam
    reveal_details = is_staff or not _exam_still_open(exam)
    return await _build_result(db, attempt, reveal_details=reveal_details)


async def _build_result(db: AsyncSession, attempt: ExamAttempt, reveal_details: bool) -> ResultResponse:
    questions_out = []
    if reveal_details:
        answers = await attempt.awaitable_attrs.answers
        answers_by_question = {answer.question_id: answer for answer in answers}
        # Prefer the frozen snapshot taken at grading time, so editing a
        # question afterwards never changes what an already-graded attempt's
        # result page shows. Older attempts graded before this column existed
        # have no snapshot - fall back to a live lookup for those only.
        snapshot_by_question = (
            {q["id"]: q for q in attempt.question_snapshot} if attempt.question_snapshot else {}
        )
        for question_id in attempt.question_order:
            answer = answers_by_question.get(question_id)
            snap = snapshot_by_question.get(question_id)
            if snap is not None:
                content, question_type, choices = (
                    snap["content"],
                    snap["question_type"],
                    [ResultChoiceOut(id=c["id"], content=c["content"], is_correct=c["is_correct"]) for c in snap["choices"]],
                )
            else:
                question = await db.get(Question, question_id, options=[selectinload(Question.choices)])
                content, question_type, choices = (
                    question.content,
                    question.question_type,
                    [ResultChoiceOut(id=c.id, content=c.content, is_correct=c.is_correct) for c in question.choices],
                )
            questions_out.append(
                ResultQuestionOut(
                    id=question_id,
                    content=content,
                    question_type=question_type,
                    choices=choices,
                    selected_choice_ids=answer.selected_choice_ids if answer else [],
                    is_correct=bool(answer.is_correct) if answer else False,
                )
            )
    return ResultResponse(
        attempt_id=attempt.id,
        status=attempt.status,
        score=attempt.score,
        details_locked=not reveal_details,
        total_questions=len(attempt.question_order),
        submitted_at=attempt.submitted_at,
        violation_count=attempt.violation_count,
        questions=questions_out,
    )


@router.delete("/attempts/{attempt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def reset_attempt(
    attempt_id: int,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Deletes a student's attempt entirely (answers/violations cascade with
    it), letting them call POST /exams/{id}/start again for a clean retry.
    Meant for a student hitting a technical issue mid-exam, or for re-testing
    during development - there's no confirmation/undo, so the frontend should
    confirm before calling this."""
    attempt = await _get_attempt_or_404(db, attempt_id)
    await db.delete(attempt)
    await db.commit()


# Below this, a change is flagged "suspiciously fast" - answered without
# plausibly having had time to read the question. Arbitrary but defensible;
# tune per exam difficulty if this turns out too noisy/too lax in practice.
FAST_ANSWER_THRESHOLD_SECONDS = 3.0


@router.get("/attempts/{attempt_id}/answer-log", response_model=list[AnswerChangeLogOut])
async def get_answer_change_log(
    attempt_id: int,
    current_user: User = Depends(require_role(UserRole.teacher, UserRole.admin)),
    db: AsyncSession = Depends(get_db),
):
    """Full history of every answer-save on this attempt, in order - not
    just where each question ended up (that's AttemptAnswer/the result page)
    but every change along the way, with timing. Surfaces two signals the
    final answers alone never show: pacing (answered way too fast to have
    read the question) and revision bursts (changed an answer repeatedly,
    often right before submitting - more consistent with checking against
    an outside source than reconsidering)."""
    attempt = await _get_attempt_or_404(db, attempt_id)
    result = await db.execute(
        select(AnswerChangeLog)
        .where(AnswerChangeLog.attempt_id == attempt_id)
        .order_by(AnswerChangeLog.changed_at, AnswerChangeLog.id)
    )
    logs = result.scalars().all()

    seen_questions: set[int] = set()
    previous_at = attempt.started_at
    out = []
    for log in logs:
        delta = (log.changed_at - previous_at).total_seconds()
        out.append(
            AnswerChangeLogOut(
                question_id=log.question_id,
                selected_choice_ids=log.selected_choice_ids,
                changed_at=log.changed_at,
                seconds_since_previous=delta,
                suspiciously_fast=delta < FAST_ANSWER_THRESHOLD_SECONDS,
                is_revision=log.question_id in seen_questions,
            )
        )
        seen_questions.add(log.question_id)
        previous_at = log.changed_at
    return out


async def _record_violation(db: AsyncSession, attempt_id: int, current_user: User, payload: ViolationRequest):
    attempt = await _get_attempt_or_404(db, attempt_id)
    await _require_owning_student_in_progress(db, attempt, current_user)
    violation = await record_violation(db, attempt, payload.type)
    return violation, attempt.exam_id, attempt.violation_count


@router.post("/attempts/{attempt_id}/violation", status_code=status.HTTP_201_CREATED)
async def report_violation(
    attempt_id: int,
    payload: ViolationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    violation, exam_id, violation_count = await _record_violation(db, attempt_id, current_user, payload)

    await manager.broadcast(
        monitor_room(exam_id),
        {
            "type": "violation",
            "attempt_id": attempt_id,
            "student_name": current_user.full_name,
            "violation_type": violation.type.value,
            "count": violation_count,
        },
    )
    return {"id": violation.id, "violation_count": violation_count}
