import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as classroomsApi from '@/api/classrooms';
import type { ClassroomPayload } from '@/types';

const CLASSROOMS_KEY = ['classrooms'] as const;
const studentsKey = (classroomId: string) => ['classrooms', classroomId, 'students'] as const;

export function useClassrooms() {
  return useQuery({ queryKey: CLASSROOMS_KEY, queryFn: classroomsApi.listClassrooms });
}

export function useCreateClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: classroomsApi.createClassroom,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLASSROOMS_KEY }),
  });
}

export function useUpdateClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ClassroomPayload }) =>
      classroomsApi.updateClassroom(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLASSROOMS_KEY }),
  });
}

export function useDeleteClassroom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: classroomsApi.deleteClassroom,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLASSROOMS_KEY }),
  });
}

export function useEnrolledStudents(classroomId: string | null) {
  return useQuery({
    queryKey: studentsKey(classroomId ?? ''),
    queryFn: () => classroomsApi.listEnrolledStudents(classroomId as string),
    enabled: Boolean(classroomId),
  });
}

export function useEnrollStudent(classroomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => classroomsApi.enrollStudent(classroomId, email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentsKey(classroomId) });
      queryClient.invalidateQueries({ queryKey: CLASSROOMS_KEY }); // student_count changed
    },
  });
}

export function useUnenrollStudent(classroomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (studentId: string) => classroomsApi.unenrollStudent(classroomId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentsKey(classroomId) });
      queryClient.invalidateQueries({ queryKey: CLASSROOMS_KEY });
    },
  });
}

export function useImportStudents(classroomId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => classroomsApi.importStudents(classroomId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentsKey(classroomId) });
      queryClient.invalidateQueries({ queryKey: CLASSROOMS_KEY });
    },
  });
}
