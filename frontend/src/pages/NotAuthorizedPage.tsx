import { Link } from 'react-router-dom';

export function NotAuthorizedPage() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-5xl">🚫</p>
      <h1 className="mt-4 text-xl font-semibold text-neutral-900">Không có quyền truy cập</h1>
      <p className="mt-2 max-w-sm text-sm text-neutral-500">
        Tài khoản của bạn không có quyền truy cập vào trang này. Vui lòng liên hệ quản trị viên nếu bạn cho rằng đây là nhầm lẫn.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-md bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
      >
        Về trang chủ
      </Link>
    </div>
  );
}
