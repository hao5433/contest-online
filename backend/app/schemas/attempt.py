from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.models.exam_attempt import AttemptStatus
from app.models.question import QuestionType
from app.models.violation import ViolationType
from app.schemas.common import UTCDateTime


class AttemptChoiceOut(BaseModel):
    """Choice as delivered to a student mid-exam: never includes is_correct."""

    id: int
    content: str


class AttemptQuestionOut(BaseModel):
    id: int
    content: str
    image_url: str | None
    question_type: QuestionType
    choices: list[AttemptChoiceOut]


class StartAttemptResponse(BaseModel):
    attempt_id: int
    end_at: UTCDateTime
    questions: list[AttemptQuestionOut]


class AnswerRequest(BaseModel):
    question_id: int
    selected_choice_ids: list[int]


class AnswerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question_id: int
    selected_choice_ids: list[int]
    answered_at: UTCDateTime


class ResultChoiceOut(BaseModel):
    id: int
    content: str
    is_correct: bool


class ResultQuestionOut(BaseModel):
    id: int
    content: str
    question_type: QuestionType
    choices: list[ResultChoiceOut]
    selected_choice_ids: list[int]
    is_correct: bool


class ResultResponse(BaseModel):
    attempt_id: int
    status: AttemptStatus
    score: float | None
    submitted_at: UTCDateTime | None
    violation_count: int
    # True while the exam is still open to other students (not yet closed and
    # not past its end_time) - per-question correct-answer detail is withheld
    # from the student in that case (score is still shown), so an early
    # finisher can't leak answers to classmates still taking the exam.
    # Always False for the teacher/admin view.
    details_locked: bool = False
    total_questions: int
    questions: list[ResultQuestionOut]


class ViolationRequest(BaseModel):
    type: ViolationType


class AttemptListItemOut(BaseModel):
    """One row of GET /api/exams/{exam_id}/attempts - the teacher/admin-facing
    roster of who has attempted an exam, used to reset a stuck/duplicate attempt."""

    attempt_id: int
    student_id: int
    student_name: str
    student_email: str
    status: AttemptStatus
    score: float | None
    submitted_at: UTCDateTime | None
    violation_count: int
    # e.g. {"tab_switch": 2, "fullscreen_exit": 1} - violation_count alone
    # (a bare number) told a teacher *that* something happened but never
    # *what*, during the exam or after it was over. The type was always
    # recorded (Violation.type) - it just never made it into any response.
    violations_by_type: dict[str, int]


class AnswerChangeLogOut(BaseModel):
    """One row of GET /api/attempts/{id}/answer-log - the full history of a
    student's answer to each question, in order, not just where each one
    ended up. `seconds_since_previous`/`suspiciously_fast` are computed
    relative to whatever came right before it (the previous answer save, or
    the attempt's start for the very first one) - a real gap-detector for
    "answered every question in under 2 seconds each", which the final
    answers alone can never show."""

    question_id: int
    selected_choice_ids: list[int]
    changed_at: UTCDateTime
    seconds_since_previous: float
    suspiciously_fast: bool
    # False the first time a question is answered, True on every
    # subsequent change to that same question - a burst of these right
    # before submitting is a distinct signal from "answered quickly"
    # (checking an answer against an outside source, not reconsidering it).
    is_revision: bool


class AttemptSummaryOut(BaseModel):
    """One row of a student's own attempt history (GET /api/attempts/me).

    `status` is collapsed to the 3 buckets the frontend renders - the model's
    'graded' state (set whether the student submitted manually or the server
    auto-submitted on expiry) is reported as 'submitted' here.
    """

    attempt_id: int
    exam_id: int
    exam_title: str
    score: float | None
    submitted_at: UTCDateTime | None
    status: Literal["in_progress", "submitted", "expired"]
