from pydantic import BaseModel, ConfigDict


class ChoiceCreate(BaseModel):
    content: str
    is_correct: bool = False
    order_index: int = 0


class ChoiceRead(BaseModel):
    """Management view (teacher/admin only): includes is_correct. Never used
    to deliver questions to a student mid-exam - see schemas/attempt.py."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    content: str
    is_correct: bool
    order_index: int
