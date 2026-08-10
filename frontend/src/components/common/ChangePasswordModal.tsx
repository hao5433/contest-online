import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useChangePassword } from '@/hooks/useAuth';
import { extractErrorMessage } from '@/api/client';
import { Modal } from '@/components/common/Modal';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const changePassword = useChangePassword();
  const { register, handleSubmit, watch, reset } = useForm<FormValues>();

  function handleClose() {
    reset();
    onClose();
  }

  function onSubmit(values: FormValues) {
    if (values.new_password !== values.confirm_password) {
      toast.error('Mật khẩu mới nhập lại không khớp');
      return;
    }
    changePassword.mutate(
      { current_password: values.current_password, new_password: values.new_password },
      {
        onSuccess: () => {
          toast.success('Đã đổi mật khẩu. Lần đăng nhập sau hãy dùng mật khẩu mới.');
          handleClose();
        },
        onError: (error) => toast.error(extractErrorMessage(error, 'Đổi mật khẩu thất bại')),
      },
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Đổi mật khẩu">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700">Mật khẩu hiện tại</label>
          <input
            {...register('current_password', { required: true })}
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">Mật khẩu mới</label>
          <input
            {...register('new_password', { required: true, minLength: 6 })}
            type="password"
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <p className="mt-1 text-xs text-neutral-500">Ít nhất 6 ký tự.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">Nhập lại mật khẩu mới</label>
          <input
            {...register('confirm_password', { required: true, validate: (v) => v === watch('new_password') })}
            type="password"
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={changePassword.isPending}
            className="rounded-md bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
          >
            {changePassword.isPending ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
