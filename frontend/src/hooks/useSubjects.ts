import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as subjectsApi from '@/api/subjects';
import type { ChapterPayload, SubjectPayload } from '@/types';

const SUBJECTS_KEY = ['subjects'] as const;
const chaptersKey = (subjectId: string) => ['subjects', subjectId, 'chapters'] as const;

export function useSubjects() {
  return useQuery({ queryKey: SUBJECTS_KEY, queryFn: subjectsApi.listSubjects });
}

export function useChapters(subjectId: string | null | undefined) {
  return useQuery({
    queryKey: chaptersKey(subjectId ?? ''),
    queryFn: () => subjectsApi.listChapters(subjectId as string),
    enabled: Boolean(subjectId),
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: subjectsApi.createSubject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUBJECTS_KEY }),
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SubjectPayload }) =>
      subjectsApi.updateSubject(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUBJECTS_KEY }),
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: subjectsApi.deleteSubject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUBJECTS_KEY }),
  });
}

export function useCreateChapter(subjectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ChapterPayload) => subjectsApi.createChapter(subjectId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaptersKey(subjectId) }),
  });
}

export function useUpdateChapter(subjectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ChapterPayload }) =>
      subjectsApi.updateChapter(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaptersKey(subjectId) }),
  });
}

export function useDeleteChapter(subjectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: subjectsApi.deleteChapter,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaptersKey(subjectId) }),
  });
}
