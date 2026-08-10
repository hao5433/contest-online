import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useSubjects, useChapters } from '@/hooks/useSubjects';
import {
  useApproveQuestion,
  useCreateQuestion,
  useDeleteQuestion,
  useQuestions,
  useUpdateQuestion,
} from '@/hooks/useQuestions';
import { extractErrorMessage } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Spinner } from '@/components/common/Spinner';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { QuestionForm } from '@/components/questions/QuestionForm';
import { QuestionImportButton } from '@/components/questions/QuestionImportButton';
import { difficultyLabels } from '@/lib/utils';
import type { Difficulty, Question, QuestionFilters, QuestionPayload } from '@/types';

const PAGE_SIZE = 10;

export function QuestionsPage() {
  const user = useAuthStore((s) => s.user);
  const canApprove = user?.role === 'admin';

  const { data: subjects } = useSubjects();
  const [filters, setFilters] = useState<QuestionFilters>({ page: 1, page_size: PAGE_SIZE });
  const { data: chapters } = useChapters(filters.subject_id);
  const { data, isLoading } = useQuestions(filters);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [deleting, setDeleting] = useState<Question | null>(null);

  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();
  const approveQuestion = useApproveQuestion();

  const subjectMap = useMemo(() => new Map((subjects ?? []).map((s) => [s.id, s.name])), [subjects]);

  function updateFilter<K extends keyof QuestionFilters>(key: K, value: QuestionFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(question: Question) {
    setEditing(question);
    setFormOpen(true);
  }

  function handleSubmit(payload: QuestionPayload) {
    if (editing) {
      updateQuestion.mutate(
        { id: editing.id, payload },
        {
          onSuccess: () => {
            toast.success('Đã cập nhật câu hỏi');
            setFormOpen(false);
          },
          onError: (error) => toast.error(extractErrorMessage(error)),
        },
      );
    } else {
      createQuestion.mutate(payload, {
        onSuccess: () => {
          toast.success('Đã tạo câu hỏi, chờ phê duyệt');
          setFormOpen(false);
        },
        onError: (error) => toast.error(extractErrorMessage(error)),
      });
    }
  }

  function confirmDelete() {
    if (!deleting) return;
    deleteQuestion.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Đã xoá câu hỏi');
        setDeleting(null);
      },
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  function handleApprove(question: Question) {
    approveQuestion.mutate(question.id, {
      onSuccess: () => toast.success('Đã phê duyệt câu hỏi'),
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Ngân hàng câu hỏi</h1>
          <p className="text-sm text-neutral-500">Tạo, chỉnh sửa và phê duyệt câu hỏi thi.</p>
        </div>
        <div className="flex gap-2">
          <QuestionImportButton />
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
          >
            + Thêm câu hỏi
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 rounded-lg border border-neutral-200 bg-white p-3">
        <select
          value={filters.subject_id ?? ''}
          onChange={(e) => updateFilter('subject_id', e.target.value || undefined)}
          className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">Tất cả môn học</option>
          {(subjects ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={filters.chapter_id ?? ''}
          onChange={(e) => updateFilter('chapter_id', e.target.value || undefined)}
          disabled={!filters.subject_id}
          className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
        >
          <option value="">Tất cả chương</option>
          {(chapters ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={filters.difficulty ?? ''}
          onChange={(e) => updateFilter('difficulty', (e.target.value || undefined) as Difficulty | undefined)}
          className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">Tất cả độ khó</option>
          {Object.entries(difficultyLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={filters.is_approved === undefined ? '' : String(filters.is_approved)}
          onChange={(e) =>
            updateFilter('is_approved', e.target.value === '' ? undefined : e.target.value === 'true')
          }
          className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="true">Đã phê duyệt</option>
          <option value="false">Chờ phê duyệt</option>
        </select>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Không có câu hỏi phù hợp" />
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
                  <th className="px-4 py-2">Nội dung</th>
                  <th className="px-4 py-2">Môn học</th>
                  <th className="px-4 py-2">Độ khó</th>
                  <th className="px-4 py-2">Loại</th>
                  <th className="px-4 py-2">Trạng thái</th>
                  <th className="px-4 py-2 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((q) => (
                  <tr key={q.id} className="border-b border-neutral-100 last:border-0">
                    <td className="max-w-xs truncate px-4 py-2.5 text-neutral-800">{q.content}</td>
                    <td className="px-4 py-2.5 text-neutral-600">{subjectMap.get(q.subject_id) ?? '—'}</td>
                    <td className="px-4 py-2.5 text-neutral-600">{difficultyLabels[q.difficulty]}</td>
                    <td className="px-4 py-2.5 text-neutral-600">
                      {q.question_type === 'single_choice' ? 'Một đáp án' : 'Nhiều đáp án'}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={q.is_approved ? 'success' : 'warning'}>
                        {q.is_approved ? 'Đã phê duyệt' : 'Chờ phê duyệt'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        {canApprove && !q.is_approved && (
                          <button
                            type="button"
                            onClick={() => handleApprove(q)}
                            className="text-xs font-medium text-success-700 hover:text-success-600"
                          >
                            Phê duyệt
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(q)}
                          className="text-xs font-medium text-neutral-500 hover:text-primary-600"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(q)}
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
            <Pagination
              page={data.page}
              pageSize={data.page_size}
              total={data.total}
              onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
            />
          </>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}
        widthClassName="max-w-2xl"
      >
        <QuestionForm
          subjects={subjects ?? []}
          defaultValues={
            editing
              ? {
                  subject_id: editing.subject_id,
                  chapter_id: editing.chapter_id,
                  content: editing.content,
                  difficulty: editing.difficulty,
                  question_type: editing.question_type,
                  choices: editing.choices.map((c) => ({ content: c.content, is_correct: c.is_correct })),
                }
              : undefined
          }
          submitting={createQuestion.isPending || updateQuestion.isPending}
          onSubmit={handleSubmit}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Xoá câu hỏi"
        message="Bạn có chắc muốn xoá câu hỏi này? Hành động này không thể hoàn tác."
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        loading={deleteQuestion.isPending}
      />
    </div>
  );
}
