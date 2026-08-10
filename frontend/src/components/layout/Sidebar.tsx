import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const navByRole: Record<Role, NavItem[]> = {
  admin: [
    { to: '/admin', label: 'Người dùng', icon: '👥' },
    { to: '/teacher/classrooms', label: 'Lớp học', icon: '🏫' },
    { to: '/teacher/subjects', label: 'Môn học', icon: '📚' },
    { to: '/teacher/questions', label: 'Câu hỏi', icon: '❓' },
    { to: '/teacher/exams', label: 'Đề thi', icon: '📝' },
  ],
  teacher: [
    { to: '/teacher/classrooms', label: 'Lớp học', icon: '🏫' },
    { to: '/teacher/subjects', label: 'Môn học', icon: '📚' },
    { to: '/teacher/questions', label: 'Câu hỏi', icon: '❓' },
    { to: '/teacher/exams', label: 'Đề thi', icon: '📝' },
  ],
  student: [{ to: '/student', label: 'Bài thi của tôi', icon: '🎓' }],
};

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const items = user ? navByRole[user.role] : [];

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="text-2xl">📝</span>
        <span className="text-sm font-semibold text-neutral-900">Hệ thống thi trực tuyến</span>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900',
              )
            }
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
