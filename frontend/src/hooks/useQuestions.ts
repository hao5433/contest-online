import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as questionsApi from '@/api/questions';
import type { QuestionFilters, QuestionPayload } from '@/types';

const questionsKey = (filters: QuestionFilters) => ['questions', filters] as const;

export function useQuestions(filters: QuestionFilters) {
  return useQuery({
    queryKey: questionsKey(filters),
    queryFn: () => questionsApi.listQuestions(filters),
  });
}

export function useCreateQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: questionsApi.createQuestion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions'] }),
  });
}

export function useUpdateQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: QuestionPayload }) =>
      questionsApi.updateQuestion(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions'] }),
  });
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: questionsApi.deleteQuestion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions'] }),
  });
}

export function useApproveQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: questionsApi.approveQuestion,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions'] }),
  });
}

export function useImportQuestions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: questionsApi.importQuestions,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questions'] }),
  });
}
