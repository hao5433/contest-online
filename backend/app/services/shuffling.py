"""Deterministic (seeded) shuffling used for both question order and choice
order, so a student sees the same layout on every reload of the same attempt."""
import random
from typing import TypeVar

T = TypeVar("T")


def seeded_shuffle(seed: int, items: list[T]) -> list[T]:
    """Fisher-Yates shuffle seeded by `seed`.

    Returns a new list; the input is not mutated. The same seed with the same
    input always yields the same output order, which is what makes a
    student's per-attempt question/choice order reproducible.
    """
    shuffled = list(items)
    rng = random.Random(seed)
    rng.shuffle(shuffled)
    return shuffled
