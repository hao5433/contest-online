import { apiClient } from '@/api/client';
import type { Exam, ExamPayload, ExamStatistics } from '@/types';

export async function listExams(): Promise<Exam[]> {
  const { data } = await apiClient.get<Exam[]>('/exams');
  return data;
}

export async function getExam(id: string): Promise<Exam> {
  const { data } = await apiClient.get<Exam>(`/exams/${id}`);
  return data;
}

export async function createExam(payload: ExamPayload): Promise<Exam> {
  const { data } = await apiClient.post<Exam>('/exams', payload);
  return data;
}

export async function updateExam(id: string, payload: Partial<ExamPayload>): Promise<Exam> {
  const { data } = await apiClient.patch<Exam>(`/exams/${id}`, payload);
  return data;
}

export async function deleteExam(id: string): Promise<void> {
  await apiClient.delete(`/exams/${id}`);
}

export async function getExamStatistics(id: string): Promise<ExamStatistics> {
  const { data } = await apiClient.get<ExamStatistics>(`/exams/${id}/statistics`);
  return data;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadExamReportExcel(id: string, examTitle: string): Promise<void> {
  const { data } = await apiClient.get(`/exams/${id}/report/excel`, { responseType: 'blob' });
  downloadBlob(data, `bao-cao-${examTitle}.xlsx`);
}

export async function downloadExamReportPdf(id: string, examTitle: string): Promise<void> {
  const { data } = await apiClient.get(`/exams/${id}/report/pdf`, { responseType: 'blob' });
  downloadBlob(data, `bao-cao-${examTitle}.pdf`);
}
