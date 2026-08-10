import enum
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ExamStatus(str, enum.Enum):
    draft = "draft"
    published = "published"
    closed = "closed"


class Exam(Base):
    __tablename__ = "exams"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    # NULL = visible to every student (the original, still-default behavior).
    # Set = only students enrolled in that classroom can see/take this exam.
    classroom_id: Mapped[int | None] = mapped_column(ForeignKey("classrooms.id"), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    # e.g. {"easy": 5, "medium": 3, "hard": 2}
    difficulty_distribution: Mapped[dict] = mapped_column(JSON, nullable=False)
    # The fixed pool of question ids randomly selected for this exam at
    # creation time (matching subject + difficulty_distribution). Every
    # attempt draws its question_order from this pool.
    question_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    shuffle_choices: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    start_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    end_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[ExamStatus] = mapped_column(
        SAEnum(ExamStatus, name="exam_status", native_enum=False), default=ExamStatus.draft, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    subject = relationship("Subject", back_populates="exams")
    creator = relationship("User")
    classroom = relationship("Classroom", back_populates="exams")
    attempts = relationship("ExamAttempt", back_populates="exam", cascade="all, delete-orphan")
