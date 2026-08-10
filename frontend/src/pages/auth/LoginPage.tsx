import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as authApi from '@/api/auth';
import { extractErrorMessage } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import type { LoginPayload } from '@/types';

export function LoginPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit } = useForm<LoginPayload>();

  async function onSubmit(values: LoginPayload) {
    setSubmitting(true);
    try {
      const tokens = await authApi.login(values);
      setTokens(tokens);
      const me = await authApi.fetchMe();
      setUser(me);
      toast.success('Đăng nhập thành công');
      navigate('/', { replace: true });
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Email hoặc mật khẩu không đúng'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-8 shadow-card">
        <div className="mb-6 text-center">
          <p className="text-3xl">📝</p>
          <h1 className="mt-2 text-lg font-semibold text-neutral-900">Hệ thống thi trực tuyến</h1>
          <p className="mt-1 text-sm text-neutral-500">Đăng nhập để tiếp tục</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              {...register('password', { required: true })}
              type="password"
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-primary-500 px-3 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
          >
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-500">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-medium text-primary-600 hover:text-primary-700">
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}
