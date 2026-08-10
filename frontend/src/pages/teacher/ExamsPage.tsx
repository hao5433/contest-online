import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useSubjects } from '@/hooks/useSubjects';
import { useClassrooms } from '@/hooks/useClassrooms';
import { useCreateExam, useDeleteExam, useExams, useUpdateExam } from '@/hooks/useExams';
import { extractErrorMessage } from '@/api/client';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Spinner } from '@/components/common/Spinner';
import { EmptyState } from '@/components/common/EmptyState';
import { ExamForm } from '@/components/exams/ExamForm';
import { ExamStatusBadge } from '@/components/exams/ExamStatusBadge';
import { PublishStatusBadge } from '@/components/exams/PublishStatusBadge';
import { formatDateTime } from '@/lib/utils';
import type { Exam, ExamPayload } from '@/types';

export function ExamsPage() {
  const { data: subjects } = useSubjects();
  const { data: classrooms } = useClassrooms();
  const { data: exams, isLoading } = useExams();
  const classroomNameById = useMemo(
    () => new Map((classrooms ?? []).map((c) => [c.id, c.name])),
    [classrooms],
  );
  const createExam = useCreateExam();
  const updateExam = useUpdateExam();
  const deleteExam = useDeleteExam();
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Exam | null>(null);

  function confirmDelete() {
    if (!deleting) return;
    deleteExam.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Đã xoá đề thi');
        setDeleting(null);
      },
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  function handleSubmit(payload: ExamPayload) {
    createExam.mutate(payload, {
      onSuccess: () => {
        toast.success('Đã tạo đề thi (còn ở dạng bản nháp - nhớ bấm "Xuất bản" để thí sinh thấy được đề thi)');
        setFormOpen(false);
      },
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  function handlePublish(examId: string) {
    updateExam.mutate(
      { id: examId, payload: { status: 'published' } },
      {
        onSuccess: () => toast.success('Đã xuất bản đề thi - thí sinh có thể thấy và làm bài trong khoảng thời gian đã đặt'),
        onError: (error) => toast.error(extractErrorMessage(error)),
      },
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Đề thi</h1>
          <p className="text-sm text-neutral-500">Tạo và quản lý các đề thi.</p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
        >
          + Tạo đề thi
        </button>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : !exams || exams.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Chưa có đề thi nào" description="Nhấn “Tạo đề thi” để bắt đầu." />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
                <th className="px-4 py-2">Tên đề thi</th>
                <th className="px-4 py-2">Thời gian</th>
                <th className="px-4 py-2">Bắt đầu</th>
                <th className="px-4 py-2">Kết thúc</th>
                <th className="px-4 py-2">Lịch</th>
                <th className="px-4 py-2">Lớp</th>
                <th className="px-4 py-2">Xuất bản</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-neutral-800">{exam.title}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{exam.duration_minutes} phút</td>
                  <td className="px-4 py-2.5 text-neutral-600">{formatDateTime(exam.start_time)}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{formatDateTime(exam.end_time)}</td>
                  <td className="px-4 py-2.5">
                    <ExamStatusBadge startTime={exam.start_time} endTime={exam.end_time} />
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    {exam.classroom_id ? classroomNameById.get(exam.classroom_id) ?? '—' : 'Tất cả học sinh'}
                  </td>
                  <td className="px-4 py-2.5">
                    <PublishStatusBadge status={exam.status} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {exam.status === 'draft' && (
                        <button
                          type="button"
                          onClick={() => handlePublish(exam.id)}
                          disabled={updateExam.isPending}
                          className="text-xs font-medium text-success-700 hover:text-success-600 disabled:opacity-60"
                        >
                          Xuất bản
                        </button>
                      )}
                      <Link to={`/teacher/exams/${exam.id}`} className="text-xs font-medium text-primary-600 hover:text-primary-700">
                        Xem chi tiết →
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDeleting(exam)}
                        className="text-xs font-medium text-neutral-500 hover:text-danger-600"
                      >
                        Xoá
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Tạo đề thi mới" widthClassName="max-w-2xl">
        <ExamForm
          subjects={subjects ?? []}
          classrooms={classrooms ?? []}
          submitting={createExam.isPending}
          onSubmit={handleSubmit}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Xoá đề thi"
        message={`Bạn có chắc muốn xoá đề thi "${deleting?.title}"? Toàn bộ lượt thi và kết quả liên quan (nếu có) sẽ mất theo. Hành động này không thể hoàn tác.`}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        loading={deleteExam.isPending}
      />
    </div>
  );
}
