import { Link, useParams } from 'react-router-dom';
import { useAttemptResult } from '@/hooks/useAttempts';
import { Spinner } from '@/components/common/Spinner';
import { Badge } from '@/components/common/Badge';
import { formatScore } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function ExamResultPage() {
  const { attemptId } = useParams<{ examId: string; attemptId: string }>();
  const { data: result, isLoading } = useAttemptResult(attemptId);

  if (isLoading || !result) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  const passed = result.correct_count / Math.max(1, result.total_questions) >= 0.5;

  return (
    <div className="min-h-screen bg-neutral-50 py-8">
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
        <p className="text-sm text-neutral-500">Kết quả bài thi</p>
        <p className="mt-1 text-4xl font-bold text-neutral-900">{formatScore(result.score)}</p>
        <p className="mt-2 text-sm text-neutral-600">
          Trả lời đúng {result.correct_count}/{result.total_questions} câu
        </p>
        <Badge tone={passed ? 'success' : 'danger'} className="mt-3">
          {passed ? 'Đạt' : 'Không đạt'}
        </Badge>
      </div>

      {result.details_locked ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-center">
          <p className="text-2xl">🔒</p>
          <h2 className="mt-2 text-sm font-semibold text-neutral-900">Chi tiết từng câu chưa mở</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Đề thi vẫn đang mở cho các thí sinh khác, nên đáp án đúng/sai từng câu sẽ hiển thị sau khi đề thi kết
            thúc hoặc được giáo viên đóng lại - để tránh lộ đáp án cho người chưa thi.
          </p>
        </div>
      ) : (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900">Chi tiết theo câu hỏi</h2>
        {result.questions.map((q, index) => (
          <div
            key={q.question_id}
            className={cn(
              'rounded-lg border p-4',
              q.is_correct ? 'border-success-500/30 bg-success-50' : 'border-danger-500/30 bg-danger-50',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-neutral-900">
                Câu {index + 1}: {q.content}
              </p>
              <Badge tone={q.is_correct ? 'success' : 'danger'}>{q.is_correct ? 'Đúng' : 'Sai'}</Badge>
            </div>
            <ul className="mt-3 space-y-1.5">
              {q.choices.map((choice) => {
                const wasSelected = q.selected_choice_ids.includes(choice.id);
                const isCorrectChoice = q.correct_choice_ids.includes(choice.id);
                return (
                  <li
                    key={choice.id}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm',
                      isCorrectChoice && 'bg-success-100 text-success-800',
                      wasSelected && !isCorrectChoice && 'bg-danger-100 text-danger-800',
                      !wasSelected && !isCorrectChoice && 'text-neutral-600',
                    )}
                  >
                    <span aria-hidden="true">
                      {isCorrectChoice ? '✓' : wasSelected ? '✕' : '•'}
                    </span>
                    <span>{choice.content}</span>
                    {wasSelected && <span className="ml-auto text-xs italic text-neutral-500">Bạn đã chọn</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      )}

      <div className="text-center">
        <Link to="/student" className="text-sm font-medium text-primary-600 hover:text-primary-700">
          ← Về trang danh sách bài thi
        </Link>
      </div>
    </div>
    </div>
  );
}
