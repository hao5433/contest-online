"""Native FastAPI WebSocket endpoints for the exam-room deadline enforcement
(auto-submit) and the teacher/admin live-monitoring dashboard.

Connections are authenticated with a short-lived ticket (see
app/services/ws_tickets.py), not the raw JWT access token - a token in a
WebSocket URL's query string ends up written verbatim into access logs.

Broadcasting goes through Redis pub/sub (`ConnectionManager.broadcast`
publishes; every worker process's `redis_subscriber_loop` delivers to its
own locally-held connections). This is what makes a violation reported to
whichever worker handled that REST call actually reach a teacher's monitor
connection that landed on a *different* worker - a purely in-memory version
could only ever deliver within one process.

All DB access here is native async (see app/db/session.py) - no
run_in_threadpool needed anymore; that was only ever a workaround for the
old sync psycopg2 driver blocking the event loop.
"""
import asyncio
import json
import secrets

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.core.redis_client import async_redis_client
from app.db.session import SessionLocal
from app.models.exam_attempt import AttemptStatus, ExamAttempt
from app.models.user import User, UserRole
from app.models.violation import ViolationType
from app.services.grading import ensure_not_expired, record_violation
from app.services.ws_tickets import redeem_ticket

router = APIRouter(tags=["websocket"])

EXPIRY_CHECK_INTERVAL_SECONDS = 5
PUBSUB_CHANNEL = "ws:broadcast"

# "Single active exam-room session" - a student opening the exam room on a
# second device/tab while the first is already live (e.g. laptop already in
# the exam, phone opened to get help/answers from someone else) shouldn't
# get a second live connection: the anti-cheat signal here isn't the
# WebSocket itself, it's making sure there's only ever one "device actively
# watching this exam room" at a time. Backed by Redis (not an in-memory set)
# for the same cross-worker reason as everything else in this file - the two
# connection attempts can land on different worker processes.
_SESSION_LOCK_PREFIX = "attempt_session:"
_SESSION_LOCK_TTL_SECONDS = 20  # safety net only - the holder releases its own lock on disconnect (see the `finally` in attempt_socket); this just bounds how long a hard crash (no clean close) can lock a student out of reconnecting on another device


