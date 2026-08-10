from pydantic import BaseModel, ConfigDict, field_validator

from app.models.question import Difficulty, QuestionType
from app.schemas.choice import ChoiceCreate, ChoiceRead
from app.schemas.common import UTCDateTime


class QuestionBase(BaseModel):
    subject_id: int
    chapter_id: int | None = None
    content: str
    difficulty: Difficulty
    question_type: QuestionType
    image_url: str | None = None


class QuestionCreate(QuestionBase):
    choices: list[ChoiceCreate]

    @field_validator("choices")
    @classmethod
    def at_least_two_choices(cls, v: list[ChoiceCreate]) -> list[ChoiceCreate]:
        if len(v) < 2:
            raise ValueError("A question needs at least 2 choices")
        return v


class QuestionUpdate(QuestionCreate):
    pass


class QuestionRead(QuestionBase):
    """Management view (teacher/admin only): includes is_correct on choices."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    created_by: int
    is_approved: bool
    created_at: UTCDateTime
    choices: list[ChoiceRead]


class QuestionListRead(BaseModel):
    """Paginated envelope for GET /api/questions, matching the frontend's Paginated<T> contract."""

    items: list[QuestionRead]
    total: int
    page: int
    page_size: int
