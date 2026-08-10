import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-5xl">🔍</p>
      <h1 className="mt-4 text-xl font-semibold text-neutral-900">Không tìm thấy trang</h1>
      <p className="mt-2 max-w-sm text-sm text-neutral-500">
        Trang bạn đang tìm không tồn tại hoặc đã bị chuyển đi.
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
