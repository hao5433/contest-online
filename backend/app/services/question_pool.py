"""Selects the fixed pool of approved questions an exam draws from, matching
subject + the requested per-difficulty counts."""
import random

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.question import Difficulty, Question


async def select_question_pool(db: AsyncSession, subject_id: int, difficulty_distribution: dict[str, int]) -> list[int]:
    """Randomly samples `count` approved question ids per difficulty bucket
    for the given subject.

    Raises ValueError (which the router should turn into an HTTP 400) if any
    bucket's approved pool is smaller than requested.
    """
    selected: list[int] = []
    for difficulty_name, count in difficulty_distribution.items():
        if count <= 0:
            continue
        try:
            difficulty = Difficulty(difficulty_name)
        except ValueError:
            raise ValueError(f"Unknown difficulty level: '{difficulty_name}'")

        result = await db.execute(
            select(Question.id).where(
                Question.subject_id == subject_id,
                Question.difficulty == difficulty,
                Question.is_approved.is_(True),
            )
        )
        pool_ids = [row[0] for row in result.all()]
        if len(pool_ids) < count:
            raise ValueError(
                f"Not enough approved '{difficulty_name}' questions for this subject: "
                f"need {count}, have {len(pool_ids)}"
            )
        selected.extend(random.sample(pool_ids, count))
    return selected
