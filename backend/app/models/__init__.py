"""Import every model so they all register on Base.metadata before
Base.metadata.create_all() is called in main.py / seed.py."""
from app.models.answer_change_log import AnswerChangeLog
from app.models.attempt_answer import AttemptAnswer
from app.models.chapter import Chapter
from app.models.choice import Choice
from app.models.class_enrollment import ClassEnrollment
from app.models.classroom import Classroom
from app.models.exam import Exam, ExamStatus
from app.models.exam_attempt import AttemptStatus, ExamAttempt
from app.models.question import Difficulty, Question, QuestionType
from app.models.refresh_token import RefreshToken
from app.models.subject import Subject
from app.models.user import User, UserRole
from app.models.violation import Violation, ViolationType

__all__ = [
    "User",
    "UserRole",
    "RefreshToken",
    "AnswerChangeLog",
    "Subject",
    "Chapter",
    "Question",
    "Difficulty",
    "QuestionType",
    "Choice",
    "Classroom",
    "ClassEnrollment",
    "Exam",
    "ExamStatus",
    "ExamAttempt",
    "AttemptStatus",
    "AttemptAnswer",
    "Violation",
    "ViolationType",
]
