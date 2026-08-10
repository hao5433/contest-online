import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  useClassrooms,
  useCreateClassroom,
  useDeleteClassroom,
  useEnrolledStudents,
  useEnrollStudent,
  useUnenrollStudent,
  useUpdateClassroom,
} from '@/hooks/useClassrooms';
import { useResetUserPassword } from '@/hooks/useUsers';
import { extractErrorMessage } from '@/api/client';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Spinner } from '@/components/common/Spinner';
import { EmptyState } from '@/components/common/EmptyState';
import { StudentImportButton } from '@/components/classrooms/StudentImportButton';
import { cn, formatDateTime } from '@/lib/utils';
import type { ResetPasswordResult } from '@/api/users';
import type { Classroom, ClassroomPayload } from '@/types';

export function ClassroomsPage() {
  const { data: classrooms, isLoading } = useClassrooms();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedClassroom = classrooms?.find((c) => c.id === selectedId) ?? null;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-neutral-900">Lớp học</h1>
        <p className="text-sm text-neutral-500">
          Quản lý danh sách lớp và học sinh trong lớp. Khi tạo đề thi, bạn có thể giao đề cho 1 lớp cụ thể - chỉ
          học sinh trong lớp đó thấy được đề thi.
        </p>
      </div>

      <div className="grid grid-cols-[minmax(280px,340px)_1fr] gap-4">
        <ClassroomList
          classrooms={classrooms ?? []}
          isLoading={isLoading}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        {selectedClassroom ? (
          <StudentRoster classroom={selectedClassroom} />
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50">
            <EmptyState title="Chọn một lớp học" description="Chọn lớp ở bên trái để xem và quản lý học sinh." />
          </div>
        )}
      </div>
    </div>
  );
}

