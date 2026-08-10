// Shared TypeScript interfaces mirroring the FastAPI backend contract exactly.
// Keep this file the single source of truth for API shapes used across the app.

export type Role = 'admin' | 'teacher' | 'student';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

// ---------- Pagination ----------

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ---------- Subjects / chapters ----------

export interface Subject {
  id: string;
  name: string;
  description?: string | null;
}

export interface SubjectPayload {
  name: string;
  description?: string;
}

export interface Chapter {
  id: string;
  subject_id: string;
  name: string;
  order?: number;
}

export interface ChapterPayload {
  name: string;
  order?: number;
}

// ---------- Questions ----------

export type Difficulty = 'easy' | 'medium' | 'hard';
export type QuestionType = 'single_choice' | 'multi_choice';

export interface Choice {
  id: string;
  content: string;
  is_correct: boolean;
}

export interface ChoiceInput {
  content: string;
  is_correct: boolean;
}

export interface Question {
  id: string;
  subject_id: string;
  chapter_id: string;
  content: string;
  difficulty: Difficulty;
  question_type: QuestionType;
  is_approved: boolean;
  image_url?: string | null;
  choices: Choice[];
  created_by?: string;
}

export interface QuestionPayload {
  subject_id: string;
  chapter_id: string;
  content: string;
  difficulty: Difficulty;
  question_type: QuestionType;
  choices: ChoiceInput[];
}

export interface QuestionFilters {
  subject_id?: string;
  chapter_id?: string;
  difficulty?: Difficulty;
  is_approved?: boolean;
  page?: number;
  page_size?: number;
}

// ---------- Exams ----------

/** Purely time-derived (from start_time/end_time) - "is it happening right now?". */
export type ExamTimeStatus = 'draft' | 'scheduled' | 'active' | 'ended';

/** The backend's real lifecycle status - this is what actually controls whether
 * students can see/take the exam (GET /api/exams only returns 'published' ones
 * to students). An exam stays 'draft' - and invisible to students - until a
 * teacher explicitly publishes it, regardless of its scheduled start_time. */
export type ExamPublishStatus = 'draft' | 'published' | 'closed';

export interface DifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
}

export interface Exam {
  id: string;
  title: string;
  subject_id: string;
  duration_minutes: number;
  difficulty_distribution: DifficultyDistribution;
  shuffle_questions: boolean;
  shuffle_choices: boolean;
  start_time: string;
  end_time: string;
  status: ExamPublishStatus;
  /** null = visible to every student; set = only students enrolled in that classroom. */
  classroom_id: string | null;
  created_by?: string;
}

export interface ExamPayload {
  title: string;
  subject_id: string;
  duration_minutes: number;
  difficulty_distribution: DifficultyDistribution;
  shuffle_questions: boolean;
  shuffle_choices: boolean;
  start_time: string;
  end_time: string;
  status?: ExamPublishStatus;
  classroom_id?: string | null;
}

// ---------- Classrooms ----------

export interface Classroom {
  id: string;
  name: string;
  teacher_id: string;
  created_at: string;
  student_count: number;
}

export interface ClassroomPayload {
  name: string;
}

export interface EnrolledStudent {
  student_id: string;
  full_name: string;
  email: string;
  enrolled_at: string;
}

export interface CreatedAccount {
  email: string;
  full_name: string;
  temporary_password: string;
}

export interface ImportRowError {
  row: number;
  email: string | null;
  message: string;
}

export interface ImportStudentsResult {
  created: CreatedAccount[];
  enrolled_existing: number;
  already_enrolled: number;
  errors: ImportRowError[];
}

export interface ScoreBucket {
  bucket: string;
  count: number;
}

export interface QuestionAccuracy {
  question_id: string;
  accuracy: number;
}

export interface ExamStatistics {
  attempt_count: number;
  avg_score: number;
  pass_rate: number;
  score_distribution: ScoreBucket[];
  per_question_accuracy: QuestionAccuracy[];
}

// ---------- Exam taking / attempts ----------

export interface AttemptChoice {
  id: string;
  content: string;
}

export interface AttemptQuestion {
  id: string;
  content: string;
  question_type: QuestionType;
  image_url?: string | null;
  choices: AttemptChoice[];
}

export interface StartExamResponse {
  attempt_id: string;
  end_at: string;
  questions: AttemptQuestion[];
}

export interface AnswerPayload {
  question_id: string;
  selected_choice_ids: string[];
}

export interface SubmitAttemptResponse {
  score: number;
}

export interface ResultQuestionBreakdown {
  question_id: string;
  content: string;
  question_type: QuestionType;
  choices: Choice[];
  selected_choice_ids: string[];
  correct_choice_ids: string[];
  is_correct: boolean;
}

export interface AttemptResult {
  attempt_id: string;
  score: number;
  total_questions: number;
  correct_count: number;
  /** True while the exam is still open to other students - per-question detail
   * (correct answers, right/wrong per question) is withheld until it closes,
   * so an early finisher can't leak answers to classmates still taking it.
   * `questions` is empty when this is true. */
  details_locked: boolean;
  questions: ResultQuestionBreakdown[];
}

export type ViolationType = 'tab_switch' | 'fullscreen_exit' | 'copy_paste_attempt';

export interface ViolationPayload {
  type: ViolationType;
}

export interface AttemptSummary {
  attempt_id: string;
  exam_id: string;
  exam_title: string;
  score?: number | null;
  submitted_at?: string | null;
  status: 'in_progress' | 'submitted' | 'expired';
}

/** One row of GET /exams/{id}/attempts - the teacher-facing roster used to reset a stuck/duplicate attempt. */
export interface ExamAttemptListItem {
  attempt_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  status: 'in_progress' | 'submitted' | 'graded';
  score: number | null;
  submitted_at: string | null;
  violation_count: number;
  /** e.g. { tab_switch: 2, fullscreen_exit: 1 } */
  violations_by_type: Record<string, number>;
}

// ---------- WebSocket messages ----------

export interface WsTimeUpMessage {
  type: 'time_up';
}

// The server no longer pushes a periodic countdown tick - the client already
// counts down on its own from `end_at` (see ExamRoomPage's local interval).
// This socket now only ever pushes time_up.
export type WsAttemptServerMessage = WsTimeUpMessage;

export interface WsViolationClientMessage {
  type: 'violation';
  violation_type: ViolationType;
}

export interface WsMonitorViolationMessage {
  type: 'violation';
  attempt_id: string;
  student_name?: string;
  violation_type: ViolationType;
  count?: number;
  at?: string;
}

export interface WsMonitorProgressMessage {
  type: 'progress';
  attempt_id: string;
  student_name?: string;
  answered_count?: number;
  total_questions?: number;
}

export type WsMonitorMessage = WsMonitorViolationMessage | WsMonitorProgressMessage;

// ---------- Generic API error shape ----------

export interface ApiErrorBody {
  detail?: string | { msg: string }[];
}
