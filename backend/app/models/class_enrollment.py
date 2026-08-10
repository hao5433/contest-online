from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ClassEnrollment(Base):
    """A student's membership in a classroom (many-to-many with an audit timestamp)."""

    __tablename__ = "class_enrollments"
    __table_args__ = (UniqueConstraint("classroom_id", "student_id", name="uq_classroom_student"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    classroom_id: Mapped[int] = mapped_column(ForeignKey("classrooms.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    classroom = relationship("Classroom", back_populates="enrollments")
    student = relationship("User")