class ConnectionManager:
    """Tracks active WebSocket connections *held by this process*, grouped by
    an arbitrary room key. Cross-process fan-out is Redis's job (see
    broadcast/deliver_local below) - a WebSocket object itself can never be
    shared across processes, so each process only ever manages its own.
    """

    def __init__(self) -> None:
        self.rooms: dict[str, set[WebSocket]] = {}

    async def connect(self, room: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.rooms.setdefault(room, set()).add(websocket)

    def disconnect(self, room: str, websocket: WebSocket) -> None:
        connections = self.rooms.get(room)
        if connections and websocket in connections:
            connections.discard(websocket)
            if not connections:
                self.rooms.pop(room, None)

    async def broadcast(self, room: str, message: dict) -> None:
        """Publishes to Redis - every worker process's subscriber loop
        (including this one, for consistency) picks it up and delivers to
        whatever local connections it's actually holding for `room`."""
        await async_redis_client.publish(PUBSUB_CHANNEL, json.dumps({"room": room, "message": message}))

    async def deliver_local(self, room: str, message: dict) -> None:
        """Sends to this process's own connections only. Never call this
        directly to "broadcast" something - only the subscriber loop should,
        so that events reach every process's connections uniformly regardless
        of which process the event originated on."""
        for websocket in list(self.rooms.get(room, set())):
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect(room, websocket)


manager = ConnectionManager()


async def redis_subscriber_loop() -> None:
    """Started once per worker process from main.py's lifespan. Runs for the
    life of the process; cancelled on shutdown."""
    pubsub = async_redis_client.pubsub()
    await pubsub.subscribe(PUBSUB_CHANNEL)
    try:
        async for raw_message in pubsub.listen():
            if raw_message["type"] != "message":
                continue
            try:
                data = json.loads(raw_message["data"])
                await manager.deliver_local(data["room"], data["message"])
            except Exception:
                continue  # a single malformed/failed delivery shouldn't kill the whole loop
    finally:
        # Cancellation lands here as a CancelledError raised out of
        # pubsub.listen() while it's blocked mid-read - which can leave the
        # underlying connection unable to complete a clean protocol
        # round-trip. unsubscribe() sends a command and waits for a reply on
        # that same connection; if the connection is in that state, the
        # reply never comes and this await hangs forever - which previously
        # meant the whole server (this task's caller waits on it, with no
        # timeout at the time) could never finish shutting down. Bounded so
        # a wedged connection can't do that again; the process is exiting
        # either way, so leaking this one pubsub object is harmless.
        try:
            await asyncio.wait_for(pubsub.unsubscribe(PUBSUB_CHANNEL), timeout=3)
        except Exception:
            pass


def monitor_room(exam_id: int) -> str:
    return f"exam:{exam_id}:monitor"


def _attempt_room(attempt_id: int) -> str:
    return f"attempt:{attempt_id}"


async def _claim_session_lock(attempt_id: int) -> str | None:
    """Tries to become the sole active connection for this attempt. Returns
    a session token to hold onto (pass to _refresh/_release_session_lock)
    on success, or None if another connection already holds it."""
    session_id = secrets.token_urlsafe(16)
    key = f"{_SESSION_LOCK_PREFIX}{attempt_id}"
    acquired = await async_redis_client.set(key, session_id, nx=True, ex=_SESSION_LOCK_TTL_SECONDS)
    return session_id if acquired else None


async def _refresh_session_lock(attempt_id: int, session_id: str) -> None:
    """Renews the TTL - called from the same periodic loop that already
    checks the deadline, so a long-running legitimate connection never lets
    the lock expire out from under it."""
    key = f"{_SESSION_LOCK_PREFIX}{attempt_id}"
    current = await async_redis_client.get(key)
    if current == session_id:  # don't renew a lock that isn't ours anymore
        await async_redis_client.expire(key, _SESSION_LOCK_TTL_SECONDS)


async def _release_session_lock(attempt_id: int, session_id: str) -> None:
    """Only clears the lock if it still holds *our* token - if it doesn't
    (TTL already expired and someone else claimed it before we got here),
    deleting it would kick out a connection that isn't even ours to kick."""
    key = f"{_SESSION_LOCK_PREFIX}{attempt_id}"
    current = await async_redis_client.get(key)
    if current == session_id:
        await async_redis_client.delete(key)


async def _authorize_attempt_connection(attempt_id: int, ticket: str) -> int | None:
    """Returns a WebSocket close code if the connection should be rejected,
    else None."""
    user_id = await redeem_ticket(ticket)
    if user_id is None:
        return 4401

    db = SessionLocal()
    try:
        attempt = await db.get(ExamAttempt, attempt_id)
        if attempt is None:
            return 4404
        if attempt.student_id != user_id:
            return 4403
        return None
    finally:
        await db.close()


async def _authorize_monitor_connection(ticket: str) -> int | None:
    user_id = await redeem_ticket(ticket)
    if user_id is None:
        return 4401

    db = SessionLocal()
    try:
        user = await db.get(User, user_id)
        if user is None or user.role not in (UserRole.teacher, UserRole.admin):
            return 4403
        return None
    finally:
        await db.close()


async def _attempt_has_expired(attempt_id: int) -> bool:
    """True once the attempt is no longer in_progress - either because its
    deadline just passed (ensure_not_expired grades it as a side effect
    right here) or because it was already graded/gone some other way.

    The frontend computes and displays its own countdown from `end_at`
    (sent once, at start) - it doesn't need the server to also push a tick
    every few seconds. What *does* need this to run periodically is
    ensure_not_expired's auto-submit: without something re-checking on a
    timer, an attempt only gets graded whenever a request happens to touch
    it (answer/submit/result) - a student who stops interacting right at
    the deadline would otherwise sit in `in_progress` indefinitely."""
    db = SessionLocal()
    try:
        attempt = await db.get(ExamAttempt, attempt_id)
        if attempt is None:
            return True
        await ensure_not_expired(db, attempt)
        return attempt.status != AttemptStatus.in_progress
    finally:
        await db.close()


@router.websocket("/ws/attempts/{attempt_id}")
async def attempt_socket(websocket: WebSocket, attempt_id: int, ticket: str = Query(...)):
    """Student side. Requires a one-time `?ticket=` minted via
    POST /api/auth/ws-ticket (not the raw access token - see module
    docstring). Only the owning student may connect.

    Re-checks the deadline every ~5s (see _attempt_has_expired) and, once it
    passes, pushes {"type": "time_up"} and closes (auto-submitting the
    attempt server-side). No periodic "tick" is sent - the frontend already
    counts down on its own from `end_at`, so there's nothing for one to do
    beyond what the local countdown already shows. Accepts
    {"type": "violation", "violation_type": "..."} from the client,
    persisted the same way as POST /api/attempts/{id}/violation.

    Only one such connection may be live for a given attempt at a time
    (see _claim_session_lock) - a second device/tab trying to open the same
    exam room while the first is already connected gets rejected with
    close code 4409, instead of two devices both getting a live view into
    the same attempt.
    """
    close_code = await _authorize_attempt_connection(attempt_id, ticket)
    if close_code is not None:
        # Closing *before* accept() only ever surfaces to the client as a
        # bare HTTP 403 during the handshake - browsers (and most WS client
        # libraries) can't read a status code off a failed handshake, so the
        # custom 4401/4403/4404 codes below would never actually reach
        # frontend error-handling code. Accept first, then close with the
        # real code - that completes the handshake as a normal WS close
        # frame, which `onclose.code` (browser) / `ConnectionClosed.code`
        # (websockets lib) can both read.
        await websocket.accept()
        await websocket.close(code=close_code)
        return

    session_id = await _claim_session_lock(attempt_id)
    if session_id is None:
        await websocket.accept()
        await websocket.close(code=4409)  # already connected from another device/tab
        return

    await manager.connect(_attempt_room(attempt_id), websocket)

    async def receive_loop() -> None:
        try:
            while True:
                raw = await websocket.receive_text()
                broadcast = await _handle_client_message(attempt_id, raw)
                if broadcast is not None:
                    exam_id, message = broadcast
                    await manager.broadcast(monitor_room(exam_id), message)
        except WebSocketDisconnect:
            pass

    receiver_task = asyncio.create_task(receive_loop())
    try:
        while True:
            if await _attempt_has_expired(attempt_id):
                await websocket.send_json({"type": "time_up"})
                await websocket.close()
                break
            await _refresh_session_lock(attempt_id, session_id)
            await asyncio.sleep(EXPIRY_CHECK_INTERVAL_SECONDS)
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        receiver_task.cancel()
        manager.disconnect(_attempt_room(attempt_id), websocket)
        await _release_session_lock(attempt_id, session_id)


async def _handle_client_message(attempt_id: int, raw: str) -> tuple[int, dict] | None:
    """Returns (exam_id, message) for the caller to broadcast."""
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return None
    if data.get("type") != "violation":
        return None

    db = SessionLocal()
    try:
        attempt = await db.get(ExamAttempt, attempt_id)
        if attempt is None or attempt.status != AttemptStatus.in_progress:
            return None
        try:
            violation_type = ViolationType(data.get("violation_type", "other"))
        except ValueError:
            violation_type = ViolationType.other
        await record_violation(db, attempt, violation_type)
        exam_id = attempt.exam_id
        student = await attempt.awaitable_attrs.student
        student_name = student.full_name
        violation_count = attempt.violation_count
    finally:
        await db.close()

    return exam_id, {
        "type": "violation",
        "attempt_id": attempt_id,
        "student_name": student_name,
        "violation_type": violation_type.value,
        "count": violation_count,
    }


@router.websocket("/ws/exams/{exam_id}/monitor")
async def exam_monitor_socket(websocket: WebSocket, exam_id: int, ticket: str = Query(...)):
    """Teacher/admin side. Verifies the role behind the `?ticket=` before
    accepting the connection, then just relays whatever attempts.py / the
    attempt socket broadcasts into this exam's room: violation and progress
    events."""
    close_code = await _authorize_monitor_connection(ticket)
    if close_code is not None:
        # See the matching comment in attempt_socket above - same reason.
        await websocket.accept()
        await websocket.close(code=close_code)
        return

    await manager.connect(monitor_room(exam_id), websocket)
    try:
        while True:
            await websocket.receive_text()  # monitor is read-only; just detect disconnects
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(monitor_room(exam_id), websocket)
