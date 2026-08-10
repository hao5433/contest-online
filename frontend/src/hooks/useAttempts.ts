import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as attemptsApi from '@/api/attempts';
import type { AnswerPayload, ViolationType } from '@/types';

export function useStartExam() {
  return useMutation({ mutationFn: attemptsApi.startExam });
}

export function useSubmitAnswer() {
  return useMutation({
    mutationFn: ({ attemptId, payload }: { attemptId: string; payload: AnswerPayload }) =>
      attemptsApi.submitAnswer(attemptId, payload),
  });
}

export function useSubmitAttempt() {
  return useMutation({ mutationFn: attemptsApi.submitAttempt });
}

export function useAttemptResult(attemptId: string | undefined) {
  return useQuery({
    queryKey: ['attempts', attemptId, 'result'],
    queryFn: () => attemptsApi.getAttemptResult(attemptId as string),
    enabled: Boolean(attemptId),
  });
}

export function useReportViolation() {
  return useMutation({
    mutationFn: ({ attemptId, type }: { attemptId: string; type: ViolationType }) =>
      attemptsApi.reportViolation(attemptId, type),
  });
}

export function useMyAttempts() {
  return useQuery({
    queryKey: ['attempts', 'me'],
    queryFn: attemptsApi.listMyAttempts,
    retry: false,
  });
}

export function useExamAttempts(examId: string | undefined) {
  return useQuery({
    queryKey: ['exams', examId, 'attempts'],
    queryFn: () => attemptsApi.listExamAttempts(examId as string),
    enabled: Boolean(examId),
  });
}

export function useResetAttempt(examId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: attemptsApi.resetAttempt,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exams', examId, 'attempts'] }),
  });
}

export function useAnswerChangeLog(attemptId: string | null) {
  return useQuery({
    queryKey: ['attempts', attemptId, 'answer-log'],
    queryFn: () => attemptsApi.getAnswerChangeLog(attemptId as string),
    enabled: Boolean(attemptId),
  });
}
