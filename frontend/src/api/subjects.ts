import { apiClient } from '@/api/client';
import type { Chapter, ChapterPayload, Subject, SubjectPayload } from '@/types';

export async function listSubjects(): Promise<Subject[]> {
  const { data } = await apiClient.get<Subject[]>('/subjects');
  return data;
}

export async function getSubject(id: string): Promise<Subject> {
  const { data } = await apiClient.get<Subject>(`/subjects/${id}`);
  return data;
}

export async function createSubject(payload: SubjectPayload): Promise<Subject> {
  const { data } = await apiClient.post<Subject>('/subjects', payload);
  return data;
}

export async function updateSubject(id: string, payload: SubjectPayload): Promise<Subject> {
  const { data } = await apiClient.put<Subject>(`/subjects/${id}`, payload);
  return data;
}

export async function deleteSubject(id: string): Promise<void> {
  await apiClient.delete(`/subjects/${id}`);
}

export async function listChapters(subjectId: string): Promise<Chapter[]> {
  const { data } = await apiClient.get<Chapter[]>(`/subjects/${subjectId}/chapters`);
  return data;
}

export async function createChapter(subjectId: string, payload: ChapterPayload): Promise<Chapter> {
  const { data } = await apiClient.post<Chapter>(`/subjects/${subjectId}/chapters`, payload);
  return data;
}

export async function updateChapter(id: string, payload: ChapterPayload): Promise<Chapter> {
  const { data } = await apiClient.put<Chapter>(`/chapters/${id}`, payload);
  return data;
}

export async function deleteChapter(id: string): Promise<void> {
  await apiClient.delete(`/chapters/${id}`);
}
