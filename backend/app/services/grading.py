"""Grading, deadline, and violation-recording logic shared by the REST
attempts router and the WebSocket handlers."""
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.exam_attempt import AttemptStatus, ExamAttempt
from app.models.question import Question
from app.models.violation import Violation, ViolationType


async def compute_end_at(attempt: ExamAttempt) -> datetime:
    """The attempt's hard deadline: started_at + the exam's duration_minutes.

    Uses `awaitable_attrs` for `.exam` rather than requiring every caller to
    have eager-loaded it - this function gets called from enough different
    places (REST handlers, the WS tick loop) that relying on each call site
    remembering the right `selectinload` would be fragile."""
    exam = await attempt.awaitable_attrs.exam
    return attempt.started_at + timedelta(minutes=exam.duration_minutes)


def _is_answer_correct(choices: list, selected_choice_ids: list[int]) -> bool:
    """Exact-match grading for both single_choice and multi_choice: the set of
    selected choice ids must equal the set of correct choice ids exactly."""
    correct_ids = {choice.id for choice in choices if choice.is_correct}
    return set(selected_choice_ids) == correct_ids


async def mark_submitted(db: AsyncSession, attempt: ExamAttempt) -> None:
    """Phase 1 of a 2-phase submit: flips status to `submitted` and stamps
    `submitted_at` - a single, cheap UPDATE, no grading work at all. The
    REST endpoint (routers/attempts.py:submit_attempt_endpoint) does this
    and returns immediately; the actual grading (submit_attempt, below)
    runs asynchronously in app/worker.py, picked up off a Redis Streams
    queue. This is what decouples "student clicked nộp bài" from "the
    attempt is actually graded" - the request never blocks on grading, so
    a burst of simultaneous submits (e.g. everyone hitting the deadline at
    once) queues up instead of piling directly onto the database inside
    hundreds/thousands of concurrent request-response cycles.

    A no-op if the attempt isn't in_progress - calling /submit again on an
    already-submitted/graded attempt shouldn't re-enqueue it."""
    if attempt.status != AttemptStatus.in_progress:
        return
    attempt.status = AttemptStatus.submitted
    attempt.submitted_at = datetime.utcnow()
    await db.commit()


async def submit_attempt(db: AsyncSession, attempt: ExamAttempt) -> ExamAttempt:
    """Grades every answer, computes the percentage score, and marks the
    attempt as graded. Idempotent - calling it again on an already-graded
    attempt is a no-op.

    Also freezes a snapshot of each question's content/choices into
    `attempt.question_snapshot` - if a teacher edits or re-approves a
    question later, this attempt's result page keeps showing what was
    actually true at grading time instead of silently changing."""
    if attempt.status == AttemptStatus.graded:
        return attempt

    answers = await attempt.awaitable_attrs.answers
    answers_by_question = {answer.question_id: answer for answer in answers}
    total = len(attempt.question_order)
    correct_count = 0
    snapshot = []

    for question_id in attempt.question_order:
        answer = answers_by_question.get(question_id)
        question = await db.get(Question, question_id, options=[selectinload(Question.choices)])
        is_correct = _is_answer_correct(question.choices, answer.selected_choice_ids or []) if answer else False
        if answer is not None:
            answer.is_correct = is_correct
        if is_correct:
            correct_count += 1
        snapshot.append(
            {
                "id": question.id,
                "content": question.content,
                "question_type": question.question_type.value,
                "choices": [
                    {"id": c.id, "content": c.content, "is_correct": c.is_correct} for c in question.choices
                ],
            }
        )

    attempt.score = round((correct_count / total) * 100, 2) if total else 0.0
    attempt.status = AttemptStatus.graded
    attempt.submitted_at = datetime.utcnow()
    attempt.question_snapshot = snapshot
    await db.commit()
    await db.refresh(attempt)
    return attempt


async def ensure_not_expired(db: AsyncSession, attempt: ExamAttempt) -> ExamAttempt:
    """Auto-submits the attempt if the exam's time window has already
    elapsed. Called on every read/write touching an in_progress attempt (the
    submit endpoint, the answer endpoint, the result endpoint, and the
    per-attempt WebSocket loop) so a student can never keep answering, or
    keep the result hidden, past their deadline."""
    if attempt.status == AttemptStatus.in_progress and datetime.utcnow() > await compute_end_at(attempt):
        await submit_attempt(db, attempt)
    return attempt


async def record_violation(db: AsyncSession, attempt: ExamAttempt, violation_type: ViolationType) -> Violation:
    attempt.violation_count += 1
    violation = Violation(attempt_id=attempt.id, type=violation_type)
    db.add(violation)
    await db.commit()
    await db.refresh(violation)
    return violation
