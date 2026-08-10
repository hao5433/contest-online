import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { FullPageSpinner } from '@/components/common/Spinner';
import { useBootstrapAuth } from '@/hooks/useAuth';

import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { DashboardRedirect } from '@/pages/DashboardRedirect';
import { NotAuthorizedPage } from '@/pages/NotAuthorizedPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { ClassroomsPage } from '@/pages/teacher/ClassroomsPage';
import { SubjectsPage } from '@/pages/teacher/SubjectsPage';
import { QuestionsPage } from '@/pages/teacher/QuestionsPage';
import { ExamsPage } from '@/pages/teacher/ExamsPage';
import { ExamDetailPage } from '@/pages/teacher/ExamDetailPage';
import { StudentHomePage } from '@/pages/student/StudentHomePage';
import { ExamRoomPage } from '@/pages/student/ExamRoomPage';
import { ExamResultPage } from '@/pages/student/ExamResultPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const { isBootstrapping } = useBootstrapAuth();

  if (isBootstrapping) return <FullPageSpinner />;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Exam room / result render full-screen without the dashboard chrome. */}
      <Route
        path="/student/exam/:examId/room"
        element={
          <ProtectedRoute roles={['student']}>
            <ExamRoomPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/exam/:examId/result/:attemptId"
        element={
          <ProtectedRoute roles={['student']}>
            <ExamResultPage />
          </ProtectedRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardRedirect />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/teacher/classrooms"
          element={
            <ProtectedRoute roles={['admin', 'teacher']}>
              <ClassroomsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/subjects"
          element={
            <ProtectedRoute roles={['admin', 'teacher']}>
              <SubjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/questions"
          element={
            <ProtectedRoute roles={['admin', 'teacher']}>
              <QuestionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/exams"
          element={
            <ProtectedRoute roles={['admin', 'teacher']}>
              <ExamsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/exams/:id"
          element={
            <ProtectedRoute roles={['admin', 'teacher']}>
              <ExamDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student"
          element={
            <ProtectedRoute roles={['student']}>
              <StudentHomePage />
            </ProtectedRoute>
          }
        />

        <Route path="/not-authorized" element={<NotAuthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
