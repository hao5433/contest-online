import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Difficulty(str, enum.Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class QuestionType(str, enum.Enum):
    single_choice = "single_choice"
    multi_choice = "multi_choice"


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), nullable=False)
    chapter_id: Mapped[int | None] = mapped_column(ForeignKey("chapters.id"), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[Difficulty] = mapped_column(SAEnum(Difficulty, name="difficulty", native_enum=False), nullable=False)
    question_type: Mapped[QuestionType] = mapped_column(
        SAEnum(QuestionType, name="question_type", native_enum=False), nullable=False
    )
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    subject = relationship("Subject", back_populates="questions")
    chapter = relationship("Chapter", back_populates="questions")
    creator = relationship("User")
    choices = relationship(
        "Choice", back_populates="question", cascade="all, delete-orphan", order_by="Choice.order_index"
    )
