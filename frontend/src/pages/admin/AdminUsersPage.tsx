import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useCreateUser, useResetUserPassword, useUpdateUser, useUsers } from '@/hooks/useUsers';
import { extractErrorMessage } from '@/api/client';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { EmptyState } from '@/components/common/EmptyState';
import { roleLabels } from '@/lib/utils';
import type { CreateUserPayload, ResetPasswordResult } from '@/api/users';
import type { Role } from '@/types';

export function AdminUsersPage() {
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const resetPassword = useResetUserPassword();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetResult, setResetResult] = useState<ResetPasswordResult | null>(null);

  const { register, handleSubmit, reset } = useForm<CreateUserPayload>({
    defaultValues: { role: 'teacher' },
  });

  function onCreate(values: CreateUserPayload) {
    createUser.mutate(values, {
      onSuccess: () => {
        toast.success('Đã tạo người dùng mới');
        setCreateOpen(false);
        reset();
      },
      onError: (error) => toast.error(extractErrorMessage(error, 'Tạo người dùng thất bại')),
    });
  }

  function handleToggleActive(id: string, is_active: boolean) {
    updateUser.mutate(
      { id, payload: { is_active: !is_active } },
      {
        onSuccess: () => toast.success('Đã cập nhật trạng thái người dùng'),
        onError: (error) => toast.error(extractErrorMessage(error)),
      },
    );
  }

  function handleRoleChange(id: string, role: Role) {
    updateUser.mutate(
      { id, payload: { role } },
      {
        onSuccess: () => toast.success('Đã cập nhật vai trò'),
        onError: (error) => toast.error(extractErrorMessage(error)),
      },
    );
  }

  function handleResetPassword(id: string, fullName: string) {
    if (!window.confirm(`Đặt lại mật khẩu cho "${fullName}"? Mật khẩu cũ sẽ không còn dùng được.`)) return;
    resetPassword.mutate(id, {
      onSuccess: (result) => setResetResult(result),
      onError: (error) => toast.error(extractErrorMessage(error, 'Đặt lại mật khẩu thất bại')),
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Quản lý người dùng</h1>
          <p className="text-sm text-neutral-500">Kích hoạt/khoá tài khoản và thay đổi vai trò.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
        >
          + Tạo người dùng
        </button>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : !users || users.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Chưa có người dùng nào" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
                <th className="px-4 py-2">Họ tên</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Vai trò</th>
                <th className="px-4 py-2">Trạng thái</th>
                <th className="px-4 py-2 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2.5 text-neutral-800">{user.full_name}</td>
                  <td className="px-4 py-2.5 text-neutral-600">{user.email}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                      className="rounded-md border border-neutral-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={user.is_active ? 'success' : 'danger'}>
                      {user.is_active ? 'Đang hoạt động' : 'Đã khoá'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleResetPassword(user.id, user.full_name)}
                      disabled={resetPassword.isPending}
                      className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                    >
                      Đặt lại mật khẩu
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(user.id, user.is_active)}
                      className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      {user.is_active ? 'Khoá' : 'Kích hoạt'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo người dùng mới">
        <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Họ và tên</label>
            <input
              {...register('full_name', { required: true })}
              type="text"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Email</label>
            <input
              {...register('email', { required: true })}
              type="email"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Mật khẩu tạm thời</label>
            <input
              {...register('password', { required: true, minLength: 6 })}
              type="password"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Vai trò</label>
            <select
              {...register('role', { required: true })}
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="teacher">Giáo viên</option>
              <option value="admin">Quản trị viên</option>
              <option value="student">Học sinh</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={createUser.isPending}
              className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
            >
              {createUser.isPending ? 'Đang tạo...' : 'Tạo người dùng'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={resetResult !== null} onClose={() => setResetResult(null)} title="Đã đặt lại mật khẩu">
        {resetResult && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Hãy gửi mật khẩu tạm thời này cho <strong>{resetResult.email}</strong> qua kênh khác (nói trực
              tiếp, Zalo,...). Mật khẩu chỉ hiển thị một lần duy nhất ở đây - hệ thống không lưu lại dạng chưa
              mã hoá. Học sinh nên đổi sang mật khẩu riêng ngay sau khi đăng nhập.
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
