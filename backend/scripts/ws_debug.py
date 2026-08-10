"""Manual WebSocket debugging tool - connects as a student to an attempt
socket, or as a teacher/admin to an exam's monitor socket, and prints every
frame sent/received. Useful for checking the two WS endpoints in
app/routers/ws.py without needing the full browser UI.

Usage (run from the host, with the stack up via docker compose):

    cd backend
    python3 scripts/ws_debug.py attempt <attempt_id> <student_email> <password>
    python3 scripts/ws_debug.py monitor <exam_id> <teacher_or_admin_email> <password>

Requires `requests` and `websockets` (both already in requirements.txt) -
run inside the backend's venv/container, or `pip install requests websockets`
on the host.
"""
import asyncio
import json
import sys

import requests
import websockets

API = "http://localhost:8000/api"
WS = "ws://localhost:8000"


def login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    r.raise_for_status()
    return r.json()["access_token"]


def get_ticket(token: str) -> str:
    r = requests.post(f"{API}/auth/ws-ticket", headers={"Authorization": f"Bearer {token}"})
    r.raise_for_status()
    return r.json()["ticket"]


async def run(url: str) -> None:
    print(f"Connecting: {url}")
    try:
        async with websockets.connect(url) as ws:
            print("Connected. Listening for frames (Ctrl+C to quit)...")
            # For the attempt socket you can also type a JSON line + Enter to
            # send it (e.g. to simulate a violation) - stdin is read in a
            # background task so incoming frames still print live.
            async def send_loop():
                loop = asyncio.get_event_loop()
                while True:
                    line = await loop.run_in_executor(None, sys.stdin.readline)
                    if not line.strip():
                        continue
                    await ws.send(line.strip())
                    print(f">> sent: {line.strip()}")

            sender = asyncio.create_task(send_loop())
            try:
                async for raw in ws:
                    try:
                        print("<<", json.dumps(json.loads(raw), ensure_ascii=False))
                    except ValueError:
                        print("<<", raw)
            finally:
                sender.cancel()
    except websockets.exceptions.InvalidStatusCode as exc:
        print(f"Handshake rejected: HTTP {exc.status_code}")
    except websockets.exceptions.ConnectionClosed as exc:
        # Close codes used by app/routers/ws.py: 4401 = bad/expired/reused
        # ticket, 4403 = wrong role or attempt doesn't belong to this user,
        # 4404 = attempt not found.
        print(f"Connection closed: code={exc.code} reason={exc.reason!r}")


def main() -> None:
    if len(sys.argv) != 5:
        print(__doc__)
        sys.exit(1)
    mode, target_id, email, password = sys.argv[1:5]
    token = login(email, password)
    ticket = get_ticket(token)
    if mode == "attempt":
        url = f"{WS}/ws/attempts/{target_id}?ticket={ticket}"
    elif mode == "monitor":
        url = f"{WS}/ws/exams/{target_id}/monitor?ticket={ticket}"
    else:
        print(f"Unknown mode: {mode!r} (expected 'attempt' or 'monitor')")
        sys.exit(1)
    asyncio.run(run(url))


if __name__ == "__main__":
    main()
