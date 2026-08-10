import { apiClient } from '@/api/client';
import type { AuthTokens, ChangePasswordPayload, LoginPayload, RegisterPayload, User } from '@/types';

export async function login(payload: LoginPayload): Promise<AuthTokens> {
  const { data } = await apiClient.post<AuthTokens>('/auth/login', payload);
  return data;
}

export async function register(payload: RegisterPayload): Promise<User> {
  const { data } = await apiClient.post<User>('/auth/register', payload);
  return data;
}

export async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me');
  return data;
}

export async function refreshTokens(refresh_token: string): Promise<AuthTokens> {
  const { data } = await apiClient.post<AuthTokens>('/auth/refresh', { refresh_token });
  return data;
}

export async function changePassword(payload: ChangePasswordPayload): Promise<void> {
  await apiClient.post('/auth/change-password', payload);
}

/** Best-effort - revokes the refresh token server-side so it can't be used
 * again even if it leaked. Caller should clear local state regardless of
 * whether this call succeeds (e.g. the token might already be expired). */
export async function logout(refresh_token: string): Promise<void> {
  await apiClient.post('/auth/logout', { refresh_token });
}

/** Mints a short-lived (60s), single-use ticket for a WebSocket handshake -
 * call this right before opening each WS connection, not once upfront. */
export async function getWsTicket(): Promise<string> {
  const { data } = await apiClient.post<{ ticket: string; expires_in: number }>('/auth/ws-ticket');
  return data.ticket;
}
