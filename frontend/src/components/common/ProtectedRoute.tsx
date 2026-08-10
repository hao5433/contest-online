import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import type { Role } from '@/types';
import { NotAuthorizedPage } from '@/pages/NotAuthorizedPage';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: Role[];
}

/** Redirects to /login if unauthenticated; renders a 403 page if the role doesn't match. */
export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && roles.length > 0 && user && !roles.includes(user.role)) {
    return <NotAuthorizedPage />;
  }

  return <>{children}</>;
}
