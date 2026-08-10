interface ViolationBannerProps {
  count: number;
  threshold: number;
}

export function ViolationBanner({ count, threshold }: ViolationBannerProps) {
  if (count <= 0) return null;

  return (
    <div className="rounded-md border border-warning-500/40 bg-warning-50 px-4 py-2.5 text-sm text-warning-700">
      ⚠ Cảnh báo: hệ thống đã ghi nhận <strong>{count}</strong>/{threshold} lần vi phạm (chuyển tab, thoát toàn màn
      hình, hoặc copy/dán). Bài thi sẽ tự động nộp nếu vượt quá {threshold} lần.
    </div>
  );
}
