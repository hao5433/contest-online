from pydantic import BaseModel, ConfigDict, field_validator

from app.models.exam import ExamStatus
from app.schemas.common import NaiveUTCInput, UTCDateTime


class ExamCreate(BaseModel):
    title: str
    subject_id: int
    duration_minutes: int
    difficulty_distribution: dict[str, int]
    shuffle_questions: bool = True
    shuffle_choices: bool = True
    start_time: NaiveUTCInput | None = None
    end_time: NaiveUTCInput | None = None
    # None = visible to every student (unchanged default behavior). Set to
    # scope this exam to one classroom's enrolled students only.
    classroom_id: int | None = None

    @field_validator("difficulty_distribution")
    @classmethod
    def non_empty_distribution(cls, v: dict[str, int]) -> dict[str, int]:
        if not v or sum(v.values()) <= 0:
            raise ValueError("difficulty_distribution must specify at least 1 question")
        return v


class ExamUpdate(BaseModel):
    title: str | None = None
    duration_minutes: int | None = None
    shuffle_questions: bool | None = None
    shuffle_choices: bool | None = None
    start_time: NaiveUTCInput | None = None
    end_time: NaiveUTCInput | None = None
    status: ExamStatus | None = None
    classroom_id: int | None = None


class ExamRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    subject_id: int
    created_by: int
    duration_minutes: int
    total_questions: int
    difficulty_distribution: dict[str, int]
    shuffle_questions: bool
    shuffle_choices: bool
    start_time: UTCDateTime | None
    end_time: UTCDateTime | None
    status: ExamStatus
    classroom_id: int | None
    created_at: UTCDateTime


class ScoreBucketOut(BaseModel):
    bucket: str
    count: int


class QuestionAccuracyOut(BaseModel):
    question_id: int
    accuracy: float


class ExamStatisticsRead(BaseModel):
    attempt_count: int
    avg_score: float
    pass_rate: float  # fraction 0..1, matches the frontend's chart convention
    score_distribution: list[ScoreBucketOut]
    per_question_accuracy: list[QuestionAccuracyOut]
