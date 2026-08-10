import { apiClient } from '@/api/client';
import type { Role, User } from '@/types';

export interface CreateUserPayload {
  email: string;
  password: string;
  full_name: string;
  role: Role;
}

export interface UpdateUserPayload {
  full_name?: string;
  role?: Role;
  is_active?: boolean;
}

export async function listUsers(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/users');
  return data;
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  const { data } = await apiClient.post<User>('/users', payload);
  return data;
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<User> {
  const { data } = await apiClient.patch<User>(`/users/${id}`, payload);
  return data;
}

export interface ResetPasswordResult {
  email: string;
  temporary_password: string;
}

// Admin can reset anyone; a teacher can reset only their own enrolled
// students (backend enforces this - see routers/users.py:reset_password).
export async function resetUserPassword(id: string): Promise<ResetPasswordResult> {
  const { data } = await apiClient.post<ResetPasswordResult>(`/users/${id}/reset-password`);
  return data;
}
