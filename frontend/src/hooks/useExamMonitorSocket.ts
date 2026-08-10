import { useEffect, useRef, useState } from 'react';
import { buildExamMonitorSocketUrl } from '@/lib/ws';
import { getWsTicket } from '@/api/auth';
import type { WsMonitorMessage } from '@/types';

export interface MonitoredAttempt {
  attemptId: string;
  studentName: string;
  answeredCount: number;
  totalQuestions: number;
  violationCount: number;
  /** e.g. { tab_switch: 2, fullscreen_exit: 1 } - built up live, one violation event at a time. */
  violationsByType: Record<string, number>;
}

interface UseExamMonitorSocketResult {
  connected: boolean;
  attempts: Record<string, MonitoredAttempt>;
}

/**
 * Teacher-side live monitor for an active exam. Aggregates `progress` and
 * `violation` events per attempt into a table-friendly map.
 */
export function useExamMonitorSocket(examId: string | null, enabled: boolean): UseExamMonitorSocketResult {
  const [connected, setConnected] = useState(false);
  const [attempts, setAttempts] = useState<Record<string, MonitoredAttempt>>({});

  const attemptsRef = useRef(attempts);
  attemptsRef.current = attempts;

  useEffect(() => {
    if (!examId || !enabled) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let socket: WebSocket | null = null;

    // Fresh ticket per (re)connect attempt - single-use, 60s TTL.
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

      socket = new WebSocket(buildExamMonitorSocketUrl(examId, ticket));

      socket.onopen = () => setConnected(true);

      socket.onmessage = (event) => {
        try {
          const message: WsMonitorMessage = JSON.parse(event.data);
          setAttempts((prev) => {
            const existing = prev[message.attempt_id];
            const base: MonitoredAttempt = existing ?? {
              attemptId: message.attempt_id,
              studentName: message.student_name ?? 'Học sinh',
              answeredCount: 0,
              totalQuestions: 0,
              violationCount: 0,
              violationsByType: {},
            };

            if (message.type === 'progress') {
              return {
                ...prev,
                [message.attempt_id]: {
                  ...base,
                  studentName: message.student_name ?? base.studentName,
                  answeredCount: message.answered_count ?? base.answeredCount,
                  totalQuestions: message.total_questions ?? base.totalQuestions,
                },
              };
            }

            // violation event - tally it by type as it arrives, so the
            // teacher sees *what* happened live, not just a running total.
            return {
              ...prev,
              [message.attempt_id]: {
                ...base,
                studentName: message.student_name ?? base.studentName,
                violationCount: message.count ?? base.violationCount + 1,
                violationsByType: {
                  ...base.violationsByType,
                  [message.violation_type]: (base.violationsByType[message.violation_type] ?? 0) + 1,
                },
              },
            };
          });
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (!cancelled) reconnectTimer = setTimeout(connect, 3000);
      };

      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [examId, enabled]);

  return { connected, attempts };
}
