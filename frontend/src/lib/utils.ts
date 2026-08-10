import type { Difficulty, ExamPublishStatus, ExamTimeStatus, Role, ViolationType } from '@/types';

/** Tiny className joiner (avoids pulling in clsx as a dependency). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export const roleLabels: Record<Role, string> = {
  admin: 'Quản trị viên',
  teacher: 'Giáo viên',
  student: 'Học sinh',
};

export const difficultyLabels: Record<Difficulty, string> = {
  easy: 'Dễ',
  medium: 'Trung bình',
  hard: 'Khó',
};

export const violationLabels: Record<ViolationType, string> = {
  tab_switch: 'Chuyển tab',
  fullscreen_exit: 'Thoát chế độ toàn màn hình',
  copy_paste_attempt: 'Copy/dán/chuột phải',
};

/** e.g. { tab_switch: 2, fullscreen_exit: 1 } -> "Chuyển tab ×2, Thoát chế độ toàn màn hình ×1" */
export function formatViolationBreakdown(byType: Record<string, number>): string {
  return Object.entries(byType)
    .map(([type, count]) => `${violationLabels[type as ViolationType] ?? type} ×${count}`)
    .join(', ');
}

export const examStatusLabels: Record<ExamTimeStatus, string> = {
  draft: 'Bản nháp',
  scheduled: 'Đã lên lịch',
  active: 'Đang diễn ra',
  ended: 'Đã kết thúc',
};

export const examPublishStatusLabels: Record<ExamPublishStatus, string> = {
  draft: 'Chưa xuất bản',
  published: 'Đã xuất bản',
  closed: 'Đã đóng',
};

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '—';
  return score.toFixed(2);
}

export function formatSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function deriveExamStatus(startTime: string, endTime: string): ExamTimeStatus {
  const now = Date.now();
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (now < start) return 'scheduled';
  if (now > end) return 'ended';
  return 'active';
}
