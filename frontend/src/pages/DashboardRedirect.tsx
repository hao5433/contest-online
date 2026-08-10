import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { FullPageSpinner } from '@/components/common/Spinner';

/** Role-aware landing page: sends each role to its own area. */
export function DashboardRedirect() {
  const user = useAuthStore((s) => s.user);

  if (!user) return <FullPageSpinner />;

  switch (user.role) {
    case 'admin':
      return <Navigate to="/admin" replace />;
    case 'teacher':
      return <Navigate to="/teacher/exams" replace />;
    case 'student':
      return <Navigate to="/student" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}
