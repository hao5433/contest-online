from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AnswerChangeLog(Base):
    """One row per answer-save call (see routers/attempts.py:_upsert_answer),
    kept forever - unlike AttemptAnswer (which only ever holds the *current*
    selection per question, overwritten on every autosave), this is an
    append-only history: every time a student changes their answer to a
    question, when, and to what. Lets a teacher see "answered, then changed
    it 3 times in the last 30 seconds before submitting" - a pattern the
    final answer alone can never show, and a real anti-cheat signal (rapid
    back-and-forth right before the deadline often means checking an answer
    against an outside source, not reconsidering it)."""

    __tablename__ = "answer_change_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    attempt_id: Mapped[int] = mapped_column(ForeignKey("exam_attempts.id"), nullable=False, index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), nullable=False)
    selected_choice_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    attempt = relationship("ExamAttempt", back_populates="answer_change_logs")
