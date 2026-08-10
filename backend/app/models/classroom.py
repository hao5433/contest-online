from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Classroom(Base):
    """A teacher's class/cohort of students. Exams can optionally be scoped
    to a classroom (Exam.classroom_id) - only enrolled students then see
    that exam, instead of every student on the platform."""

    __tablename__ = "classrooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    teacher = relationship("User")
    enrollments = relationship("ClassEnrollment", back_populates="classroom", cascade="all, delete-orphan")
    exams = relationship("Exam", back_populates="classroom")
