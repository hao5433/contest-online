import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { roleLabels } from '@/lib/utils';
import { ChangePasswordModal } from '@/components/common/ChangePasswordModal';
import { logout as logoutApi } from '@/api/auth';

export function Header() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const logout = useAuthStore((s) => s.logout);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  async function handleLogout() {
    // Best-effort: revoke server-side so the refresh token can't be reused,
    // but always clear local state and navigate away even if this fails
    // (e.g. it was already expired/revoked) - the user's intent to log out
    // must never get stuck behind a network call.
    if (refreshToken) {
      try {
        await logoutApi(refreshToken);
      } catch {
        // ignore - local logout below still proceeds
      }
    }
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-6">
      <div />
      {user && (
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-neutral-900">{user.full_name}</p>
            <p className="text-xs text-neutral-500">{roleLabels[user.role]}</p>
          </div>
          <button
            type="button"
            onClick={() => setChangePasswordOpen(true)}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Đổi mật khẩu
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Đăng xuất
          </button>
        </div>
      )}
      <ChangePasswordModal open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    </header>
  );
}
