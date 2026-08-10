from sqlalchemy import Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    chapters = relationship("Chapter", back_populates="subject", cascade="all, delete-orphan")
    questions = relationship("Question", back_populates="subject", cascade="all, delete-orphan")
    exams = relationship("Exam", back_populates="subject")