function ClassroomList({
  classrooms,
  isLoading,
  selectedId,
  onSelect,
}: {
  classrooms: Classroom[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const createClassroom = useCreateClassroom();
  const updateClassroom = useUpdateClassroom();
  const deleteClassroom = useDeleteClassroom();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Classroom | null>(null);
  const [deleting, setDeleting] = useState<Classroom | null>(null);

  const { register, handleSubmit, reset } = useForm<ClassroomPayload>();

  function openCreate() {
    setEditing(null);
    reset({ name: '' });
    setModalOpen(true);
  }

  function openEdit(classroom: Classroom) {
    setEditing(classroom);
    reset({ name: classroom.name });
    setModalOpen(true);
  }

  function onSubmit(values: ClassroomPayload) {
    if (editing) {
      updateClassroom.mutate(
        { id: editing.id, payload: values },
        {
          onSuccess: () => {
            toast.success('Đã cập nhật lớp học');
            setModalOpen(false);
          },
          onError: (error) => toast.error(extractErrorMessage(error)),
        },
      );
    } else {
      createClassroom.mutate(values, {
        onSuccess: () => {
          toast.success('Đã tạo lớp học');
          setModalOpen(false);
        },
        onError: (error) => toast.error(extractErrorMessage(error)),
      });
    }
  }

  function confirmDelete() {
    if (!deleting) return;
    deleteClassroom.mutate(deleting.id, {
      onSuccess: () => {
        toast.success('Đã xoá lớp học');
        setDeleting(null);
      },
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-neutral-900">Danh sách lớp</h2>
        <button type="button" onClick={openCreate} className="text-sm font-medium text-primary-600 hover:text-primary-700">
          + Thêm lớp
        </button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : classrooms.length === 0 ? (
        <div className="p-4">
          <EmptyState title="Chưa có lớp học nào" />
        </div>
      ) : (
        <ul>
          {classrooms.map((classroom) => (
            <li
              key={classroom.id}
              className={cn(
                'flex items-center justify-between border-b border-neutral-100 px-4 py-2.5 last:border-0',
                selectedId === classroom.id && 'bg-primary-50',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(classroom.id)}
                className="flex-1 text-left text-sm font-medium text-neutral-800"
              >
                {classroom.name}
                <span className="ml-2 text-xs font-normal text-neutral-500">{classroom.student_count} học sinh</span>
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(classroom)}
                  className="text-xs font-medium text-neutral-500 hover:text-primary-600"
                >
                  Sửa
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(classroom)}
                  className="text-xs font-medium text-neutral-500 hover:text-danger-600"
                >
                  Xoá
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Sửa lớp học' : 'Thêm lớp học'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Tên lớp</label>
            <input
              {...register('name', { required: true })}
              type="text"
              placeholder="VD: Lớp 10A1"
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
              disabled={createClassroom.isPending || updateClassroom.isPending}
              className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
            >
              Lưu
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Xoá lớp học"
        message={`Bạn có chắc muốn xoá lớp "${deleting?.name}"? Các đề thi đã giao cho lớp này cần được gỡ trước khi xoá.`}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        loading={deleteClassroom.isPending}
      />
    </div>
  );
}

function StudentRoster({ classroom }: { classroom: Classroom }) {
  const { data: students, isLoading } = useEnrolledStudents(classroom.id);
  const enrollStudent = useEnrollStudent(classroom.id);
  const unenrollStudent = useUnenrollStudent(classroom.id);
  const resetPassword = useResetUserPassword();
  const [resetResult, setResetResult] = useState<ResetPasswordResult | null>(null);
  const { register, handleSubmit, reset } = useForm<{ email: string }>();

  function onEnroll(values: { email: string }) {
    enrollStudent.mutate(values.email, {
      onSuccess: (student) => {
        toast.success(`Đã thêm ${student.full_name} vào lớp`);
        reset();
      },
      onError: (error) => toast.error(extractErrorMessage(error, 'Không thể thêm học sinh')),
    });
  }

  function handleUnenroll(studentId: string, name: string) {
    unenrollStudent.mutate(studentId, {
      onSuccess: () => toast.success(`Đã xoá ${name} khỏi lớp`),
      onError: (error) => toast.error(extractErrorMessage(error)),
    });
  }

  function handleResetPassword(studentId: string, name: string) {
    if (!window.confirm(`Đặt lại mật khẩu cho "${name}"? Mật khẩu cũ sẽ không còn dùng được.`)) return;
    resetPassword.mutate(studentId, {
      onSuccess: (result) => setResetResult(result),
      onError: (error) => toast.error(extractErrorMessage(error, 'Đặt lại mật khẩu thất bại')),
    });
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Học sinh trong lớp: {classroom.name}</h2>
          <p className="text-xs text-neutral-500">
            Thêm từng học sinh bằng email, hoặc nhập cả danh sách từ file Excel (cột <code>full_name</code>,{' '}
            <code>email</code>, <code>password</code> tuỳ chọn).
          </p>
        </div>
        <StudentImportButton classroomId={classroom.id} />
      </div>

      <form onSubmit={handleSubmit(onEnroll)} className="flex gap-2 border-b border-neutral-200 p-3">
        <input
          {...register('email', { required: true })}
          type="email"
          placeholder="email@hocsinh.com"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <button
          type="submit"
          disabled={enrollStudent.isPending}
          className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
        >
          + Thêm vào lớp
        </button>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : !students || students.length === 0 ? (
        <div className="p-4">
          <EmptyState title="Lớp chưa có học sinh nào" />
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
              <th className="px-4 py-2">Họ tên</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Ngày thêm</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.student_id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-2.5 font-medium text-neutral-800">{student.full_name}</td>
                <td className="px-4 py-2.5 text-neutral-600">{student.email}</td>
                <td className="px-4 py-2.5 text-neutral-600">{formatDateTime(student.enrolled_at)}</td>
                <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleResetPassword(student.student_id, student.full_name)}
                    disabled={resetPassword.isPending}
                    className="text-xs font-medium text-neutral-500 hover:text-primary-600 disabled:opacity-60"
                  >
                    Đặt lại mật khẩu
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnenroll(student.student_id, student.full_name)}
                    className="text-xs font-medium text-neutral-500 hover:text-danger-600"
                  >
                    Xoá khỏi lớp
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal open={resetResult !== null} onClose={() => setResetResult(null)} title="Đã đặt lại mật khẩu">
        {resetResult && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Hãy gửi mật khẩu tạm thời này cho <strong>{resetResult.email}</strong> qua kênh khác (nói trực
              tiếp, Zalo,...). Mật khẩu chỉ hiển thị một lần duy nhất ở đây. Học sinh nên đổi sang mật khẩu
              riêng ngay sau khi đăng nhập.
            </p>
            <div className="flex items-center gap-2 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2">
              <code className="flex-1 text-sm font-mono text-neutral-900">{resetResult.temporary_password}</code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(resetResult.temporary_password);
                  toast.success('Đã copy mật khẩu');
                }}
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-white"
              >
                Copy
              </button>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setResetResult(null)}
                className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
