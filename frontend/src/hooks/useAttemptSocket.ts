import { useCallback, useEffect, useRef, useState } from 'react';
import { buildAttemptSocketUrl } from '@/lib/ws';
import { getWsTicket } from '@/api/auth';
import type { ViolationType, WsAttemptServerMessage } from '@/types';

interface UseAttemptSocketOptions {
  attemptId: string | null;
  enabled: boolean;
  onTimeUp: () => void;
}

interface UseAttemptSocketResult {
  connected: boolean;
  /** True while the server has rejected this connection because the exam
   * room is already open live on another device/tab (close code 4409).
   * Distinct from `!connected` during a normal reconnect blip. */
  conflict: boolean;
  sendViolation: (violationType: ViolationType) => void;
}

const SESSION_CONFLICT_CLOSE_CODE = 4409;

/**
 * Manages the student exam-room WebSocket connection.
 * Server pushes {"type":"time_up"} once the deadline passes (server-side
 * auto-submit); client can push violations. There's no periodic "tick" -
 * the countdown display is computed locally from `end_at` (see
 * ExamRoomPage), which doesn't need the server's help to stay accurate.
 * If the socket drops, `connected` flips to false so the caller falls back
 * to reporting violations over REST instead.
 */
export function useAttemptSocket({
  attemptId,
  enabled,
  onTimeUp,
}: UseAttemptSocketOptions): UseAttemptSocketResult {
  const [connected, setConnected] = useState(false);
  const [conflict, setConflict] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    if (!attemptId || !enabled) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    // Each attempt mints its own fresh ticket - they're single-use and
    // expire in 60s, so a reconnect (every 3s below) always needs a new one.
    const connect = async () => {
      if (cancelled) return;
      let ticket: string;
      try {
        ticket = await getWsTicket();
      } catch {
        if (!cancelled) reconnectTimer = setTimeout(connect, 3000);
        return;
      }
      if (cancelled) return;

      const socket = new WebSocket(buildAttemptSocketUrl(attemptId, ticket));
      socketRef.current = socket;

      socket.onopen = () => {
        setConnected(true);
        setConflict(false);
      };

      socket.onmessage = (event) => {
        try {
          const message: WsAttemptServerMessage = JSON.parse(event.data);
          if (message.type === 'time_up') {
            onTimeUpRef.current();
          }
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = (event) => {
        setConnected(false);
        if (event.code === SESSION_CONFLICT_CLOSE_CODE) {
          // Another device/tab already holds this exam room open live.
          // Retrying every 3s would just get rejected again for as long as
          // that's true - back off, and self-heal (no user action needed)
          // once it closes on the other end.
          setConflict(true);
          if (!cancelled) reconnectTimer = setTimeout(connect, 10000);
          return;
        }
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [attemptId, enabled]);

  const sendViolation = useCallback((violationType: ViolationType) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'violation', violation_type: violationType }));
    }
  }, []);

  return { connected, conflict, sendViolation };
}
