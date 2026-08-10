import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as examsApi from '@/api/exams';
import type { ExamPayload } from '@/types';

const EXAMS_KEY = ['exams'] as const;
const examKey = (id: string) => ['exams', id] as const;
const examStatsKey = (id: string) => ['exams', id, 'statistics'] as const;

export function useExams() {
  return useQuery({ queryKey: EXAMS_KEY, queryFn: examsApi.listExams });
}

export function useExam(id: string | undefined) {
  return useQuery({
    queryKey: examKey(id ?? ''),
    queryFn: () => examsApi.getExam(id as string),
    enabled: Boolean(id),
  });
}

export function useExamStatistics(id: string | undefined, options?: { refetchInterval?: number }) {
  return useQuery({
    queryKey: examStatsKey(id ?? ''),
    queryFn: () => examsApi.getExamStatistics(id as string),
    enabled: Boolean(id),
    refetchInterval: options?.refetchInterval,
  });
}

export function useCreateExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: examsApi.createExam,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EXAMS_KEY }),
  });
}

export function useUpdateExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ExamPayload> }) =>
      examsApi.updateExam(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: EXAMS_KEY });
      queryClient.invalidateQueries({ queryKey: examKey(variables.id) });
    },
  });
}

export function useDeleteExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: examsApi.deleteExam,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EXAMS_KEY }),
  });
}
