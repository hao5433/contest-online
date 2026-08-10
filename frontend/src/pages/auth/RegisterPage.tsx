import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as authApi from '@/api/auth';
import { extractErrorMessage } from '@/api/client';
import type { RegisterPayload } from '@/types';

interface RegisterFormValues extends RegisterPayload {
  confirm_password: string;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, watch, formState } = useForm<RegisterFormValues>();

  async function onSubmit(values: RegisterFormValues) {
    setSubmitting(true);
    try {
      await authApi.register({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
      });
      toast.success('Đăng ký thành công. Vui lòng đăng nhập.');
      navigate('/login', { replace: true });
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Đăng ký thất bại'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-8 shadow-card">
        <div className="mb-6 text-center">
          <p className="text-3xl">📝</p>
          <h1 className="mt-2 text-lg font-semibold text-neutral-900">Tạo tài khoản học sinh</h1>
          <p className="mt-1 text-sm text-neutral-500">Đăng ký để bắt đầu làm bài thi</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Họ và tên</label>
            <input
              {...register('full_name', { required: true })}
              type="text"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Nguyễn Văn A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Email</label>
            <input
              {...register('email', { required: true })}
              type="email"
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="ban@vidu.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Mật khẩu</label>
            <input
              {...register('password', { required: true, minLength: 6 })}
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Tối thiểu 6 ký tự"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Xác nhận mật khẩu</label>
            <input
              {...register('confirm_password', {
                required: true,
                validate: (value) => value === watch('password') || 'Mật khẩu xác nhận không khớp',
              })}
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="••••••••"
            />
            {formState.errors.confirm_password && (
              <p className="mt-1 text-xs text-danger-600">{formState.errors.confirm_password.message}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-primary-500 px-3 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
          >
            {submitting ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-500">
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}
