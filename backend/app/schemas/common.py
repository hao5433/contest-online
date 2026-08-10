"""Shared Pydantic field types.

Every timestamp in this app (started_at, submitted_at, created_at, ...) is
generated with `datetime.utcnow()`, which returns a *naive* datetime - one
with no tzinfo attached, even though the value is UTC. Pydantic serializes a
naive datetime to JSON without any 'Z'/offset suffix (e.g. "2026-08-07T03:20:00"),
and browsers parse an ISO string with no timezone designator as *local* time,
not UTC (per the ECMA-262 Date Time String Format spec). For any user not in
UTC+0, that silently shifts every deadline/timestamp by their UTC offset -
in Vietnam (UTC+7), an exam's computed end_at lands ~7 hours in the past,
so the countdown reads 0 and auto-submits the instant the student starts.

`UTCDateTime` fixes this at the response-serialization boundary: it stamps a
naive datetime as UTC before formatting, so the wire format is always
unambiguous (ends in '+00:00'). Use this instead of bare `datetime` on every
*output* schema field that holds a server-generated timestamp.

`NaiveUTCInput` is the input-side counterpart, for fields like
ExamCreate/ExamUpdate's start_time/end_time. The frontend sends these with an
explicit 'Z' via `Date.toISOString()`, so Pydantic parses them as
*tz-aware* datetimes - but every DateTime column in this app is a plain
`timestamp without time zone` (see app/models/exam.py), and asyncpg (unlike
the old psycopg2 driver, which silently coerced this) hard-errors with
"can't subtract offset-naive and offset-aware datetimes" if you try to write
a tz-aware value into one. `NaiveUTCInput` converts to UTC and drops tzinfo
at parse time, before the value ever reaches the ORM.
"""
from datetime import datetime, timezone
from typing import Annotated

from pydantic import AfterValidator, PlainSerializer


def _as_utc_isoformat(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _to_naive_utc(value: datetime) -> datetime:
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


UTCDateTime = Annotated[datetime, PlainSerializer(_as_utc_isoformat, return_type=str, when_used="json")]
NaiveUTCInput = Annotated[datetime, AfterValidator(_to_naive_utc)]
