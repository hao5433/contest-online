import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { changePassword, fetchMe } from '@/api/auth';
import { useAuthStore } from '@/store/auth';

/**
 * On app start, if we have a persisted access token but no user object yet
 * (e.g. after a hard refresh), fetch /auth/me once to repopulate the store.
 * Returns `true` while that bootstrap call is in flight so the app can show
 * a full-page spinner instead of flashing the login page.
 */
export function useBootstrapAuth(): { isBootstrapping: boolean } {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const [isBootstrapping, setIsBootstrapping] = useState(Boolean(accessToken) && !user);

  useEffect(() => {
    if (!accessToken || user) {
      setIsBootstrapping(false);
      return;
    }

    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setIsBootstrapping(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return { isBootstrapping };
}

export function useChangePassword() {
  return useMutation({ mutationFn: changePassword });
}
