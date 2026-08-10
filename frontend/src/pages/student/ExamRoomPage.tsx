import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useStartExam, useSubmitAnswer, useSubmitAttempt, useReportViolation } from '@/hooks/useAttempts';
import { useAttemptSocket } from '@/hooks/useAttemptSocket';
import { extractErrorMessage } from '@/api/client';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Spinner } from '@/components/common/Spinner';
import { Countdown } from '@/components/exam-room/Countdown';
import { ViolationBanner } from '@/components/exam-room/ViolationBanner';
import { QuestionNavigator } from '@/components/exam-room/QuestionNavigator';
import type { AttemptQuestion, StartExamResponse, ViolationType } from '@/types';

const VIOLATION_THRESHOLD = 3;
const ANSWER_DEBOUNCE_MS = 600;

export function ExamRoomPage() {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();

  const startExam = useStartExam();
  const submitAnswer = useSubmitAnswer();
  const submitAttempt = useSubmitAttempt();
  const reportViolation = useReportViolation();

  const [session, setSession] = useState<StartExamResponse | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [violationCount, setViolationCount] = useState(0);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // True from the instant fullscreen is exited until the student clicks
  // back into it - a browser will never let JS re-enter fullscreen without
  // a fresh user gesture (a security rule, not something we can code around),
  // so the realistic "lock" a web app can offer is: block the exam content
  // behind an overlay until they choose to come back, instead of just
  // logging the exit and letting them keep answering outside fullscreen.
  const [fullscreenLost, setFullscreenLost] = useState(false);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const hasSubmittedRef = useRef(false);
  const violationCountRef = useRef(0);

  // ---- Start the attempt on mount ----
  useEffect(() => {
    if (!examId) return;
    startExam.mutate(examId, {
      onSuccess: (data) => {
        setSession(data);
        const endAt = new Date(data.end_at).getTime();
        setRemainingSeconds(Math.max(0, Math.floor((endAt - Date.now()) / 1000)));
        requestFullscreenBestEffort();
      },
      onError: (error) => setStartError(extractErrorMessage(error, 'Không thể bắt đầu bài thi')),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const attemptId = session?.attempt_id ?? null;

  // ---- Submit (manual or time-up) ----
  const doSubmit = useCallback(() => {
    if (!attemptId || hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    setSubmitting(true);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    }
    submitAttempt.mutate(attemptId, {
      onSuccess: () => {
        navigate(`/student/exam/${examId}/result/${attemptId}`, { replace: true });
      },
      onError: (error) => {
        toast.error(extractErrorMessage(error, 'Nộp bài thất bại, vui lòng thử lại'));
        hasSubmittedRef.current = false;
        setSubmitting(false);
      },
    });
  }, [attemptId, examId, navigate, submitAttempt]);

  // `doSubmit` gets a new reference whenever `submitAttempt` (the mutation
  // object from react-query) does - which can happen on renders unrelated to
  // submitting, e.g. selecting a choice. Reading it via a ref (instead of
  // putting it directly in the countdown effect's deps below) means that
  // effect never has a reason to tear down and recreate its interval just
  // because the user clicked something - the timer keeps running completely
  // independent of every other state change in this component.
  const doSubmitRef = useRef(doSubmit);
  doSubmitRef.current = doSubmit;

  // ---- WebSocket: server-driven deadline enforcement + violation channel ----
  // No countdown comes over this socket - see the comment on the local
  // countdown effect below for why that's the local interval's job, not this
  // one's. This connection exists for onTimeUp (server-side auto-submit
  // notice) and for sendViolation.
  const { connected: wsConnected, conflict: sessionConflict, sendViolation } = useAttemptSocket({
    attemptId,
    enabled: Boolean(attemptId),
    onTimeUp: () => {
      toast.warning('Đã hết thời gian làm bài. Hệ thống tự động nộp bài.');
      doSubmitRef.current();
    },
  });

  // ---- Local per-second countdown, always running ----
  // `end_at` is a fixed point in time handed out once at start, so counting
  // down from it locally every second is accurate on its own - the server
  // has nothing to add here, so it doesn't push anything for display. Real
  // deadline enforcement happens server-side regardless (every relevant
  // endpoint re-checks against `end_at` in the DB, and the WS loop above
  // re-checks it independently every ~5s to auto-submit even if the student
  // stops interacting), so this display being purely locally computed isn't
  // a security gap.
  useEffect(() => {
    if (!session) return;
    const endAt = new Date(session.end_at).getTime();
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((endAt - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        toast.warning('Đã hết thời gian làm bài. Hệ thống tự động nộp bài.');
        doSubmitRef.current();
      }
    }, 1000);
    return () => clearInterval(interval);
    // Intentionally depends on `session` only - see the comment on doSubmitRef
    // above for why `doSubmit` itself must NOT be in this list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ---- Anti-cheat: tab switch + fullscreen exit ----
  const recordViolation = useCallback(
    (type: ViolationType) => {
      if (!attemptId || hasSubmittedRef.current) return;
      violationCountRef.current += 1;
      const count = violationCountRef.current;
      setViolationCount(count);

      // Exactly one channel per violation - both the WS handler
      // (routers/ws.py:_handle_client_message) and this REST call
      // (routers/attempts.py:report_violation) persist it server-side
      // (increment violation_count + insert a Violation row) and broadcast
      // to the teacher's monitor. Calling both would double-count every
      // single violation. Prefer WS (already-open connection, no extra
      // request) and only fall back to REST when it's down.
      if (wsConnected) {
        sendViolation(type);
      } else {
        reportViolation.mutate({ attemptId, type });
      }

      toast.warning(`Phát hiện hành vi bất thường (${count}/${VIOLATION_THRESHOLD}). Vui lòng tập trung làm bài.`);

      if (count > VIOLATION_THRESHOLD) {
        toast.error('Vượt quá số lần vi phạm cho phép. Bài thi sẽ được tự động nộp.');
        doSubmit();
      }
    },
    [attemptId, doSubmit, reportViolation, sendViolation, wsConnected],
  );

  useEffect(() => {
    if (!attemptId) return;

    function handleVisibilityChange() {
      if (document.hidden) recordViolation('tab_switch');
    }

    function handleFullscreenChange() {
      if (!document.fullscreenElement) {
        recordViolation('fullscreen_exit');
        setFullscreenLost(true);
      } else {
        setFullscreenLost(false);
      }
    }

    function handleCopyPasteAttempt(event: Event) {
      event.preventDefault();
      recordViolation('copy_paste_attempt');
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    // copy/cut/paste/right-click: block the action *and* count it as a
    // violation - these are the easiest way to get a question out to
    // (or an answer in from) somewhere else without ever switching tabs.
    document.addEventListener('copy', handleCopyPasteAttempt);
    document.addEventListener('cut', handleCopyPasteAttempt);
    document.addEventListener('paste', handleCopyPasteAttempt);
    document.addEventListener('contextmenu', handleCopyPasteAttempt);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopyPasteAttempt);
      document.removeEventListener('cut', handleCopyPasteAttempt);
      document.removeEventListener('paste', handleCopyPasteAttempt);
      document.removeEventListener('contextmenu', handleCopyPasteAttempt);
    };
  }, [attemptId, recordViolation]);

  // ---- Answer handling (debounced autosave) ----
  function selectChoice(question: AttemptQuestion, choiceId: string) {
    if (!attemptId) return;
    setAnswers((prev) => {
      const current = prev[question.id] ?? [];
      let next: string[];
      if (question.question_type === 'single_choice') {
        next = [choiceId];
      } else {
        next = current.includes(choiceId) ? current.filter((id) => id !== choiceId) : [...current, choiceId];
      }
      const updated = { ...prev, [question.id]: next };
      scheduleSave(question.id, next);
      return updated;
    });
  }

  function scheduleSave(questionId: string, selectedChoiceIds: string[]) {
    if (!attemptId) return;
    if (debounceTimers.current[questionId]) {
      clearTimeout(debounceTimers.current[questionId]);
    }
    debounceTimers.current[questionId] = setTimeout(() => {
      submitAnswer.mutate({
        attemptId,
        payload: { question_id: questionId, selected_choice_ids: selectedChoiceIds },
      });
    }, ANSWER_DEBOUNCE_MS);
  }

  const answeredIndexes = useMemo(() => {
    const set = new Set<number>();
    (session?.questions ?? []).forEach((q, index) => {
      if ((answers[q.id] ?? []).length > 0) set.add(index);
    });
    return set;
  }, [answers, session]);

  if (startError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="max-w-sm rounded-lg border border-danger-200 bg-white p-6 text-center shadow-card">
          <p className="text-3xl">⚠️</p>
          <h1 className="mt-2 text-base font-semibold text-neutral-900">Không thể vào phòng thi</h1>
          <p className="mt-1 text-sm text-neutral-500">{startError}</p>
          <button
            type="button"
            onClick={() => navigate('/student')}
            className="mt-4 rounded-md bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  if (!session || remainingSeconds === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-3 text-sm text-neutral-500">Đang khởi tạo phòng thi...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = session.questions[currentIndex];

  return (
    <div className="min-h-screen select-none bg-neutral-50">
      {sessionConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/80 px-4">
          <div className="max-w-sm rounded-lg bg-white p-6 text-center shadow-card">
            <p className="text-3xl">🔒</p>
            <h2 className="mt-2 text-base font-semibold text-neutral-900">
              Phòng thi đang mở ở một thiết bị/tab khác
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Mỗi lượt thi chỉ được mở ở một nơi. Hãy đóng phòng thi ở thiết bị/tab kia trước - trang này sẽ tự
              kết nối lại.
            </p>
          </div>
        </div>
      )}
      {fullscreenLost && !hasSubmittedRef.current && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/80 px-4">
          <div className="max-w-sm rounded-lg bg-white p-6 text-center shadow-card">
            <p className="text-3xl">⚠️</p>
            <h2 className="mt-2 text-base font-semibold text-neutral-900">Bạn đã thoát chế độ toàn màn hình</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Vi phạm đã được ghi nhận ({violationCount}/{VIOLATION_THRESHOLD}). Đề bài sẽ bị ẩn cho đến khi bạn
              quay lại chế độ toàn màn hình.
            </p>
            <button
              type="button"
              onClick={() => requestFullscreenBestEffort()}
              className="mt-4 rounded-md bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
            >
              Quay lại toàn màn hình
            </button>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
        <div>
          <h1 className="text-sm font-semibold text-neutral-900">Đang làm bài thi</h1>
          <p className="text-xs text-neutral-500">
            Câu {currentIndex + 1}/{session.questions.length} · Đã trả lời {answeredIndexes.size}/{session.questions.length}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Countdown remainingSeconds={remainingSeconds} connected={wsConnected} />
          <button
            type="button"
            onClick={() => requestFullscreenBestEffort()}
            className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
          >
            ⛶ Toàn màn hình
          </button>
          <button
            type="button"
            onClick={() => setConfirmSubmitOpen(true)}
            disabled={submitting}
            className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
          >
            Nộp bài
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-4 p-6">
        {violationCount > 0 && <ViolationBanner count={violationCount} threshold={VIOLATION_THRESHOLD} />}

        <div className="grid grid-cols-[280px_1fr] gap-4">
          <QuestionNavigator
            totalQuestions={session.questions.length}
            currentIndex={currentIndex}
            answeredIndexes={answeredIndexes}
            onNavigate={setCurrentIndex}
          />

          <div className="rounded-lg border border-neutral-200 bg-white p-5">
            <p className="text-sm font-medium text-neutral-900">
              Câu {currentIndex + 1}: {currentQuestion.content}
            </p>
            {currentQuestion.image_url && (
              <img
                src={currentQuestion.image_url}
                alt="Hình minh hoạ câu hỏi"
                className="mt-3 max-h-64 rounded-md border border-neutral-200"
              />
            )}

            <div className="mt-4 space-y-2">
              {currentQuestion.choices.map((choice) => {
                const selected = (answers[currentQuestion.id] ?? []).includes(choice.id);
                return (
                  <label
                    key={choice.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                      selected ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    <input
                      type={currentQuestion.question_type === 'single_choice' ? 'radio' : 'checkbox'}
                      name={`question-${currentQuestion.id}`}
                      checked={selected}
                      onChange={() => selectChoice(currentQuestion, choice.id)}
                      className="h-4 w-4 accent-primary-500"
                    />
                    <span className="text-neutral-800">{choice.content}</span>
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex justify-between">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                ← Câu trước
              </button>
              <button
                type="button"
                disabled={currentIndex === session.questions.length - 1}
                onClick={() => setCurrentIndex((i) => Math.min(session.questions.length - 1, i + 1))}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              >
                Câu sau →
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSubmitOpen}
        title="Nộp bài thi"
        message={`Bạn đã trả lời ${answeredIndexes.size}/${session.questions.length} câu. Bạn có chắc chắn muốn nộp bài?`}
        confirmLabel="Nộp bài"
        onConfirm={() => {
          setConfirmSubmitOpen(false);
          doSubmit();
        }}
        onCancel={() => setConfirmSubmitOpen(false)}
        loading={submitting}
      />
    </div>
  );
}

function requestFullscreenBestEffort() {
  const el = document.documentElement;
  if (el.requestFullscreen && !document.fullscreenElement) {
    el.requestFullscreen().catch(() => {
      // Some browsers require a direct user gesture; the manual "Toàn màn hình"
      // button in the header covers that case.
    });
  }
}
