from sqlalchemy import ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Chapter(Base):
    __tablename__ = "chapters"

    id: Mapped[int] = mapped_column(primary_key=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id"), nullable=False)
    name: Mapped[str] = mapped_column(nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    subject = relationship("Subject", back_populates="chapters")
    questions = relationship("Question", back_populates="chapter")
