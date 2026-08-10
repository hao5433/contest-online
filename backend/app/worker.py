"""Standalone consumer process for the submit queue (see
app/services/submit_queue.py) - grades exam attempts enqueued by
POST /api/attempts/{id}/submit, off the request/response path entirely.

Run with: python -m app.worker (docker-compose.yml runs this as its own
`worker` service, sharing the backend image). Scales independently of the
API tier: `docker compose up -d --scale worker=3` runs 3 of these against
the same Redis consumer group - each message is delivered to exactly one
of them, so more workers means the queue drains faster under a burst,
without touching the API tier at all.

Batches DB writes: reads up to BATCH_SIZE queued attempts at once and
grades them all inside one session before the next read, instead of a
separate connection checkout per attempt - the actual bottleneck at real
scale is Postgres write throughput, not this process's CPU, so fewer/larger
round-trips matter more than how fast this loop itself runs.
"""
import asyncio
import logging
import os
import secrets
import socket

from app.core.redis_client import async_redis_client
from app.db.session import SessionLocal
from app.models.exam_attempt import ExamAttempt
from app.services.grading import submit_attempt
from app.services.submit_queue import CONSUMER_GROUP, STREAM_KEY, ensure_consumer_group

logger = logging.getLogger("app.worker")

BATCH_SIZE = 20
BLOCK_MS = 2000
# Idle this long in another consumer's pending list (e.g. that worker
# process was killed mid-grading) before *this* consumer claims it instead -
# long enough that a slow-but-alive grading pass isn't mistaken for a dead
# worker, short enough that a real crash doesn't leave attempts stuck for
# more than half a minute.
RECLAIM_IDLE_MS = 30_000

CONSUMER_NAME = f"{socket.gethostname()}-{os.getpid()}-{secrets.token_hex(3)}"
# `os.getpid()` alone is *not* unique across replicas - each Docker Compose
# replica gets its own PID namespace, so the main process is always PID 1
# in every one of them (confirmed by seeing 3 replicas all log the same
# name before this fix). Two physical workers sharing one Redis consumer
# name would blur crash-recovery: XAUTOCLAIM's idle-time reclaim is tracked
# per consumer *name*, not per process, so a genuinely crashed replica's
# unfinished entries could look "covered" by a same-named replica that's
# actually still alive and fine. `socket.gethostname()` is the container's
# own hostname (unique per replica by default) - the random suffix on top
# means even a restarted replica with a reused hostname never collides with
# whatever name it (or another replica) held before.


async def _process_entries(entries: list[tuple[str, dict]]) -> None:
    """One DB session, one commit-per-attempt (submit_attempt's own commit) -
    but critically only ONE connection checked out for the whole batch
    instead of one per attempt."""
    db = SessionLocal()
    try:
        for message_id, fields in entries:
            attempt_id = int(fields["attempt_id"])
            try:
                attempt = await db.get(ExamAttempt, attempt_id)
                if attempt is not None:
                    await submit_attempt(db, attempt)  # idempotent - safe even if already graded
            except Exception:
                logger.exception("failed to grade attempt %s (message %s) - leaving unacked for retry", attempt_id, message_id)
                continue  # don't ack - stays pending, gets reclaimed and retried
            await async_redis_client.xack(STREAM_KEY, CONSUMER_GROUP, message_id)
    finally:
        await db.close()


async def run() -> None:
    await ensure_consumer_group()
    logger.info("submit-queue worker started: consumer=%s", CONSUMER_NAME)
    while True:
        # Reclaim first: entries some other (likely crashed) consumer never
        # ack'd after RECLAIM_IDLE_MS get picked up here before we ask for
        # anything new, so a dead worker's backlog doesn't just sit there.
        _cursor, claimed, _deleted = await async_redis_client.xautoclaim(
            STREAM_KEY, CONSUMER_GROUP, CONSUMER_NAME, min_idle_time=RECLAIM_IDLE_MS, count=BATCH_SIZE
        )
        if claimed:
            await _process_entries(claimed)
            continue

        result = await async_redis_client.xreadgroup(
            CONSUMER_GROUP, CONSUMER_NAME, {STREAM_KEY: ">"}, count=BATCH_SIZE, block=BLOCK_MS
        )
        if not result:
            continue
        for _stream_name, entries in result:
            await _process_entries(entries)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    asyncio.run(run())
