import { apiClient } from '@/api/client';
import type {
  AnswerPayload,
  AttemptResult,
  AttemptSummary,
  Choice,
  ExamAttemptListItem,
  QuestionType,
  StartExamResponse,
  SubmitAttemptResponse,
  ViolationType,
} from '@/types';

// Raw shape actually returned by GET /attempts/{id}/result (app/schemas/attempt.py
// ResultResponse/ResultQuestionOut on the backend) - flatter than, and with
// different field names from, the frontend's AttemptResult. Normalized below.
interface RawResultQuestion {
  id: string;
  content: string;
  question_type: QuestionType;
  choices: Choice[];
  selected_choice_ids: string[];
  is_correct: boolean;
}

interface RawResultResponse {
  attempt_id: string;
  score: number | null;
  details_locked: boolean;
  total_questions: number;
  questions: RawResultQuestion[];
}

export async function startExam(examId: string): Promise<StartExamResponse> {
  const { data } = await apiClient.post<StartExamResponse>(`/exams/${examId}/start`);
  return data;
}

export async function submitAnswer(attemptId: string, payload: AnswerPayload): Promise<void> {
  await apiClient.post(`/attempts/${attemptId}/answer`, payload);
}

export async function submitAttempt(attemptId: string): Promise<SubmitAttemptResponse> {
  const { data } = await apiClient.post<SubmitAttemptResponse>(`/attempts/${attemptId}/submit`);
  return data;
}

export async function getAttemptResult(attemptId: string): Promise<AttemptResult> {
  const { data } = await apiClient.get<RawResultResponse>(`/attempts/${attemptId}/result`);
  const questions = data.questions.map((q) => ({
    question_id: q.id,
    content: q.content,
    question_type: q.question_type,
    choices: q.choices,
    selected_choice_ids: q.selected_choice_ids,
    correct_choice_ids: q.choices.filter((c) => c.is_correct).map((c) => c.id),
    is_correct: q.is_correct,
  }));
  const score = data.score ?? 0;
  return {
    attempt_id: data.attempt_id,
    score,
    total_questions: data.total_questions,
    // Locked: questions is empty (server withheld it), but the count of
    // correct answers is already implied by score + total_questions anyway,
    // so deriving it here isn't an extra leak beyond what "score" already is.
    correct_count: data.details_locked
      ? Math.round((score / 100) * data.total_questions)
      : questions.filter((q) => q.is_correct).length,
    details_locked: data.details_locked,
    questions,
  };
}

export async function reportViolation(attemptId: string, type: ViolationType): Promise<void> {
  await apiClient.post(`/attempts/${attemptId}/violation`, { type });
}

// Not in the strict backend contract list but commonly needed by the student home page
// to list "past attempts with scores". Falls back gracefully if unavailable.
export async function listMyAttempts(): Promise<AttemptSummary[]> {
  const { data } = await apiClient.get<AttemptSummary[]>('/attempts/me');
  return data;
}

/** Teacher/admin roster of who has attempted a given exam. */
export async function listExamAttempts(examId: string): Promise<ExamAttemptListItem[]> {
  const { data } = await apiClient.get<ExamAttemptListItem[]>(`/exams/${examId}/attempts`);
  return data;
}

/** Deletes a student's attempt so they can start the exam fresh. No undo. */
export async function resetAttempt(attemptId: string): Promise<void> {
  await apiClient.delete(`/attempts/${attemptId}`);
}

export interface AnswerChangeLogEntry {
  question_id: string;
  selected_choice_ids: string[];
  changed_at: string;
  seconds_since_previous: number;
  suspiciously_fast: boolean;
  is_revision: boolean;
}

/** Teacher/admin-only: full timestamped history of every answer change on
 * an attempt, not just where each question ended up. */
export async function getAnswerChangeLog(attemptId: string): Promise<AnswerChangeLogEntry[]> {
  const { data } = await apiClient.get<AnswerChangeLogEntry[]>(`/attempts/${attemptId}/answer-log`);
  return data;
}
