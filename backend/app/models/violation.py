import enum
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ViolationType(str, enum.Enum):
    tab_switch = "tab_switch"
    fullscreen_exit = "fullscreen_exit"
    copy_paste_attempt = "copy_paste_attempt"
    other = "other"


class Violation(Base):
    __tablename__ = "violations"

    id: Mapped[int] = mapped_column(primary_key=True)
    attempt_id: Mapped[int] = mapped_column(ForeignKey("exam_attempts.id"), nullable=False)
    type: Mapped[ViolationType] = mapped_column(
        SAEnum(ViolationType, name="violation_type", native_enum=False), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    attempt = relationship("ExamAttempt", back_populates="violations")
