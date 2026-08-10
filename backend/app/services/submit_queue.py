"""Redis Streams queue that decouples "student clicked nộp bài" from "the
attempt is actually graded" - see app/worker.py for the consumer side and
grading.py's mark_submitted for why this exists.

Why a stream, not a plain list (LPUSH/BLPOP): a plain queue has no notion of
"this item is currently being worked on". If a worker crashes mid-grading,
an item it popped is just gone - that attempt would sit at status=submitted
forever, never graded. A stream + consumer group tracks delivery: an entry
stays in the group's "pending" set (visible via XPENDING) until a worker
XACKs it, so a crashed worker's unfinished entries can be reclaimed by
another worker (see worker.py's xautoclaim call) instead of silently lost.
"""
from app.core.redis_client import async_redis_client

STREAM_KEY = "submit_queue"
CONSUMER_GROUP = "graders"


async def ensure_consumer_group() -> None:
    """Idempotent - safe to call from both the API process (main.py's
    lifespan) and every worker process on startup, in any order. `id="0"`
    means a newly created group starts from the beginning of the stream, so
    no message added before the group existed is missed."""
    try:
        await async_redis_client.xgroup_create(STREAM_KEY, CONSUMER_GROUP, id="0", mkstream=True)
    except Exception as exc:
        if "BUSYGROUP" not in str(exc):
            raise


async def enqueue_submission(attempt_id: int) -> None:
    await async_redis_client.xadd(STREAM_KEY, {"attempt_id": str(attempt_id)})
