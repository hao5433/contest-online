import { WS_BASE_URL } from '@/api/client';

// The backend requires `?ticket=` as a required query param on this socket
// (a WebSocket handshake can't carry an Authorization header) - it's a
// short-lived, single-use ticket (POST /api/auth/ws-ticket), not the raw
// access token, since query strings get written into server access logs.
export function buildAttemptSocketUrl(attemptId: string, ticket: string): string {
  return `${WS_BASE_URL}/ws/attempts/${attemptId}?ticket=${encodeURIComponent(ticket)}`;
}

export function buildExamMonitorSocketUrl(examId: string, ticket: string): string {
  return `${WS_BASE_URL}/ws/exams/${examId}/monitor?ticket=${encodeURIComponent(ticket)}`;
}
