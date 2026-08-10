import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useExam, useExamStatistics, useUpdateExam } from '@/hooks/useExams';
import { useExamAttempts, useResetAttempt } from '@/hooks/useAttempts';
import * as examsApi from '@/api/exams';
import { extractErrorMessage } from '@/api/client';
import { Spinner } from '@/components/common/Spinner';
import { EmptyState } from '@/components/common/EmptyState';
import { Badge } from '@/components/common/Badge';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ExamStatusBadge } from '@/components/exams/ExamStatusBadge';
import { PublishStatusBadge } from '@/components/exams/PublishStatusBadge';
import { LiveMonitorPanel } from '@/components/exams/LiveMonitorPanel';
import { AnswerChangeLogModal } from '@/components/exams/AnswerChangeLogModal';
import { ScoreDistributionChart } from '@/components/charts/ScoreDistributionChart';
import { formatViolationBreakdown } from '@/lib/utils';
import { AccuracyChart } from '@/components/charts/AccuracyChart';
import { PassRateDonut } from '@/components/charts/PassRateDonut';
import { deriveExamStatus, formatDateTime, formatScore } from '@/lib/utils';
import type { ExamAttemptListItem } from '@/types';

export function ExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: exam, isLoading: examLoading } = useExam(id);
  const isActive = exam ? deriveExamStatus(exam.start_time, exam.end_time) === 'active' : false;
  const { data: stats, isLoading: statsLoading } = useExamStatistics(id, {
    refetchInterval: isActive ? 10_000 : undefined,
  });
  const updateExam = useUpdateExam();
  const { data: attempts, isLoading: attemptsLoading } = useExamAttempts(id);
  const resetAttempt = useResetAttempt(id ?? '');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [resetting, setResetting] = useState<ExamAttemptListItem | null>(null);
  const [viewingLogFor, setViewingLogFor] = useState<ExamAttemptListItem | null>(null);

  function confirmReset() {
    if (!resetting) return;
    resetAttempt.mutate(resetting.attempt_id, {
      onSuccess: () => {
        toast.success(`Đã xoá lượt thi của ${resetting.student_name} - có thể làm lại từ đầu`);
        setResetting(null);
      },
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  function handlePublish() {
    if (!exam) return;
    updateExam.mutate(
      { id: exam.id, payload: { status: 'published' } },
      {
        onSuccess: () => toast.success('Đã xuất bản đề thi'),
        onError: (error) => toast.error(extractErrorMessage(error)),
      },
    );
  }

  function handleClose() {
    if (!exam) return;
    updateExam.mutate(
      { id: exam.id, payload: { status: 'closed' } },
      {
        onSuccess: () => toast.success('Đã đóng đề thi'),
        onError: (error) => toast.error(extractErrorMessage(error)),
      },
    );
  }

  async function handleExport(format: 'excel' | 'pdf') {
    if (!exam) return;
    setExporting(format);
    try {
      if (format === 'excel') {
        await examsApi.downloadExamReportExcel(exam.id, exam.title);
      } else {
        await examsApi.downloadExamReportPdf(exam.id, exam.title);
      }
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Xuất báo cáo thất bại'));
    } finally {
      setExporting(null);
    }
  }

  if (examLoading || !exam) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/teacher/exams" className="text-sm text-neutral-500 hover:text-neutral-700">
          ← Danh sách đề thi
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-neutral-900">{exam.title}</h1>
              <ExamStatusBadge startTime={exam.start_time} endTime={exam.end_time} />
              <PublishStatusBadge status={exam.status} />
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              {exam.duration_minutes} phút · {formatDateTime(exam.start_time)} → {formatDateTime(exam.end_time)}
            </p>
            {exam.status === 'draft' && (
              <p className="mt-1 text-xs text-warning-700">
                Đề thi chưa xuất bản - thí sinh chưa thể thấy hoặc làm bài.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {exam.status === 'draft' && (
              <button
                type="button"
                onClick={handlePublish}
                disabled={updateExam.isPending}
                className="rounded-md bg-success-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-success-700 disabled:opacity-60"
              >
                Xuất bản đề thi
              </button>
            )}
            {exam.status === 'published' && (
              <button
                type="button"
                onClick={handleClose}
                disabled={updateExam.isPending}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
              >
                Đóng đề thi
              </button>
            )}
            <button
              type="button"
              onClick={() => handleExport('excel')}
              disabled={exporting !== null}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
            >
              {exporting === 'excel' ? 'Đang xuất...' : '⬇ Xuất Excel'}
            </button>
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={exporting !== null}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
            >
              {exporting === 'pdf' ? 'Đang xuất...' : '⬇ Xuất PDF'}
            </button>
          </div>
        </div>
      </div>

      {statsLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : !stats ? (
        <EmptyState title="Chưa có dữ liệu thống kê" />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Số lượt thi" value={String(stats.attempt_count)} />
            <StatCard label="Điểm trung bình" value={formatScore(stats.avg_score)} />
            <StatCard label="Tỷ lệ đạt" value={`${Math.round(stats.pass_rate * 100)}%`} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-neutral-900">Phân bố điểm số</h3>
              <ScoreDistributionChart data={stats.score_distribution} />
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-semibold text-neutral-900">Tỷ lệ đạt / không đạt</h3>
              <PassRateDonut passRate={stats.pass_rate} />
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">Độ chính xác theo từng câu hỏi</h3>
            <AccuracyChart data={stats.per_question_accuracy} />
          </div>
        </>
      )}

      <div className="rounded-lg border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-neutral-900">Danh sách lượt thi</h3>
          <p className="text-xs text-neutral-500">
            Mỗi thí sinh chỉ được làm 1 lần. Bấm "Làm lại" để xoá lượt thi hiện tại và cho phép họ làm lại từ đầu
            (dùng khi thí sinh gặp lỗi kỹ thuật giữa giờ, hoặc để test).
          </p>
        </div>
        {attemptsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : !attempts || attempts.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Chưa có thí sinh nào làm đề thi này" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
                <th className="px-4 py-2">Thí sinh</th>
                <th className="px-4 py-2">Điểm</th>
                <th className="px-4 py-2">Nộp lúc</th>
                <th className="px-4 py-2">Vi phạm</th>
                <th className="px-4 py-2">Trạng thái</th>
                <th className="px-4 py-2 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.attempt_id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-neutral-800">{a.student_name}</div>
                    <div className="text-xs text-neutral-500">{a.student_email}</div>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">{formatScore(a.score)}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{formatDateTime(a.submitted_at)}</td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    {a.violation_count > 0 ? (
                      <div className="space-y-0.5">
                        <Badge tone="danger">{a.violation_count} lần</Badge>
                        <div className="text-xs text-neutral-500">{formatViolationBreakdown(a.violations_by_type)}</div>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={a.status === 'in_progress' ? 'primary' : 'success'}>
                      {a.status === 'in_progress' ? 'Đang làm' : 'Đã nộp'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setViewingLogFor(a)}
                      className="text-xs font-medium text-neutral-500 hover:text-primary-600"
                    >
                      Lịch sử trả lời
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetting(a)}
                      className="text-xs font-medium text-danger-600 hover:text-danger-700"
                    >
                      Làm lại
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <LiveMonitorPanel examId={exam.id} enabled={isActive} />

      <ConfirmDialog
        open={Boolean(resetting)}
        title="Xoá lượt thi để làm lại"
        message={`Xoá toàn bộ lượt thi của "${resetting?.student_name}" cho đề thi này? Thí sinh sẽ mất kết quả hiện tại và có thể bắt đầu làm lại từ đầu. Không thể hoàn tác.`}
        confirmLabel="Xoá và cho làm lại"
        danger
        onConfirm={confirmReset}
        onCancel={() => setResetting(null)}
        loading={resetAttempt.isPending}
      />

      <AnswerChangeLogModal
        attemptId={viewingLogFor?.attempt_id ?? null}
        studentName={viewingLogFor?.student_name ?? ''}
        onClose={() => setViewingLogFor(null)}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <p className="text-xs uppercase text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}
