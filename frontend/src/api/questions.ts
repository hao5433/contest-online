import { apiClient } from '@/api/client';
import type { Paginated, Question, QuestionFilters, QuestionPayload } from '@/types';

export async function listQuestions(filters: QuestionFilters): Promise<Paginated<Question>> {
  const { data } = await apiClient.get<Paginated<Question>>('/questions', {
    params: filters,
  });
  return data;
}

export async function getQuestion(id: string): Promise<Question> {
  const { data } = await apiClient.get<Question>(`/questions/${id}`);
  return data;
}

export async function createQuestion(payload: QuestionPayload): Promise<Question> {
  const { data } = await apiClient.post<Question>('/questions', payload);
  return data;
}

export async function updateQuestion(id: string, payload: QuestionPayload): Promise<Question> {
  const { data } = await apiClient.put<Question>(`/questions/${id}`, payload);
  return data;
}

export async function deleteQuestion(id: string): Promise<void> {
  await apiClient.delete(`/questions/${id}`);
}

export async function approveQuestion(id: string): Promise<Question> {
  const { data } = await apiClient.patch<Question>(`/questions/${id}/approve`);
  return data;
}

export async function importQuestions(file: File): Promise<{ imported: number }> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<{ imported: number }>('/questions/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
