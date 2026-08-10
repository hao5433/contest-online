import enum
from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AttemptStatus(str, enum.Enum):
    in_progress = "in_progress"
    submitted = "submitted"
    graded = "graded"


class ExamAttempt(Base):
    __tablename__ = "exam_attempts"
    # "One attempt per exam per student" was previously enforced only by a
    # SELECT-then-INSERT check in routers/attempts.py:start_attempt - which
    # is a classic TOCTOU race: two concurrent /start calls (double-click, 2
    # open tabs, a retried request) can both see "no existing attempt" and
    # both INSERT, before either commits. This actually happened in
    # production (two real students each ended up with a duplicate empty
    # attempt row). The DB constraint is the real fix; start_attempt also
    # catches the resulting IntegrityError to fail gracefully under a race
    # instead of leaking a 500 or a duplicate row.
    __table_args__ = (UniqueConstraint("exam_id", "student_id", name="uq_exam_attempts_exam_student"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[AttemptStatus] = mapped_column(
        SAEnum(AttemptStatus, name="attempt_status", native_enum=False),
        default=AttemptStatus.in_progress,
        nullable=False,
    )
    # Ordered list of question ids as presented to this specific student
    # (a per-attempt shuffle of the exam's fixed question pool).
    question_order: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    violation_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Frozen copy of each question's content/choices/is_correct, captured at
    # grading time - so editing a question later never changes what an
    # already-graded attempt's result page shows. NULL for attempts graded
    # before this column existed; _build_result falls back to a live lookup
    # for those (see app/routers/attempts.py).
    question_snapshot: Mapped[list | None] = mapped_column(JSON, nullable=True)

    exam = relationship("Exam", back_populates="attempts")
    student = relationship("User")
    answers = relationship("AttemptAnswer", back_populates="attempt", cascade="all, delete-orphan")
    violations = relationship("Violation", back_populates="attempt", cascade="all, delete-orphan")
    # Cascade matters here for the same reason as `answers`/`violations`
    # above: DELETE /attempts/{id} (reset_attempt) does `db.delete(attempt)`,
    # and there's no ON DELETE CASCADE at the DB level for any of these FKs -
    # it's this ORM-level cascade that cleans up the child rows. Forgetting
    # it here would make resetting an attempt that has any log entries fail
    # with a foreign key violation.
    answer_change_logs = relationship("AnswerChangeLog", cascade="all, delete-orphan")
