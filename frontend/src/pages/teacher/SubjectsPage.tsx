import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  useChapters,
  useCreateChapter,
  useCreateSubject,
  useDeleteChapter,
  useDeleteSubject,
  useSubjects,
  useUpdateChapter,
  useUpdateSubject,
} from '@/hooks/useSubjects';
import { extractErrorMessage } from '@/api/client';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Spinner } from '@/components/common/Spinner';
import { EmptyState } from '@/components/common/EmptyState';
import { cn } from '@/lib/utils';
import type { Chapter, ChapterPayload, Subject, SubjectPayload } from '@/types';

export function SubjectsPage() {
  const { data: subjects, isLoading } = useSubjects();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  const selectedSubject = subjects?.find((s) => s.id === selectedSubjectId) ?? null;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-neutral-900">Môn học &amp; chương</h1>
        <p className="text-sm text-neutral-500">Quản lý danh sách môn học và các chương học của từng môn.</p>
      </div>

      <div className="grid grid-cols-[minmax(260px,320px)_1fr] gap-4">
        <SubjectList
          subjects={subjects ?? []}
          isLoading={isLoading}
          selectedId={selectedSubjectId}
          onSelect={setSelectedSubjectId}
        />
        {selectedSubject ? (
          <ChapterList subject={selectedSubject} />
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50">
            <EmptyState title="Chọn một môn học" description="Chọn môn học ở bên trái để xem và quản lý chương." />
          </div>
        )}
      </div>
    </div>
  );
}

function SubjectList({
  subjects,
  isLoading,
  selectedId,
  onSelect,
}: {
  subjects: Subject[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();
  const deleteSubject = useDeleteSubject();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState<Subject | null>(null);

  const { register, handleSubmit, reset } = useForm<SubjectPayload>();

  function openCreate() {
    setEditing(null);
    reset({ name: '', description: '' });
    setModalOpen(true);
  }

  function openEdit(subject: Subject) {
    setEditing(subject);
    reset({ name: subject.name, description: subject.description ?? '' });
    setModalOpen(true);
  }

  function onSubmit(values: SubjectPayload) {
    if (editing) {
      updateSubject.mutate(
        { id: editing.id, payload: values },
        {
          onSuccess: () => {
            toast.success('Đã cập nhật môn học');
            setModalOpen(false);
          },
          onError: (error) => toast.error(extractErrorMessage(error)),
        },
      );
    } else {
      createSubject.mutate(values, {
        onSuccess: () => {
          toast.success('Đã tạo môn học');
          setModalOpen(false);
        },
        onError: (error) => toast.error(extractErrorMessage(error)),
      });
    }
  }

  function confirmDelete() {
    if (!deleting) return;
    deleteSubject.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Đã xoá môn học');
        setDeleting(null);
      },
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">Danh sách môn học</h2>
        <button type="button" onClick={openCreate} className="text-sm font-medium text-primary-600 hover:text-primary-700">
          + Thêm
        </button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : subjects.length === 0 ? (
        <div className="p-4">
          <EmptyState title="Chưa có môn học nào" />
        </div>
      ) : (
        <ul>
          {subjects.map((subject) => (
            <li
              key={subject.id}
              className={cn(
                'flex items-center justify-between border-b border-neutral-100 px-4 py-2.5 last:border-0',
                selectedId === subject.id && 'bg-primary-50',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(subject.id)}
                className="flex-1 text-left text-sm font-medium text-neutral-800"
              >
                {subject.name}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(subject)}
                  className="text-xs font-medium text-neutral-500 hover:text-primary-600"
                >
                  Sửa
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(subject)}
                  className="text-xs font-medium text-neutral-500 hover:text-danger-600"
                >
                  Xoá
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Sửa môn học' : 'Thêm môn học'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Tên môn học</label>
            <input
              {...register('name', { required: true })}
              type="text"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Mô tả</label>
            <textarea
              {...register('description')}
              rows={2}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={createSubject.isPending || updateSubject.isPending}
              className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
            >
              Lưu
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Xoá môn học"
        message={`Bạn có chắc muốn xoá môn học "${deleting?.name}"? Hành động này không thể hoàn tác.`}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        loading={deleteSubject.isPending}
      />
    </div>
  );
}

function ChapterList({ subject }: { subject: Subject }) {
  const { data: chapters, isLoading } = useChapters(subject.id);
  const createChapter = useCreateChapter(subject.id);
  const updateChapter = useUpdateChapter(subject.id);
  const deleteChapter = useDeleteChapter(subject.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Chapter | null>(null);
  const [deleting, setDeleting] = useState<Chapter | null>(null);

  const { register, handleSubmit, reset } = useForm<ChapterPayload>();

  function openCreate() {
    setEditing(null);
    reset({ name: '', order: (chapters?.length ?? 0) + 1 });
    setModalOpen(true);
  }

  function openEdit(chapter: Chapter) {
    setEditing(chapter);
    reset({ name: chapter.name, order: chapter.order });
    setModalOpen(true);
  }

  function onSubmit(values: ChapterPayload) {
    if (editing) {
      updateChapter.mutate(
        { id: editing.id, payload: values },
        {
          onSuccess: () => {
            toast.success('Đã cập nhật chương');
            setModalOpen(false);
          },
          onError: (error) => toast.error(extractErrorMessage(error)),
        },
      );
    } else {
      createChapter.mutate(values, {
        onSuccess: () => {
          toast.success('Đã thêm chương');
          setModalOpen(false);
        },
        onError: (error) => toast.error(extractErrorMessage(error)),
      });
    }
  }

  function confirmDelete() {
    if (!deleting) return;
    deleteChapter.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Đã xoá chương');
        setDeleting(null);
      },
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">Chương của môn: {subject.name}</h2>
        <button type="button" onClick={openCreate} className="text-sm font-medium text-primary-600 hover:text-primary-700">
          + Thêm chương
        </button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : !chapters || chapters.length === 0 ? (
        <div className="p-4">
          <EmptyState title="Chưa có chương nào" />
        </div>
      ) : (
        <ul>
          {chapters.map((chapter) => (
            <li key={chapter.id} className="flex items-center justify-between border-b border-neutral-100 px-4 py-2.5 last:border-0">
              <span className="text-sm text-neutral-800">{chapter.name}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(chapter)}
                  className="text-xs font-medium text-neutral-500 hover:text-primary-600"
                >
                  Sửa
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(chapter)}
                  className="text-xs font-medium text-neutral-500 hover:text-danger-600"
                >
                  Xoá
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Sửa chương' : 'Thêm chương'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Tên chương</label>
            <input
              {...register('name', { required: true })}
              type="text"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Thứ tự</label>
            <input
              {...register('order', { valueAsNumber: true })}
              type="number"
              min={1}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={createChapter.isPending || updateChapter.isPending}
              className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
            >
              Lưu
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Xoá chương"
        message={`Bạn có chắc muốn xoá chương "${deleting?.name}"?`}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        loading={deleteChapter.isPending}
      />
    </div>
  );
}
