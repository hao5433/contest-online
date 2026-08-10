import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useExams } from '@/hooks/useExams';
import { useMyAttempts } from '@/hooks/useAttempts';
import { Spinner } from '@/components/common/Spinner';
import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/common/Badge';
import { deriveExamStatus, formatDateTime, formatScore } from '@/lib/utils';

export function StudentHomePage() {
  const { data: exams, isLoading: examsLoading } = useExams();
  const { data: attempts, isLoading: attemptsLoading } = useMyAttempts();

  // Each exam can only be attempted once - map exam_id -> latest attempt so
  // "available now" can hide exams already completed (and relabel the ones
  // resumable mid-attempt) instead of offering a "Vào thi" that just 400s.
  const attemptByExamId = useMemo(
    () => new Map((attempts ?? []).map((a) => [a.exam_id, a])),
    [attempts],
  );

  const availableExams = (exams ?? []).filter((exam) => {
    if (deriveExamStatus(exam.start_time, exam.end_time) !== 'active') return false;
    const attempt = attemptByExamId.get(exam.id);
    return !attempt || attempt.status === 'in_progress';
  });
  const upcomingExams = (exams ?? []).filter((exam) => deriveExamStatus(exam.start_time, exam.end_time) === 'scheduled');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Bài thi của tôi</h1>
        <p className="text-sm text-neutral-500">Danh sách đề thi đang mở và lịch sử làm bài của bạn.</p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-900">Đề thi có thể làm ngay</h2>
        {examsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : availableExams.length === 0 ? (
          <EmptyState title="Hiện không có đề thi nào đang mở" />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {availableExams.map((exam) => {
              const inProgress = attemptByExamId.get(exam.id)?.status === 'in_progress';
              return (
                <div key={exam.id} className="rounded-lg border border-neutral-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-neutral-900">{exam.title}</h3>
                    <Badge tone="success">Đang mở</Badge>
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">
                    Thời gian làm bài: {exam.duration_minutes} phút · Hạn: {formatDateTime(exam.end_time)}
                  </p>
                  <Link
                    to={`/student/exam/${exam.id}/room`}
                    className="mt-3 inline-block rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
                  >
                    {inProgress ? 'Tiếp tục làm bài' : 'Vào thi'}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {upcomingExams.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-neutral-900">Đề thi sắp diễn ra</h2>
          <div className="grid grid-cols-2 gap-4">
            {upcomingExams.map((exam) => (
              <div key={exam.id} className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-neutral-900">{exam.title}</h3>
                  <Badge tone="primary">Sắp diễn ra</Badge>
                </div>
                <p className="mt-1 text-sm text-neutral-500">Bắt đầu: {formatDateTime(exam.start_time)}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-900">Lịch sử làm bài</h2>
        {attemptsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : !attempts || attempts.length === 0 ? (
          <EmptyState title="Bạn chưa có lượt thi nào" />
        ) : (
          <div className="rounded-lg border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
                  <th className="px-4 py-2">Đề thi</th>
                  <th className="px-4 py-2">Điểm</th>
                  <th className="px-4 py-2">Nộp lúc</th>
                  <th className="px-4 py-2">Trạng thái</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.attempt_id} className="border-b border-neutral-100 last:border-0">
                    <td className="px-4 py-2.5 text-neutral-800">{attempt.exam_title}</td>
                    <td className="px-4 py-2.5 text-neutral-600">{formatScore(attempt.score)}</td>
                    <td className="px-4 py-2.5 text-neutral-600">{formatDateTime(attempt.submitted_at)}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={attempt.status === 'submitted' ? 'success' : attempt.status === 'expired' ? 'danger' : 'primary'}>
                        {attempt.status === 'submitted' ? 'Đã nộp' : attempt.status === 'expired' ? 'Hết giờ' : 'Đang làm'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {attempt.status !== 'in_progress' && (
                        <Link
                          to={`/student/exam/${attempt.exam_id}/result/${attempt.attempt_id}`}
                          className="text-xs font-medium text-primary-600 hover:text-primary-700"
                        >
                          Xem kết quả →
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
