import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import DEFAULT_DEV_JWT_SECRET, settings
from app.routers import attempts, auth, classrooms, exams, questions, subjects, users, ws
from app.services.submit_queue import ensure_consumer_group

logger = logging.getLogger("app.startup")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.JWT_SECRET_KEY == DEFAULT_DEV_JWT_SECRET:
        # Anyone who has read this codebase (or its README/git history) knows
        # this string - if it's still in effect, every JWT in the system is
        # forgeable. Loud by design; only ever expected on a fresh local
        # clone before `.env` is filled in.
        logger.warning(
            "SECURITY WARNING: JWT_SECRET_KEY is still the well-known default (%r). "
            "Anyone can forge access tokens for any user/role. Set a unique JWT_SECRET_KEY "
            "in .env before exposing this outside local development.",
            DEFAULT_DEV_JWT_SECRET,
        )
    # Schema is managed by Alembic now (backend/alembic/) - docker-compose's
    # backend command runs `alembic upgrade head` before starting uvicorn, so
    # by the time this lifespan runs the DB is already at the latest revision.

    # One subscriber loop per worker process - see the module docstring in
    # app/routers/ws.py for why this is what makes WebSocket broadcasts reach
    # connections held by *other* worker processes.
    subscriber_task = asyncio.create_task(ws.redis_subscriber_loop())
    # Idempotent - safe even if the `worker` service (app/worker.py) already
    # created this consumer group, or hasn't started yet. Doing it here too
    # means a submit can be queued (and nothing missed) even before any
    # worker process is up.
    await ensure_consumer_group()
    yield
    subscriber_task.cancel()
    try:
        # cancel() only *requests* cancellation - without awaiting the task,
        # we never actually confirm it finished. If the task's cancellation
        # doesn't complete promptly (redis pubsub not responding to
        # CancelledError while blocked in listen(), for instance - this is
        # exactly what caused a real hang: WatchFiles-triggered reloads and
        # `docker compose restart` both got stuck at uvicorn's "Waiting for
        # background tasks to complete" with no timeout, leaving the whole
        # backend unresponsive), the process would otherwise wait forever.
        # A bounded wait_for turns "hang forever" into "give up after 5s".
        await asyncio.wait_for(subscriber_task, timeout=5)
    except (asyncio.CancelledError, asyncio.TimeoutError):
        pass


app = FastAPI(title="Online Exam System API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(users.teacher_router)
app.include_router(classrooms.router)
app.include_router(subjects.router)
app.include_router(subjects.chapter_router)
app.include_router(questions.router)
app.include_router(exams.router)
app.include_router(attempts.router)
app.include_router(ws.router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
