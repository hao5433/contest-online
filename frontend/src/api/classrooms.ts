import { apiClient } from '@/api/client';
import type { Classroom, ClassroomPayload, EnrolledStudent, ImportStudentsResult } from '@/types';

export async function listClassrooms(): Promise<Classroom[]> {
  const { data } = await apiClient.get<Classroom[]>('/classrooms');
  return data;
}

export async function createClassroom(payload: ClassroomPayload): Promise<Classroom> {
  const { data } = await apiClient.post<Classroom>('/classrooms', payload);
  return data;
}

export async function updateClassroom(id: string, payload: ClassroomPayload): Promise<Classroom> {
  const { data } = await apiClient.put<Classroom>(`/classrooms/${id}`, payload);
  return data;
}

export async function deleteClassroom(id: string): Promise<void> {
  await apiClient.delete(`/classrooms/${id}`);
}

export async function listEnrolledStudents(classroomId: string): Promise<EnrolledStudent[]> {
  const { data } = await apiClient.get<EnrolledStudent[]>(`/classrooms/${classroomId}/students`);
  return data;
}

export async function enrollStudent(classroomId: string, email: string): Promise<EnrolledStudent> {
  const { data } = await apiClient.post<EnrolledStudent>(`/classrooms/${classroomId}/students`, { email });
  return data;
}

export async function unenrollStudent(classroomId: string, studentId: string): Promise<void> {
  await apiClient.delete(`/classrooms/${classroomId}/students/${studentId}`);
}

export async function importStudents(classroomId: string, file: File): Promise<ImportStudentsResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<ImportStudentsResult>(
    `/classrooms/${classroomId}/students/import`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}
